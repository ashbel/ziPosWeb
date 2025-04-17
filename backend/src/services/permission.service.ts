import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { Redis } from 'ioredis';

interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  conditions?: any[];
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  parentRoles?: string[];
}

interface AccessPolicy {
  id: string;
  name: string;
  description: string;
  rules: Array<{
    resource: string;
    actions: string[];
    conditions?: any[];
  }>;
}

export class PermissionService extends BaseService {
  private readonly redis: Redis;
  private readonly cachePrefix = 'permissions:';
  private readonly cacheTTL = 3600; // 1 hour

  constructor(deps: any) {
    super(deps);
    this.redis = deps.redis;
    this.initializeDefaultRoles();
  }

  async checkPermission(
    userId: string,
    resource: string,
    action: string,
    context?: any
  ): Promise<boolean> {
    try {
      // Check cache first
      const cacheKey = `${this.cachePrefix}${userId}:${resource}:${action}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached !== null) {
        return cached === 'true';
      }

      // Get user roles
      const userRoles = await this.getUserRoles(userId);

      // Get permissions for all roles
      const permissions = await this.getRolePermissions(userRoles);

      // Check if any permission matches
      const hasPermission = await this.evaluatePermissions(
        permissions,
        resource,
        action,
        context
      );

      // Cache the result
      await this.redis.setex(cacheKey, this.cacheTTL, hasPermission.toString());

      return hasPermission;
    } catch (error) {
      this.logger.error('Permission check error:', error);
      return false;
    }
  }

  async grantPermission(
    roleId: string,
    permissionId: string
  ): Promise<void> {
    await this.prisma.rolePermission.create({
      data: {
        roleId,
        permissionId
      }
    });

    await this.invalidateRoleCache(roleId);
  }

  async revokePermission(
    roleId: string,
    permissionId: string
  ): Promise<void> {
    await this.prisma.rolePermission.delete({
      where: {
        roleId_permissionId: {
          roleId,
          permissionId
        }
      }
    });

    await this.invalidateRoleCache(roleId);
  }

  async assignRole(userId: string, roleId: string): Promise<void> {
    await this.prisma.userRole.create({
      data: {
        userId,
        roleId
      }
    });

    await this.invalidateUserCache(userId);
  }

  async removeRole(userId: string, roleId: string): Promise<void> {
    await this.prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId,
          roleId
        }
      }
    });

    await this.invalidateUserCache(userId);
  }

  async createRole(role: Role): Promise<Role> {
    const created = await this.prisma.role.create({
      data: {
        name: role.name,
        description: role.description,
        permissions: {
          create: role.permissions.map(permissionId => ({
            permission: { connect: { id: permissionId } }
          }))
        },
        parentRoles: role.parentRoles
          ? {
              create: role.parentRoles.map(parentId => ({
                parent: { connect: { id: parentId } }
              }))
            }
          : undefined
      }
    });

    return created;
  }

  async createPermission(permission: Permission): Promise<Permission> {
    return this.prisma.permission.create({
      data: {
        name: permission.name,
        description: permission.description,
        resource: permission.resource,
        action: permission.action,
        conditions: permission.conditions
      }
    });
  }

  async createPolicy(policy: AccessPolicy): Promise<AccessPolicy> {
    return this.prisma.accessPolicy.create({
      data: {
        name: policy.name,
        description: policy.description,
        rules: policy.rules
      }
    });
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    const cacheKey = `${this.cachePrefix}user:${userId}:permissions`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const roles = await this.getUserRoles(userId);
    const permissions = await this.getRolePermissions(roles);

    await this.redis.setex(
      cacheKey,
      this.cacheTTL,
      JSON.stringify(permissions)
    );

    return permissions;
  }

  async getRoleHierarchy(roleId: string): Promise<Role[]> {
    const visited = new Set<string>();
    const hierarchy: Role[] = [];

    const traverseHierarchy = async (currentRoleId: string) => {
      if (visited.has(currentRoleId)) return;
      visited.add(currentRoleId);

      const role = await this.prisma.role.findUnique({
        where: { id: currentRoleId },
        include: {
          parentRoles: {
            include: {
              parent: true
            }
          }
        }
      });

      if (role) {
        hierarchy.push(role);
        for (const parentRole of role.parentRoles) {
          await traverseHierarchy(parentRole.parent.id);
        }
      }
    };

    await traverseHierarchy(roleId);
    return hierarchy;
  }

  private async initializeDefaultRoles(): Promise<void> {
    const defaultRoles = [
      {
        name: 'admin',
        description: 'System administrator',
        permissions: ['*']
      },
      {
        name: 'user',
        description: 'Regular user',
        permissions: ['read:own', 'write:own']
      },
      {
        name: 'guest',
        description: 'Guest user',
        permissions: ['read:public']
      }
    ];

    for (const role of defaultRoles) {
      const exists = await this.prisma.role.findFirst({
        where: { name: role.name }
      });

      if (!exists) {
        await this.createRole(role as Role);
      }
    }
  }

  private async getUserRoles(userId: string): Promise<Role[]> {
    const cacheKey = `${this.cachePrefix}user:${userId}:roles`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached);
    }

    const roles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: true
      }
    });

    const userRoles = roles.map(ur => ur.role);
    await this.redis.setex(cacheKey, this.cacheTTL, JSON.stringify(userRoles));

    return userRoles;
  }

  private async getRolePermissions(roles: Role[]): Promise<Permission[]> {
    const permissions = new Set<Permission>();

    for (const role of roles) {
      const rolePermissions = await this.prisma.rolePermission.findMany({
        where: { roleId: role.id },
        include: {
          permission: true
        }
      });

      rolePermissions.forEach(rp => permissions.add(rp.permission));

      // Include permissions from parent roles
      const parentRoles = await this.getRoleHierarchy(role.id);
      for (const parentRole of parentRoles) {
        const parentPermissions = await this.prisma.rolePermission.findMany({
          where: { roleId: parentRole.id },
          include: {
            permission: true
          }
        });
        parentPermissions.forEach(rp => permissions.add(rp.permission));
      }
    }

    return Array.from(permissions);
  }

  private async evaluatePermissions(
    permissions: Permission[],
    resource: string,
    action: string,
    context?: any
  ): Promise<boolean> {
    for (const permission of permissions) {
      if (
        this.matchesResource(permission.resource, resource) &&
        this.matchesAction(permission.action, action)
      ) {
        if (!permission.conditions || permission.conditions.length === 0) {
          return true;
        }

        const conditionsMet = await this.evaluateConditions(
          permission.conditions,
          context
        );
        if (conditionsMet) {
          return true;
        }
      }
    }

    return false;
  }

  private matchesResource(
    permissionResource: string,
    requestedResource: string
  ): boolean {
    if (permissionResource === '*') return true;
    if (permissionResource === requestedResource) return true;
    if (permissionResource.endsWith('*')) {
      const prefix = permissionResource.slice(0, -1);
      return requestedResource.startsWith(prefix);
    }
    return false;
  }

  private matchesAction(
    permissionAction: string,
    requestedAction: string
  ): boolean {
    if (permissionAction === '*') return true;
    return permissionAction === requestedAction;
  }

  private async evaluateConditions(
    conditions: any[],
    context?: any
  ): Promise<boolean> {
    if (!context) return false;

    for (const condition of conditions) {
      switch (condition.type) {
        case 'ownership':
          if (context.userId !== context.resourceOwnerId) {
            return false;
          }
          break;

        case 'timeRange':
          const now = new Date();
          if (
            now < new Date(condition.start) ||
            now > new Date(condition.end)
          ) {
            return false;
          }
          break;

        case 'ipRange':
          if (!this.isIpInRange(context.ip, condition.range)) {
            return false;
          }
          break;

        case 'custom':
          if (typeof condition.evaluate === 'function') {
            if (!(await condition.evaluate(context))) {
              return false;
            }
          }
          break;

        default:
          this.logger.warn(`Unknown condition type: ${condition.type}`);
          return false;
      }
    }

    return true;
  }

  private isIpInRange(ip: string, range: string): boolean {
    // Implement IP range checking logic
    return true;
  }

  private async invalidateRoleCache(roleId: string): Promise<void> {
    const pattern = `${this.cachePrefix}*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private async invalidateUserCache(userId: string): Promise<void> {
    const patterns = [
      `${this.cachePrefix}user:${userId}:*`,
      `${this.cachePrefix}${userId}:*`
    ];

    for (const pattern of patterns) {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }
} 