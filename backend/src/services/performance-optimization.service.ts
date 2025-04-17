import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { createHash } from 'crypto';

export class PerformanceOptimizationService {
  private redis: Redis;

  constructor(
    private prisma: PrismaClient,
    redisUrl: string
  ) {
    this.redis = new Redis(redisUrl);
  }

  async optimizeQueries() {
    const slowQueries = await this.prisma.$queryRaw`
      SELECT query, calls, total_time, mean_time
      FROM pg_stat_statements
      ORDER BY mean_time DESC
      LIMIT 10;
    `;

    const optimizations = [];
    for (const query of slowQueries) {
      // Analyze query and suggest optimizations
      const explanation = await this.prisma.$queryRaw`
        EXPLAIN ANALYZE ${query.query}
      `;

      optimizations.push({
        query: query.query,
        metrics: {
          calls: query.calls,
          totalTime: query.total_time,
          meanTime: query.mean_time
        },
        suggestions: this.analyzePlan(explanation)
      });
    }

    return optimizations;
  }

  async cacheResponse(key: string, data: any, ttl: number = 3600) {
    const hash = this.generateCacheKey(key);
    await this.redis.setex(hash, ttl, JSON.stringify(data));
  }

  async getCachedResponse(key: string) {
    const hash = this.generateCacheKey(key);
    const cached = await this.redis.get(hash);
    return cached ? JSON.parse(cached) : null;
  }

  async invalidateCache(pattern: string) {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private generateCacheKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  private analyzePlan(explanation: any[]) {
    const suggestions = [];

    // Analyze execution plan and provide optimization suggestions
    if (explanation.some(line => line.includes('Seq Scan'))) {
      suggestions.push('Consider adding an index to avoid sequential scans');
    }

    if (explanation.some(line => line.includes('Hash Join'))) {
      suggestions.push('Consider denormalization for frequently joined tables');
    }

    return suggestions;
  }
} 