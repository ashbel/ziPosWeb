import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';
import { ValidationError } from '../utils/errors';

export class CacheService {
  constructor(
    private redis: Redis,
    private logger: Logger
  ) {}

  async get(key: string): Promise<any> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Failed to get cache value for key ${key}:`, error);
      throw new ValidationError('Failed to get cache value');
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }
    } catch (error) {
      this.logger.error(`Failed to set cache value for key ${key}:`, error);
      throw new ValidationError('Failed to set cache value');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logger.error(`Failed to delete cache value for key ${key}:`, error);
      throw new ValidationError('Failed to delete cache value');
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushall();
    } catch (error) {
      this.logger.error('Failed to clear cache:', error);
      throw new ValidationError('Failed to clear cache');
    }
  }

  async getStats(): Promise<{
    totalKeys: number;
    memoryUsage: number;
    hitRate: number;
  }> {
    try {
      const [totalKeys, memoryUsage, hitRate] = await Promise.all([
        this.redis.dbsize(),
        this.redis.info('memory').then(info => {
          const usedMemory = info.match(/used_memory:(\d+)/)?.[1];
          return usedMemory ? parseInt(usedMemory) : 0;
        }),
        this.redis.info('stats').then(info => {
          const hits = info.match(/keyspace_hits:(\d+)/)?.[1] || '0';
          const misses = info.match(/keyspace_misses:(\d+)/)?.[1] || '0';
          const total = parseInt(hits) + parseInt(misses);
          return total > 0 ? parseInt(hits) / total : 0;
        })
      ]);

      return {
        totalKeys,
        memoryUsage,
        hitRate
      };
    } catch (error) {
      this.logger.error('Failed to get cache statistics:', error);
      throw new ValidationError('Failed to get cache statistics');
    }
  }
} 