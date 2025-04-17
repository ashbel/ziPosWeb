import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { ElasticsearchTransport } from 'winston-elasticsearch';
import { Client } from '@elastic/elasticsearch';
import { Redis } from 'ioredis';
import { DateTime } from 'luxon';

interface LogConfig {
  level: string;
  format: string;
  outputs: Array<'file' | 'console' | 'elasticsearch'>;
  retention?: number;
  elasticsearch?: {
    index: string;
    flushInterval?: number;
  };
}

interface LogQuery {
  level?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  context?: string;
  limit?: number;
  offset?: number;
  sort?: 'asc' | 'desc';
}

interface LogContext {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  [key: string]: any;
}

export class LoggingService extends BaseService {
  private logger: winston.Logger;
  private elastic: Client;
  private readonly logPath: string;
  private readonly defaultRetention = 30; // days

  constructor(deps: any) {
    super(deps);
    this.logPath = process.env.LOG_PATH || './logs';
    this.elastic = new Client({
      node: process.env.ELASTICSEARCH_URL
    });

    this.initializeLogger();
  }

  async log(
    level: string,
    message: string,
    context?: LogContext,
    error?: Error
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date(),
      level,
      message,
      context: this.sanitizeContext(context),
      error: error ? this.formatError(error) : undefined,
      hostname: process.env.HOSTNAME,
      environment: process.env.NODE_ENV
    };

    this.logger.log(level, message, logEntry);

    // Store in database for quick access to recent logs
    await this.prisma.log.create({
      data: {
        level,
        message,
        context: logEntry.context,
        error: logEntry.error,
        timestamp: logEntry.timestamp
      }
    });
  }

  async query(params: LogQuery): Promise<{
    logs: any[];
    total: number;
    aggregations?: any;
  }> {
    const esQuery = this.buildElasticsearchQuery(params);

    try {
      const response = await this.elastic.search({
        index: 'logs-*',
        body: esQuery
      });

      return {
        logs: response.hits.hits.map(hit => ({
          ...hit._source,
          id: hit._id,
          score: hit._score
        })),
        total: response.hits.total.value,
        aggregations: response.aggregations
      };
    } catch (error) {
      // Fallback to database query if Elasticsearch fails
      return this.queryDatabase(params);
    }
  }

  async getLogStream(
    level: string = 'info',
    callback: (log: any) => void
  ): Promise<() => void> {
    const transport = new winston.transports.Stream({
      stream: new winston.PassThrough()
    });

    transport.on('data', callback);
    this.logger.add(transport);

    // Return cleanup function
    return () => this.logger.remove(transport);
  }

  async exportLogs(
    params: LogQuery,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const { logs } = await this.query(params);

    if (format === 'csv') {
      return this.convertToCSV(logs);
    }

    return JSON.stringify(logs, null, 2);
  }

  async rotateLogs(): Promise<void> {
    // Rotation is handled by winston-daily-rotate-file
    // This method is for manual rotation if needed
    await this.logger.transports.forEach(transport => {
      if (transport instanceof DailyRotateFile) {
        transport.rotate();
      }
    });
  }

  async cleanOldLogs(): Promise<number> {
    const cutoffDate = DateTime.now()
      .minus({ days: this.defaultRetention })
      .toJSDate();

    // Clean database logs
    const { count } = await this.prisma.log.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate
        }
      }
    });

    // Clean Elasticsearch logs
    await this.elastic.deleteByQuery({
      index: 'logs-*',
      body: {
        query: {
          range: {
            timestamp: {
              lt: cutoffDate.toISOString()
            }
          }
        }
      }
    });

    return count;
  }

  async getLogStats(period: 'hour' | 'day' | 'week'): Promise<{
    totalLogs: number;
    errorCount: number;
    warningCount: number;
    topErrors: Array<{ message: string; count: number }>;
    levelDistribution: Record<string, number>;
  }> {
    const startDate = DateTime.now()
      .minus({ [period]: 1 })
      .toJSDate();

    const [
      totalLogs,
      errorCount,
      warningCount,
      topErrors,
      levelDistribution
    ] = await Promise.all([
      // Total logs
      this.prisma.log.count({
        where: {
          timestamp: {
            gte: startDate
          }
        }
      }),

      // Error count
      this.prisma.log.count({
        where: {
          level: 'error',
          timestamp: {
            gte: startDate
          }
        }
      }),

      // Warning count
      this.prisma.log.count({
        where: {
          level: 'warn',
          timestamp: {
            gte: startDate
          }
        }
      }),

      // Top errors
      this.prisma.log.groupBy({
        by: ['message'],
        where: {
          level: 'error',
          timestamp: {
            gte: startDate
          }
        },
        _count: true,
        orderBy: {
          _count: {
            message: 'desc'
          }
        },
        take: 10
      }),

      // Level distribution
      this.prisma.log.groupBy({
        by: ['level'],
        where: {
          timestamp: {
            gte: startDate
          }
        },
        _count: true
      })
    ]);

    return {
      totalLogs,
      errorCount,
      warningCount,
      topErrors: topErrors.map(error => ({
        message: error.message,
        count: error._count.message
      })),
      levelDistribution: levelDistribution.reduce(
        (acc, { level, _count }) => ({
          ...acc,
          [level]: _count
        }),
        {}
      )
    };
  }

  private initializeLogger(): void {
    const config = this.getLogConfig();

    const transports: winston.transport[] = [];

    if (config.outputs.includes('file')) {
      transports.push(
        new DailyRotateFile({
          dirname: this.logPath,
          filename: 'application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxFiles: `${config.retention}d`,
          format: this.getLogFormat(config.format)
        })
      );
    }

    if (config.outputs.includes('console')) {
      transports.push(
        new winston.transports.Console({
          format: this.getLogFormat(config.format)
        })
      );
    }

    if (config.outputs.includes('elasticsearch')) {
      transports.push(
        new ElasticsearchTransport({
          level: config.level,
          client: this.elastic,
          options: {
            index: config.elasticsearch?.index || 'logs',
            flushInterval: config.elasticsearch?.flushInterval || 2000
          }
        })
      );
    }

    this.logger = winston.createLogger({
      level: config.level,
      transports
    });
  }

  private getLogConfig(): LogConfig {
    // Load from environment or configuration file
    return {
      level: process.env.LOG_LEVEL || 'info',
      format: process.env.LOG_FORMAT || 'json',
      outputs: (process.env.LOG_OUTPUTS || 'console,file').split(',') as any,
      retention: parseInt(process.env.LOG_RETENTION || '30'),
      elasticsearch: {
        index: process.env.LOG_ES_INDEX || 'logs',
        flushInterval: parseInt(process.env.LOG_ES_FLUSH_INTERVAL || '2000')
      }
    };
  }

  private getLogFormat(format: string): winston.Logform.Format {
    switch (format) {
      case 'json':
        return winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        );
      case 'simple':
        return winston.format.combine(
          winston.format.timestamp(),
          winston.format.simple()
        );
      default:
        return winston.format.json();
    }
  }

  private sanitizeContext(context?: LogContext): any {
    if (!context) return {};

    // Remove sensitive information
    const sanitized = { ...context };
    const sensitiveFields = ['password', 'token', 'secret', 'key'];

    sensitiveFields.forEach(field => {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private formatError(error: Error): any {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name,
      ...error
    };
  }

  private buildElasticsearchQuery(params: LogQuery): any {
    const query: any = {
      bool: {
        must: []
      }
    };

    if (params.level) {
      query.bool.must.push({ match: { level: params.level } });
    }

    if (params.search) {
      query.bool.must.push({
        multi_match: {
          query: params.search,
          fields: ['message', 'context.*', 'error.message']
        }
      });
    }

    if (params.context) {
      query.bool.must.push({
        match: { 'context.type': params.context }
      });
    }

    if (params.startDate || params.endDate) {
      query.bool.must.push({
        range: {
          timestamp: {
            ...(params.startDate && { gte: params.startDate.toISOString() }),
            ...(params.endDate && { lte: params.endDate.toISOString() })
          }
        }
      });
    }

    return {
      query,
      sort: [{ timestamp: params.sort || 'desc' }],
      from: params.offset || 0,
      size: params.limit || 10,
      aggs: {
        levels: {
          terms: { field: 'level.keyword' }
        },
        timeline: {
          date_histogram: {
            field: 'timestamp',
            calendar_interval: 'hour'
          }
        }
      }
    };
  }

  private async queryDatabase(params: LogQuery): Promise<{
    logs: any[];
    total: number;
  }> {
    const where: any = {};

    if (params.level) {
      where.level = params.level;
    }

    if (params.startDate || params.endDate) {
      where.timestamp = {
        ...(params.startDate && { gte: params.startDate }),
        ...(params.endDate && { lte: params.endDate })
      };
    }

    if (params.search) {
      where.OR = [
        { message: { contains: params.search } },
        { context: { path: ['$.message'], string_contains: params.search } }
      ];
    }

    const [logs, total] = await Promise.all([
      this.prisma.log.findMany({
        where,
        orderBy: { timestamp: params.sort || 'desc' },
        skip: params.offset || 0,
        take: params.limit || 10
      }),
      this.prisma.log.count({ where })
    ]);

    return { logs, total };
  }

  private convertToCSV(logs: any[]): string {
    if (logs.length === 0) return '';

    const headers = Object.keys(logs[0]);
    const rows = logs.map(log =>
      headers.map(header => {
        const value = log[header];
        return typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
      })
    );

    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  }
} 