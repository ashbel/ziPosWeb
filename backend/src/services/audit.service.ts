import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { DateTime } from 'luxon';

interface AuditEvent {
  id: string;
  type: string;
  action: string;
  userId?: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, any>;
  timestamp: Date;
  ip?: string;
  userAgent?: string;
}

interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  type?: string[];
  action?: string[];
  resourceType?: string[];
  resourceId?: string;
  limit?: number;
  offset?: number;
  sort?: 'asc' | 'desc';
}

interface AuditSummary {
  totalEvents: number;
  byType: Record<string, number>;
  byAction: Record<string, number>;
  byResource: Record<string, number>;
  byUser: Record<string, number>;
  timeline: Array<{
    date: string;
    count: number;
  }>;
}

interface AuditAlert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  metadata: Record<string, any>;
  timestamp: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

interface ComplianceReport {
  period: string;
  startDate: Date;
  endDate: Date;
  metrics: {
    totalEvents: number;
    securityEvents: number;
    dataAccessEvents: number;
    systemEvents: number;
    userEvents: number;
  };
  violations: Array<{
    type: string;
    count: number;
    details: string[];
  }>;
  recommendations: string[];
}

export class AuditService extends BaseService {
  async logEvent(
    data: Omit<AuditEvent, 'id' | 'timestamp'>
  ): Promise<AuditEvent> {
    return this.prisma.auditEvent.create({
      data: {
        ...data,
        timestamp: new Date()
      }
    });
  }

  async getEvents(query: AuditQuery): Promise<{
    events: AuditEvent[];
    total: number;
  }> {
    const where: any = {};

    if (query.startDate || query.endDate) {
      where.timestamp = {
        ...(query.startDate && { gte: query.startDate }),
        ...(query.endDate && { lte: query.endDate })
      };
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.type?.length) {
      where.type = { in: query.type };
    }

    if (query.action?.length) {
      where.action = { in: query.action };
    }

    if (query.resourceType?.length) {
      where.resourceType = { in: query.resourceType };
    }

    if (query.resourceId) {
      where.resourceId = query.resourceId;
    }

    const [events, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        orderBy: { timestamp: query.sort || 'desc' },
        skip: query.offset || 0,
        take: query.limit || 50
      }),
      this.prisma.auditEvent.count({ where })
    ]);

    return { events, total };
  }

  async getEventSummary(
    query: Omit<AuditQuery, 'limit' | 'offset' | 'sort'>
  ): Promise<AuditSummary> {
    const where: any = {};

    if (query.startDate || query.endDate) {
      where.timestamp = {
        ...(query.startDate && { gte: query.startDate }),
        ...(query.endDate && { lte: query.endDate })
      };
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.type?.length) {
      where.type = { in: query.type };
    }

    if (query.action?.length) {
      where.action = { in: query.action };
    }

    if (query.resourceType?.length) {
      where.resourceType = { in: query.resourceType };
    }

    if (query.resourceId) {
      where.resourceId = query.resourceId;
    }

    const [
      totalEvents,
      byType,
      byAction,
      byResource,
      byUser,
      timeline
    ] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.groupBy({
        by: ['type'],
        where,
        _count: true
      }),
      this.prisma.auditEvent.groupBy({
        by: ['action'],
        where,
        _count: true
      }),
      this.prisma.auditEvent.groupBy({
        by: ['resourceType'],
        where,
        _count: true
      }),
      this.prisma.auditEvent.groupBy({
        by: ['userId'],
        where,
        _count: true
      }),
      this.getTimeline(where)
    ]);

    return {
      totalEvents,
      byType: this.groupByCount(byType),
      byAction: this.groupByCount(byAction),
      byResource: this.groupByCount(byResource),
      byUser: this.groupByCount(byUser),
      timeline
    };
  }

  async getResourceHistory(
    resourceType: string,
    resourceId: string
  ): Promise<AuditEvent[]> {
    return this.prisma.auditEvent.findMany({
      where: {
        resourceType,
        resourceId
      },
      orderBy: { timestamp: 'desc' }
    });
  }

  async getUserActivity(
    userId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    } = {}
  ): Promise<AuditEvent[]> {
    const where: any = { userId };

    if (options.startDate || options.endDate) {
      where.timestamp = {
        ...(options.startDate && { gte: options.startDate }),
        ...(options.endDate && { lte: options.endDate })
      };
    }

    return this.prisma.auditEvent.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: options.limit || 50
    });
  }

  async getAnomalies(
    options: {
      threshold?: number;
      timeWindow?: number;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<Array<{
    userId: string;
    eventCount: number;
    averageCount: number;
    deviation: number;
  }>> {
    const timeWindow = options.timeWindow || 24; // hours
    const threshold = options.threshold || 2; // standard deviations

    const events = await this.prisma.$queryRaw`
      WITH user_counts AS (
        SELECT
          "userId",
          COUNT(*) as event_count,
          AVG(COUNT(*)) OVER () as avg_count,
          STDDEV(COUNT(*)) OVER () as stddev_count
        FROM "AuditEvent"
        WHERE
          "timestamp" >= NOW() - INTERVAL '${timeWindow} HOURS'
          ${options.startDate ? Prisma.sql`AND "timestamp" >= ${options.startDate}` : Prisma.empty}
          ${options.endDate ? Prisma.sql`AND "timestamp" <= ${options.endDate}` : Prisma.empty}
        GROUP BY "userId"
      )
      SELECT
        "userId",
        event_count,
        avg_count,
        (event_count - avg_count) / NULLIF(stddev_count, 0) as deviation
      FROM user_counts
      WHERE ABS((event_count - avg_count) / NULLIF(stddev_count, 0)) > ${threshold}
      ORDER BY deviation DESC
    `;

    return events;
  }

  private async getTimeline(
    where: any
  ): Promise<Array<{ date: string; count: number }>> {
    const events = await this.prisma.auditEvent.groupBy({
      by: ['timestamp'],
      where,
      _count: true
    });

    const timeline = events.map(({ timestamp, _count }) => ({
      date: DateTime.fromJSDate(timestamp).toFormat('yyyy-MM-dd'),
      count: _count
    }));

    return this.aggregateByDate(timeline);
  }

  private aggregateByDate(
    timeline: Array<{ date: string; count: number }>
  ): Array<{ date: string; count: number }> {
    const aggregated = timeline.reduce((acc, { date, count }) => {
      acc[date] = (acc[date] || 0) + count;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(aggregated)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private groupByCount(
    data: Array<{ [key: string]: any; _count: number }>
  ): Record<string, number> {
    return Object.fromEntries(
      data.map(item => [
        Object.keys(item).find(key => key !== '_count')!,
        item._count
      ])
    );
  }

  async createAlert(
    data: Omit<AuditAlert, 'id' | 'timestamp'>
  ): Promise<AuditAlert> {
    return this.prisma.auditAlert.create({
      data: {
        ...data,
        timestamp: new Date()
      }
    });
  }

  async resolveAlert(
    alertId: string,
    userId: string
  ): Promise<AuditAlert> {
    return this.prisma.auditAlert.update({
      where: { id: alertId },
      data: {
        resolvedAt: new Date(),
        resolvedBy: userId
      }
    });
  }

  async generateComplianceReport(
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceReport> {
    const period = `${DateTime.fromJSDate(startDate).toFormat('yyyy-MM-dd')} to ${DateTime.fromJSDate(endDate).toFormat('yyyy-MM-dd')}`;

    const [
      totalEvents,
      securityEvents,
      dataAccessEvents,
      systemEvents,
      userEvents,
      violations
    ] = await Promise.all([
      this.prisma.auditEvent.count({
        where: { timestamp: { gte: startDate, lte: endDate } }
      }),
      this.prisma.auditEvent.count({
        where: {
          timestamp: { gte: startDate, lte: endDate },
          type: 'SECURITY'
        }
      }),
      this.prisma.auditEvent.count({
        where: {
          timestamp: { gte: startDate, lte: endDate },
          type: 'DATA_ACCESS'
        }
      }),
      this.prisma.auditEvent.count({
        where: {
          timestamp: { gte: startDate, lte: endDate },
          type: 'SYSTEM'
        }
      }),
      this.prisma.auditEvent.count({
        where: {
          timestamp: { gte: startDate, lte: endDate },
          type: 'USER'
        }
      }),
      this.findComplianceViolations(startDate, endDate)
    ]);

    const recommendations = this.generateRecommendations(violations);

    return {
      period,
      startDate,
      endDate,
      metrics: {
        totalEvents,
        securityEvents,
        dataAccessEvents,
        systemEvents,
        userEvents
      },
      violations,
      recommendations
    };
  }

  async exportAuditLogs(
    options: {
      startDate?: Date;
      endDate?: Date;
      format?: 'csv' | 'json';
      types?: string[];
    }
  ): Promise<string> {
    const events = await this.prisma.auditEvent.findMany({
      where: {
        ...(options.startDate && { timestamp: { gte: options.startDate } }),
        ...(options.endDate && { timestamp: { lte: options.endDate } }),
        ...(options.types?.length && { type: { in: options.types } })
      },
      orderBy: { timestamp: 'asc' }
    });

    if (options.format === 'csv') {
      return this.convertToCSV(events);
    }

    return JSON.stringify(events, null, 2);
  }

  private async findComplianceViolations(
    startDate: Date,
    endDate: Date
  ): Promise<Array<{
    type: string;
    count: number;
    details: string[];
  }>> {
    const violations = [];

    // Check for unauthorized access attempts
    const unauthorizedAccess = await this.prisma.auditEvent.findMany({
      where: {
        timestamp: { gte: startDate, lte: endDate },
        type: 'SECURITY',
        action: 'ACCESS_DENIED'
      }
    });

    if (unauthorizedAccess.length > 0) {
      violations.push({
        type: 'Unauthorized Access Attempts',
        count: unauthorizedAccess.length,
        details: unauthorizedAccess.map(event =>
          `${event.timestamp}: ${event.metadata.reason} (${event.userId})`
        )
      });
    }

    // Check for sensitive data access
    const sensitiveDataAccess = await this.prisma.auditEvent.findMany({
      where: {
        timestamp: { gte: startDate, lte: endDate },
        type: 'DATA_ACCESS',
        resourceType: 'SENSITIVE_DATA'
      }
    });

    if (sensitiveDataAccess.length > 0) {
      violations.push({
        type: 'Sensitive Data Access',
        count: sensitiveDataAccess.length,
        details: sensitiveDataAccess.map(event =>
          `${event.timestamp}: ${event.resourceId} accessed by ${event.userId}`
        )
      });
    }

    return violations;
  }

  private generateRecommendations(
    violations: Array<{
      type: string;
      count: number;
      details: string[];
    }>
  ): string[] {
    const recommendations: string[] = [];

    for (const violation of violations) {
      switch (violation.type) {
        case 'Unauthorized Access Attempts':
          if (violation.count > 10) {
            recommendations.push(
              'Review and strengthen access control policies'
            );
            recommendations.push(
              'Implement additional authentication factors for sensitive resources'
            );
          }
          break;

        case 'Sensitive Data Access':
          if (violation.count > 5) {
            recommendations.push(
              'Review and update data access permissions'
            );
            recommendations.push(
              'Implement data access monitoring and alerting'
            );
          }
          break;
      }
    }

    return [...new Set(recommendations)];
  }

  private convertToCSV(events: AuditEvent[]): string {
    const headers = [
      'ID',
      'Type',
      'Action',
      'User ID',
      'Resource Type',
      'Resource ID',
      'Timestamp',
      'IP',
      'User Agent',
      'Metadata'
    ];

    const rows = events.map(event => [
      event.id,
      event.type,
      event.action,
      event.userId || '',
      event.resourceType,
      event.resourceId,
      event.timestamp.toISOString(),
      event.ip || '',
      event.userAgent || '',
      JSON.stringify(event.metadata)
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
  }
} 