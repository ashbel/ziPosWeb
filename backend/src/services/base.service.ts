import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';
import { NotFoundError, ValidationError } from '../utils/errors';

export class BaseService {
  protected prisma: PrismaClient;
  protected redis: Redis;
  protected logger: Logger;

  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    this.prisma = prisma;
    this.redis = redis;
    this.logger = logger;
  }

  protected async getCached<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = 3600
  ): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }

    const data = await fetchFn();
    await this.redis.setex(key, ttl, JSON.stringify(data));
    return data;
  }

  protected async invalidateCache(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  protected handleError(error: any): never {
    this.logger.error('Service error:', error);

    if (error.code === 'P2025') {
      throw new NotFoundError('Record not found');
    }

    if (error.code === 'P2002') {
      throw new ValidationError('Unique constraint violation');
    }

    throw error;
  }
} 