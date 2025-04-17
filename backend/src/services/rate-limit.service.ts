import { BaseService } from './base.service';
import { Redis } from 'ioredis';
import { ValidationError } from '../utils/errors';

interface RateLimitConfig {
  points: number;
  duration: number;
  blockDuration?: number;
}

interface RateLimitInfo {
  remaining: number;
  reset: Date;
  total: number;
  isBlocked: boolean;
  blockedUntil?: Date;
}

export class RateLimitService extends BaseService {
  private readonly redis: Redis;
  private readonly keyPrefix: string;

  constructor(deps: any) {
    super(deps);
    
    this.redis = deps.redis;
    this.keyPrefix = 'ratelimit:';
  }

  async checkLimit(
    key: string,
    config: RateLimitConfig
  ): Promise<RateLimitInfo> {
    const now = Date.now();
    const windowKey = `${this.keyPrefix}${key}:window`;
    const blockKey = `${this.keyPrefix}${key}:blocked`;

    // Check if key is blocked
    const blockExpiry = await this.redis.get(blockKey);
    if (blockExpiry) {
      const blockedUntil = new Date(parseInt(blockExpiry));
      if (blockedUntil > new Date()) {
        return {
          remaining: 0,
          reset: blockedUntil,
          total: config.points,
          isBlocked: true,
          blockedUntil
        };
      }
      // Block expired, remove it
      await this.redis.del(blockKey);
    }

    // Get current window data
    const window = await this.redis.hgetall(windowKey);
    const windowStart = window.start ? parseInt(window.start) : now;
    const windowPoints = window.points ? parseInt(window.points) : 0;

    // Check if window expired
    if (now - windowStart > config.duration) {
      // Start new window
      await this.redis.hmset(windowKey, {
        start: now,
        points: 1
      });
      await this.redis.pexpire(windowKey, config.duration);

      return {
        remaining: config.points - 1,
        reset: new Date(now + config.duration),
        total: config.points,
        isBlocked: false
      };
    }

    // Check points in current window
    if (windowPoints >= config.points) {
      // Rate limit exceeded
      if (config.blockDuration) {
        // Block the key
        const blockedUntil = new Date(now + config.blockDuration);
        await this.redis.set(blockKey, blockedUntil.getTime(), 'PX', config.blockDuration);
        
        return {
          remaining: 0,
          reset: blockedUntil,
          total: config.points,
          isBlocked: true,
          blockedUntil
        };
      }

      return {
        remaining: 0,
        reset: new Date(windowStart + config.duration),
        total: config.points,
        isBlocked: false
      };
    }

    // Increment points
    await this.redis.hincrby(windowKey, 'points', 1);

    return {
      remaining: config.points - windowPoints - 1,
      reset: new Date(windowStart + config.duration),
      total: config.points,
      isBlocked: false
    };
  }

  async getRemainingPoints(
    key: string,
    config: RateLimitConfig
  ): Promise<number> {
    const info = await this.checkLimit(key, config);
    return info.remaining;
  }

  async isBlocked(key: string): Promise<boolean> {
    const blockKey = `${this.keyPrefix}${key}:blocked`;
    const blockExpiry = await this.redis.get(blockKey);
    
    if (!blockExpiry) {
      return false;
    }

    return new Date(parseInt(blockExpiry)) > new Date();
  }

  async clearLimit(key: string): Promise<void> {
    const windowKey = `${this.keyPrefix}${key}:window`;
    const blockKey = `${this.keyPrefix}${key}:blocked`;

    await Promise.all([
      this.redis.del(windowKey),
      this.redis.del(blockKey)
    ]);
  }

  async clearAllLimits(): Promise<void> {
    const keys = await this.redis.keys(`${this.keyPrefix}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
} 