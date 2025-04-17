import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';
import { ValidationError } from '../utils/errors';

export interface CreateRoleDto {
  name: string;
  description: string;
  permissions: string[];
}

export interface UpdateRoleDto {
  name?: string;
  description?: string;
  permissions?: string[];
}

export class RoleService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private logger: Logger
  ) {}

  async createRole(data: CreateRoleDto) {
    try {
      const role = await this.prisma.role.create({
        data: {
          name: data.name,
          description: data.description,
          permissions: data.permissions
        }
      });

      // Cache role data
      await this.redis.set(`role:${role.id}`, JSON.stringify(role));
      
      return role;
    } catch (error) {
      this.logger.error('Error creating role:', error);
      throw new ValidationError('Failed to create role');
    }
  }

  async updateRole(id: string, data: UpdateRoleDto) {
    try {
      const role = await this.prisma.role.update({
        where: { id },
        data
      });

      // Update cache
      await this.redis.set(`role:${role.id}`, JSON.stringify(role));
      
      return role;
    } catch (error) {
      this.logger.error('Error updating role:', error);
      throw new ValidationError('Failed to update role');
    }
  }

  async deleteRole(id: string) {
    try {
      await this.prisma.role.delete({
        where: { id }
      });

      // Remove from cache
      await this.redis.del(`role:${id}`);
    } catch (error) {
      this.logger.error('Error deleting role:', error);
      throw new ValidationError('Failed to delete role');
    }
  }

  async getRole(id: string) {
    try {
      // Try to get from cache first
      const cachedRole = await this.redis.get(`role:${id}`);
      if (cachedRole) {
        return JSON.parse(cachedRole);
      }

      const role = await this.prisma.role.findUnique({
        where: { id }
      });

      if (role) {
        // Cache the result
        await this.redis.set(`role:${id}`, JSON.stringify(role));
      }

      return role;
    } catch (error) {
      this.logger.error('Error getting role:', error);
      throw new ValidationError('Failed to get role');
    }
  }

  async listRoles(page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;
      
      const [roles, total] = await Promise.all([
        this.prisma.role.findMany({
          skip,
          take: limit,
          orderBy: {
            createdAt: 'desc'
          }
        }),
        this.prisma.role.count()
      ]);

      return {
        roles,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      this.logger.error('Error listing roles:', error);
      throw new ValidationError('Failed to list roles');
    }
  }

  async getAvailablePermissions() {
    try {
      // Try to get from cache first
      const cachedPermissions = await this.redis.get('available_permissions');
      if (cachedPermissions) {
        return JSON.parse(cachedPermissions);
      }

      // Define available permissions
      const permissions = [
        {
          title: 'Dashboard',
          key: 'dashboard',
          children: [
            { title: 'View', key: 'dashboard:view' },
            { title: 'Export', key: 'dashboard:export' },
          ],
        },
        {
          title: 'Users',
          key: 'users',
          children: [
            { title: 'View', key: 'users:view' },
            { title: 'Create', key: 'users:create' },
            { title: 'Edit', key: 'users:edit' },
            { title: 'Delete', key: 'users:delete' },
          ],
        },
        {
          title: 'Roles',
          key: 'roles',
          children: [
            { title: 'View', key: 'roles:view' },
            { title: 'Create', key: 'roles:create' },
            { title: 'Edit', key: 'roles:edit' },
            { title: 'Delete', key: 'roles:delete' },
          ],
        },
        {
          title: 'Reports',
          key: 'reports',
          children: [
            { title: 'View', key: 'reports:view' },
            { title: 'Create', key: 'reports:create' },
            { title: 'Export', key: 'reports:export' },
          ],
        },
        {
          title: 'Settings',
          key: 'settings',
          children: [
            { title: 'View', key: 'settings:view' },
            { title: 'Edit', key: 'settings:edit' },
          ],
        }
      ];

      // Cache the permissions
      await this.redis.set('available_permissions', JSON.stringify(permissions));
      
      return permissions;
    } catch (error) {
      this.logger.error('Error getting available permissions:', error);
      throw new ValidationError('Failed to get available permissions');
    }
  }
} 