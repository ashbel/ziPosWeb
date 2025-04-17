import { PrismaClient } from '@prisma/client';
import { EventEmitter } from 'events';
import { register, Gauge, Histogram, Counter } from 'prom-client';
import os from 'os';
import { Redis } from 'ioredis';

export class ComprehensiveMonitoringService extends EventEmitter {
  private metrics = {
    // System Metrics
    systemLoad: new Gauge({
      name: 'system_load_average',
      help: 'System load average over time',
      labelNames: ['interval']
    }),
    memoryUsage: new Gauge({
      name: 'memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type']
    }),
    diskUsage: new Gauge({
      name: 'disk_usage_bytes',
      help: 'Disk usage in bytes',
      labelNames: ['mount']
    }),

    // Application Metrics
    requestDuration: new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5]
    }),
    activeConnections: new Gauge({
      name: 'active_connections',
      help: 'Number of active connections',
      labelNames: ['type']
    }),
    errorRate: new Counter({
      name: 'error_count',
      help: 'Number of errors',
      labelNames: ['type', 'code']
    }),

    // Business Metrics
    transactionValue: new Histogram({
      name: 'transaction_value',
      help: 'Value of transactions',
      labelNames: ['type'],
      buckets: [10, 50, 100, 500, 1000]
    }),
    activeUsers: new Gauge({
      name: 'active_users',
      help: 'Number of active users',
      labelNames: ['type']
    })
  };

  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {
    super();
    this.initializeMonitoring();
  }

  private async initializeMonitoring() {
    // System metrics collection
    setInterval(() => this.collectSystemMetrics(), 15000);

    // Application metrics collection
    setInterval(() => this.collectApplicationMetrics(), 30000);

    // Business metrics collection
    setInterval(() => this.collectBusinessMetrics(), 60000);

    // Error monitoring
    this.setupErrorMonitoring();
  }

  private async collectSystemMetrics() {
    // CPU Load
    const load = os.loadavg();
    this.metrics.systemLoad.set({ interval: '1m' }, load[0]);
    this.metrics.systemLoad.set({ interval: '5m' }, load[1]);
    this.metrics.systemLoad.set({ interval: '15m' }, load[2]);

    // Memory Usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    
    this.metrics.memoryUsage.set({ type: 'total' }, totalMem);
    this.metrics.memoryUsage.set({ type: 'used' }, usedMem);
    this.metrics.memoryUsage.set({ type: 'free' }, freeMem);

    // Process Memory
    const processMemory = process.memoryUsage();
    Object.entries(processMemory).forEach(([type, value]) => {
      this.metrics.memoryUsage.set({ type }, value);
    });

    // Emit metrics for real-time monitoring
    this.emit('system-metrics', {
      load,
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        process: processMemory
      }
    });
  }

  private async collectApplicationMetrics() {
    // Database Connections
    const dbConnections = await this.prisma.$queryRaw`
      SELECT count(*) as count FROM pg_stat_activity;
    `;
    this.metrics.activeConnections.set({ type: 'database' }, dbConnections[0].count);

    // Redis Connections
    const redisInfo = await this.redis.info();
    const connectedClients = parseInt(
      redisInfo.split('\n')
        .find(line => line.startsWith('connected_clients:'))
        ?.split(':')[1] || '0'
    );
    this.metrics.activeConnections.set({ type: 'redis' }, connectedClients);

    // Query Performance
    const slowQueries = await this.prisma.$queryRaw`
      SELECT count(*) as count
      FROM pg_stat_statements
      WHERE mean_time > 1000;
    `;
    this.metrics.errorRate.inc({ type: 'slow_query' }, slowQueries[0].count);

    this.emit('application-metrics', {
      database: {
        connections: dbConnections[0].count,
        slowQueries: slowQueries[0].count
      },
      redis: {
        connections: connectedClients
      }
    });
  }

  private async collectBusinessMetrics() {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Active Users
    const activeUsers = await this.prisma.user.count({
      where: {
        lastActivityAt: {
          gte: hourAgo
        }
      }
    });
    this.metrics.activeUsers.set({ type: 'hourly' }, activeUsers);

    // Transaction Metrics
    const transactions = await this.prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: hourAgo
        }
      },
      select: {
        amount: true,
        type: true
      }
    });

    transactions.forEach(transaction => {
      this.metrics.transactionValue.observe(
        { type: transaction.type },
        transaction.amount
      );
    });

    this.emit('business-metrics', {
      activeUsers,
      transactions: transactions.length,
      totalValue: transactions.reduce((sum, t) => sum + t.amount, 0)
    });
  }

  private setupErrorMonitoring() {
    process.on('uncaughtException', (error) => {
      this.metrics.errorRate.inc({ type: 'uncaught', code: error.name });
      this.emit('error', {
        type: 'uncaught',
        error: error.message,
        stack: error.stack
      });
    });

    process.on('unhandledRejection', (reason: any) => {
      this.metrics.errorRate.inc({ type: 'unhandled_rejection', code: reason?.name });
      this.emit('error', {
        type: 'unhandled_rejection',
        error: reason?.message,
        stack: reason?.stack
      });
    });
  }

  async getMetricsSnapshot() {
    return {
      timestamp: new Date(),
      metrics: await register.getMetricsAsJSON(),
      system: {
        load: os.loadavg(),
        memory: {
          total: os.totalmem(),
          free: os.freemem()
        },
        uptime: os.uptime()
      }
    };
  }
} 