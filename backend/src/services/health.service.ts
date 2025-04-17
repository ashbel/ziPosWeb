import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { Redis } from 'ioredis';
import { Client } from '@elastic/elasticsearch';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { DateTime } from 'luxon';

const execAsync = promisify(exec);

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: {
    uptime: number;
    memory: {
      total: number;
      used: number;
      free: number;
      percentage: number;
    };
    cpu: {
      loadAverage: number[];
      usage: number;
    };
    disk: {
      total: number;
      used: number;
      free: number;
      percentage: number;
    };
    services: Record<string, {
      status: 'up' | 'down';
      latency: number;
      lastCheck: Date;
    }>;
  };
}

interface ServiceCheck {
  name: string;
  type: 'http' | 'tcp' | 'custom';
  endpoint?: string;
  timeout?: number;
  interval?: number;
  healthyThreshold?: number;
  unhealthyThreshold?: number;
  customCheck?: () => Promise<boolean>;
}

export class HealthService extends BaseService {
  private checks: Map<string, ServiceCheck>;
  private checkResults: Map<string, {
    status: 'up' | 'down';
    latency: number;
    lastCheck: Date;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
  }>;
  private readonly defaultInterval = 60000; // 1 minute
  private readonly defaultTimeout = 5000; // 5 seconds

  constructor(deps: any) {
    super(deps);
    this.checks = new Map();
    this.checkResults = new Map();
    this.initializeHealthChecks();
  }

  async getHealth(): Promise<HealthStatus> {
    const [memory, cpu, disk, services] = await Promise.all([
      this.getMemoryStatus(),
      this.getCPUStatus(),
      this.getDiskStatus(),
      this.getServicesStatus()
    ]);

    const status = this.determineOverallStatus(services);

    return {
      status,
      details: {
        uptime: process.uptime(),
        memory,
        cpu,
        disk,
        services
      }
    };
  }

  async checkService(name: string): Promise<{
    status: 'up' | 'down';
    latency: number;
    details?: any;
  }> {
    const check = this.checks.get(name);
    if (!check) {
      throw new ValidationError(`Service check ${name} not found`);
    }

    const startTime = Date.now();
    try {
      switch (check.type) {
        case 'http':
          await this.performHttpCheck(check.endpoint!);
          break;
        case 'tcp':
          await this.performTcpCheck(check.endpoint!);
          break;
        case 'custom':
          if (!check.customCheck) {
            throw new Error('Custom check not implemented');
          }
          await check.customCheck();
          break;
      }

      const latency = Date.now() - startTime;
      this.updateCheckResult(name, 'up', latency);

      return {
        status: 'up',
        latency
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateCheckResult(name, 'down', latency);

      return {
        status: 'down',
        latency,
        details: error.message
      };
    }
  }

  async registerCheck(check: ServiceCheck): Promise<void> {
    this.validateCheck(check);
    this.checks.set(check.name, check);
    
    // Initialize check result
    this.checkResults.set(check.name, {
      status: 'down',
      latency: 0,
      lastCheck: new Date(),
      consecutiveFailures: 0,
      consecutiveSuccesses: 0
    });

    // Start periodic checking
    this.startPeriodicCheck(check);
  }

  async unregisterCheck(name: string): Promise<void> {
    this.checks.delete(name);
    this.checkResults.delete(name);
  }

  async getMetrics(): Promise<{
    requestsPerSecond: number;
    averageResponseTime: number;
    errorRate: number;
    activeConnections: number;
  }> {
    // These metrics would typically come from your metrics collection system
    // This is a simplified implementation
    return {
      requestsPerSecond: await this.getRequestRate(),
      averageResponseTime: await this.getAverageResponseTime(),
      errorRate: await this.getErrorRate(),
      activeConnections: await this.getActiveConnections()
    };
  }

  private async initializeHealthChecks(): Promise<void> {
    // Register default service checks
    await this.registerCheck({
      name: 'database',
      type: 'custom',
      interval: 30000,
      customCheck: async () => {
        await this.prisma.$queryRaw`SELECT 1`;
        return true;
      }
    });

    await this.registerCheck({
      name: 'redis',
      type: 'custom',
      interval: 30000,
      customCheck: async () => {
        await this.redis.ping();
        return true;
      }
    });

    await this.registerCheck({
      name: 'elasticsearch',
      type: 'http',
      endpoint: process.env.ELASTICSEARCH_URL,
      interval: 60000
    });

    // Add more service checks as needed
  }

  private async getMemoryStatus() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const percentage = (used / total) * 100;

    return {
      total,
      used,
      free,
      percentage
    };
  }

  private async getCPUStatus() {
    const loadAverage = os.loadavg();
    const cpus = os.cpus();
    const totalIdle = cpus.reduce((acc, cpu) => acc + cpu.times.idle, 0);
    const totalTick = cpus.reduce(
      (acc, cpu) =>
        acc + Object.values(cpu.times).reduce((sum, time) => sum + time, 0),
      0
    );
    const usage = ((totalTick - totalIdle) / totalTick) * 100;

    return {
      loadAverage,
      usage
    };
  }

  private async getDiskStatus() {
    const { stdout } = await execAsync('df -k /');
    const [, total, used, free] = stdout
      .split('\n')[1]
      .split(/\s+/)
      .map(Number);

    return {
      total: total * 1024,
      used: used * 1024,
      free: free * 1024,
      percentage: (used / total) * 100
    };
  }

  private async getServicesStatus() {
    const services: Record<string, {
      status: 'up' | 'down';
      latency: number;
      lastCheck: Date;
    }> = {};

    for (const [name, result] of this.checkResults.entries()) {
      services[name] = {
        status: result.status,
        latency: result.latency,
        lastCheck: result.lastCheck
      };
    }

    return services;
  }

  private determineOverallStatus(
    services: Record<string, { status: 'up' | 'down' }>
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(services).map(s => s.status);
    const downCount = statuses.filter(s => s === 'down').length;

    if (downCount === 0) return 'healthy';
    if (downCount < statuses.length / 2) return 'degraded';
    return 'unhealthy';
  }

  private async performHttpCheck(url: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP check failed: ${response.status}`);
    }
  }

  private async performTcpCheck(endpoint: string): Promise<void> {
    const [host, port] = endpoint.split(':');
    const socket = new net.Socket();

    return new Promise((resolve, reject) => {
      socket.connect(parseInt(port), host, () => {
        socket.end();
        resolve();
      });

      socket.on('error', reject);
    });
  }

  private validateCheck(check: ServiceCheck): void {
    if (!check.name) {
      throw new ValidationError('Check name is required');
    }

    if (!['http', 'tcp', 'custom'].includes(check.type)) {
      throw new ValidationError(`Invalid check type: ${check.type}`);
    }

    if (check.type !== 'custom' && !check.endpoint) {
      throw new ValidationError('Endpoint is required for HTTP and TCP checks');
    }

    if (check.type === 'custom' && !check.customCheck) {
      throw new ValidationError('Custom check function is required');
    }
  }

  private startPeriodicCheck(check: ServiceCheck): void {
    const interval = check.interval || this.defaultInterval;

    setInterval(async () => {
      try {
        await this.checkService(check.name);
      } catch (error) {
        this.logger.error(`Health check failed for ${check.name}:`, error);
      }
    }, interval);
  }

  private updateCheckResult(
    name: string,
    status: 'up' | 'down',
    latency: number
  ): void {
    const check = this.checks.get(name);
    const result = this.checkResults.get(name);

    if (!check || !result) return;

    const newResult = {
      ...result,
      status,
      latency,
      lastCheck: new Date(),
      consecutiveFailures: status === 'down'
        ? result.consecutiveFailures + 1
        : 0,
      consecutiveSuccesses: status === 'up'
        ? result.consecutiveSuccesses + 1
        : 0
    };

    this.checkResults.set(name, newResult);

    // Emit status change event if threshold reached
    if (
      (status === 'down' &&
        newResult.consecutiveFailures === (check.unhealthyThreshold || 3)) ||
      (status === 'up' &&
        newResult.consecutiveSuccesses === (check.healthyThreshold || 2))
    ) {
      this.emitSocketEvent('health:status', {
        service: name,
        status,
        timestamp: new Date()
      });
    }
  }

  private async getRequestRate(): Promise<number> {
    const now = DateTime.now();
    const minuteAgo = now.minus({ minutes: 1 });

    const requests = await this.prisma.requestLog.count({
      where: {
        timestamp: {
          gte: minuteAgo.toJSDate(),
          lte: now.toJSDate()
        }
      }
    });

    return requests / 60; // Requests per second
  }

  private async getAverageResponseTime(): Promise<number> {
    const now = DateTime.now();
    const minuteAgo = now.minus({ minutes: 1 });

    const result = await this.prisma.requestLog.aggregate({
      where: {
        timestamp: {
          gte: minuteAgo.toJSDate(),
          lte: now.toJSDate()
        }
      },
      _avg: {
        duration: true
      }
    });

    return result._avg.duration || 0;
  }

  private async getErrorRate(): Promise<number> {
    const now = DateTime.now();
    const minuteAgo = now.minus({ minutes: 1 });

    const [total, errors] = await Promise.all([
      this.prisma.requestLog.count({
        where: {
          timestamp: {
            gte: minuteAgo.toJSDate(),
            lte: now.toJSDate()
          }
        }
      }),
      this.prisma.requestLog.count({
        where: {
          timestamp: {
            gte: minuteAgo.toJSDate(),
            lte: now.toJSDate()
          },
          status: {
            gte: 400
          }
        }
      })
    ]);

    return total > 0 ? (errors / total) * 100 : 0;
  }

  private async getActiveConnections(): Promise<number> {
    // This would typically come from your web server metrics
    // This is a placeholder implementation
    return 0;
  }
} 