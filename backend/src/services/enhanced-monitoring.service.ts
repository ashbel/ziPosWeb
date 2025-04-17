import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { createNodeRedisClient } from 'handy-redis';
import { Gauge, Counter, register } from 'prom-client';

export class EnhancedMonitoringService extends EventEmitter {
  private redis = createNodeRedisClient();
  private metrics = {
    apiLatency: new Gauge({
      name: 'api_request_latency',
      help: 'API request latency in milliseconds',
      labelNames: ['endpoint']
    }),
    errorRate: new Counter({
      name: 'error_rate',
      help: 'Number of errors',
      labelNames: ['type']
    }),
    activeUsers: new Gauge({
      name: 'active_users',
      help: 'Number of active users'
    }),
    databaseConnections: new Gauge({
      name: 'database_connections',
      help: 'Number of active database connections'
    })
  };

  constructor(private prisma: PrismaClient) {
    super();
    this.initializeMonitoring();
  }

  private async initializeMonitoring() {
    // Monitor database health
    setInterval(async () => {
      const metrics = await this.getDatabaseMetrics();
      this.emit('database-metrics', metrics);
      this.metrics.databaseConnections.set(metrics.connections);
    }, 30000);

    // Monitor API health
    setInterval(async () => {
      const metrics = await this.getApiMetrics();
      this.emit('api-metrics', metrics);
      Object.entries(metrics.latency).forEach(([endpoint, latency]) => {
        this.metrics.apiLatency.set({ endpoint }, latency);
      });
    }, 10000);

    // Monitor active users
    setInterval(async () => {
      const activeUsers = await this.getActiveUsers();
      this.emit('active-users', activeUsers);
      this.metrics.activeUsers.set(activeUsers);
    }, 60000);
  }

  async getDatabaseMetrics() {
    const metrics = await this.prisma.$queryRaw`
      SELECT
        (SELECT count(*) FROM pg_stat_activity) as connections,
        pg_database_size(current_database()) as db_size,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_queries,
        (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_queries,
        (SELECT count(*) FROM pg_stat_activity WHERE wait_event_type IS NOT NULL) as waiting_queries
    `;

    return metrics;
  }

  async getApiMetrics() {
    const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
    
    const metrics = await this.prisma.apiUsage.groupBy({
      by: ['endpoint'],
      where: {
        createdAt: { gte: last5Minutes }
      },
      _avg: {
        responseTime: true
      },
      _count: {
        id: true
      }
    });

    return {
      latency: metrics.reduce((acc, m) => ({
        ...acc,
        [m.endpoint]: m._avg.responseTime
      }), {}),
      requestCounts: metrics.reduce((acc, m) => ({
        ...acc,
        [m.endpoint]: m._count.id
      }), {})
    };
  }

  async getActiveUsers() {
    const last15Minutes = new Date(Date.now() - 15 * 60 * 1000);
    return this.prisma.userSession.count({
      where: {
        lastActivity: { gte: last15Minutes }
      }
    });
  }

  async getSystemAlerts() {
    const alerts = [];

    // Check database connection count
    const dbMetrics = await this.getDatabaseMetrics();
    if (dbMetrics.connections > 100) {
      alerts.push({
        level: 'warning',
        message: 'High number of database connections',
        metric: dbMetrics.connections
      });
    }

    // Check API response times
    const apiMetrics = await this.getApiMetrics();
    Object.entries(apiMetrics.latency).forEach(([endpoint, latency]) => {
      if (latency > 1000) {
        alerts.push({
          level: 'error',
          message: `Slow API response time for ${endpoint}`,
          metric: latency
        });
      }
    });

    // Check disk usage
    const diskUsage = await this.getDiskUsage();
    if (diskUsage.percentUsed > 85) {
      alerts.push({
        level: 'critical',
        message: 'High disk usage',
        metric: diskUsage.percentUsed
      });
    }

    return alerts;
  }

  async getDiskUsage() {
    // Implementation depends on the system
    return { percentUsed: 0 }; // Placeholder
  }

  async getMetricsSnapshot() {
    return {
      timestamp: new Date(),
      metrics: await register.getMetricsAsJSON(),
      alerts: await this.getSystemAlerts()
    };
  }
} 