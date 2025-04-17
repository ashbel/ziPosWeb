import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';
import bcrypt from 'bcryptjs';
import { ValidationError } from '../utils/errors';

export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  roleId: string;
}

export interface UpdateUserDto {
  username?: string;
  email?: string;
  password?: string;
  roleId?: string;
  status?: 'active' | 'inactive';
}

export class UserService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private logger: Logger
  ) {}

  async createUser(data: CreateUserDto) {
    try {
      const hashedPassword = await bcrypt.hash(data.password, 10);
      
      const user = await this.prisma.user.create({
        data: {
          username: data.username,
          email: data.email,
          password: hashedPassword,
          roleId: data.roleId,
          status: 'active'
        },
        include: {
          role: true
        }
      });

      // Cache user data
      await this.redis.set(`user:${user.id}`, JSON.stringify(user));
      
      return user;
    } catch (error) {
      this.logger.error('Error creating user:', error);
      throw new ValidationError('Failed to create user');
    }
  }

  async updateUser(id: string, data: UpdateUserDto) {
    try {
      const updateData: any = { ...data };
      
      if (data.password) {
        updateData.password = await bcrypt.hash(data.password, 10);
      }

      const user = await this.prisma.user.update({
        where: { id },
        data: updateData,
        include: {
          role: true
        }
      });

      // Update cache
      await this.redis.set(`user:${user.id}`, JSON.stringify(user));
      
      return user;
    } catch (error) {
      this.logger.error('Error updating user:', error);
      throw new ValidationError('Failed to update user');
    }
  }

  async deleteUser(id: string) {
    try {
      await this.prisma.user.delete({
        where: { id }
      });

      // Remove from cache
      await this.redis.del(`user:${id}`);
    } catch (error) {
      this.logger.error('Error deleting user:', error);
      throw new ValidationError('Failed to delete user');
    }
  }

  async getUser(id: string) {
    try {
      // Try to get from cache first
      const cachedUser = await this.redis.get(`user:${id}`);
      if (cachedUser) {
        return JSON.parse(cachedUser);
      }

      const user = await this.prisma.user.findUnique({
        where: { id },
        include: {
          role: true
        }
      });

      if (user) {
        // Cache the result
        await this.redis.set(`user:${id}`, JSON.stringify(user));
      }

      return user;
    } catch (error) {
      this.logger.error('Error getting user:', error);
      throw new ValidationError('Failed to get user');
    }
  }

  async listUsers(page: number = 1, limit: number = 10) {
    try {
      const skip = (page - 1) * limit;
      
      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          skip,
          take: limit,
          include: {
            role: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        }),
        this.prisma.user.count()
      ]);

      return {
        users,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      this.logger.error('Error listing users:', error);
      throw new ValidationError('Failed to list users');
    }
  }

  async changeUserStatus(id: string, status: 'active' | 'inactive') {
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { status },
        include: {
          role: true
        }
      });

      // Update cache
      await this.redis.set(`user:${user.id}`, JSON.stringify(user));
      
      return user;
    } catch (error) {
      this.logger.error('Error changing user status:', error);
      throw new ValidationError('Failed to change user status');
    }
  }
} 