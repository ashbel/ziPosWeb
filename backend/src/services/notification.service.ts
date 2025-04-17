import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { Queue } from 'bull';
import { Redis } from 'ioredis';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { Twilio } from 'twilio';
import { WebPushService } from './web-push.service';
import { EmailService } from './email.service';
import { DateTime } from 'luxon';

interface NotificationTemplate {
  id: string;
  name: string;
  type: 'push' | 'email' | 'sms' | 'in-app';
  title?: string;
  body: string;
  data?: Record<string, any>;
  channels?: string[];
  variables: string[];
  preview?: string;
  version: number;
  isActive: boolean;
}

interface NotificationPreferences {
  userId: string;
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
    inApp: boolean;
  };
  quiet_hours?: {
    start: string; // HH:mm
    end: string; // HH:mm
    timezone: string;
  };
}

interface NotificationPayload {
  userId: string;
  template: string;
  data?: Record<string, any>;
  priority?: 'high' | 'normal' | 'low';
  channels?: string[];
  scheduledFor?: Date;
}

interface NotificationGroup {
  id: string;
  name: string;
  description?: string;
  rules: NotificationRule[];
}

interface NotificationRule {
  id: string;
  type: 'event' | 'schedule' | 'condition';
  event?: string;
  schedule?: string;
  condition?: string;
  template: string;
  priority?: 'high' | 'normal' | 'low';
  channels?: string[];
}

interface NotificationMetrics {
  total: number;
  read: number;
  unread: number;
  byChannel: Record<string, number>;
  byStatus: Record<string, number>;
  deliveryRate: number;
  readRate: number;
}

interface DeliveryStatus {
  id: string;
  notificationId: string;
  channel: string;
  status: 'sent' | 'delivered' | 'failed' | 'bounced';
  timestamp: Date;
  error?: string;
}

export class NotificationService extends BaseService {
  private notificationQueue: Queue;
  private expo: Expo;
  private twilio: Twilio;
  private webPush: WebPushService;
  private emailService: EmailService;
  private readonly redis: Redis;

  constructor(deps: any) {
    super(deps);
    
    this.redis = deps.redis;
    this.emailService = deps.emailService;
    this.webPush = deps.webPush;

    this.expo = new Expo();
    this.twilio = new Twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    this.initializeQueue();
  }

  async sendNotification(payload: NotificationPayload): Promise<void> {
    try {
      // Validate payload
      await this.validatePayload(payload);

      // Get user preferences
      const preferences = await this.getUserPreferences(payload.userId);

      // Get notification template
      const template = await this.getTemplate(payload.template);

      // Check quiet hours
      const isQuietHours = await this.isInQuietHours(
        payload.userId,
        preferences
      );

      // Prepare notification data
      const notificationData = await this.prepareNotificationData(
        template,
        payload.data
      );

      // Create notification record
      const notification = await this.createNotificationRecord(
        payload,
        notificationData
      );

      // Determine channels to use
      const channels = this.determineChannels(
        template,
        preferences,
        payload.channels,
        isQuietHours
      );

      // Queue notifications for each channel
      await this.queueNotifications(
        notification.id,
        channels,
        notificationData,
        payload
      );
    } catch (error) {
      this.logger.error('Notification send error:', error);
      throw error;
    }
  }

  async sendBulkNotifications(
    payloads: NotificationPayload[]
  ): Promise<void> {
    const operations = payloads.map(payload =>
      this.sendNotification(payload)
    );
    await Promise.all(operations);
  }

  async createTemplate(
    data: {
      name: string;
      type: 'push' | 'email' | 'sms' | 'in-app';
      title?: string;
      body: string;
      variables: string[];
      preview?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<NotificationTemplate> {
    const template = await this.prisma.notificationTemplate.create({
      data: {
        ...data,
        version: 1,
        isActive: true
      }
    });

    await this.validateTemplate(template);
    return template;
  }

  async updateTemplate(
    id: string,
    data: Partial<NotificationTemplate>
  ): Promise<NotificationTemplate> {
    const currentTemplate = await this.prisma.notificationTemplate.findUnique({
      where: { id }
    });

    if (!currentTemplate) {
      throw new ValidationError('Template not found');
    }

    const template = await this.prisma.notificationTemplate.update({
      where: { id },
      data: {
        ...data,
        version: currentTemplate.version + 1
      }
    });

    await this.validateTemplate(template);
    return template;
  }

  async updatePreferences(
    userId: string,
    preferences: Partial<NotificationPreferences>
  ): Promise<void> {
    await this.prisma.notificationPreferences.upsert({
      where: { userId },
      update: preferences,
      create: {
        userId,
        ...preferences
      }
    });

    // Invalidate cache
    await this.redis.del(`preferences:${userId}`);
  }

  async getNotificationHistory(
    userId: string,
    options: {
      status?: string;
      type?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const where: any = { userId };

    if (options.status) {
      where.status = options.status;
    }
    if (options.type) {
      where.type = options.type;
    }
    if (options.startDate || options.endDate) {
      where.createdAt = {
        ...(options.startDate && { gte: options.startDate }),
        ...(options.endDate && { lte: options.endDate })
      };
    }

    return this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options.limit || 10,
      skip: options.offset || 0
    });
  }

  async markAsRead(
    userId: string,
    notificationId: string
  ): Promise<void> {
    await this.prisma.notification.update({
      where: {
        id: notificationId,
        userId
      },
      data: {
        readAt: new Date()
      }
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null
      },
      data: {
        readAt: new Date()
      }
    });
  }

  private initializeQueue(): void {
    this.notificationQueue = new Queue('notifications', {
      redis: this.redis as any,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000
        },
        removeOnComplete: true
      }
    });

    this.setupQueueHandlers();
  }

  private setupQueueHandlers(): void {
    this.notificationQueue.process('push', async job => {
      const { tokens, notification } = job.data;
      await this.sendPushNotification(tokens, notification);
    });

    this.notificationQueue.process('sms', async job => {
      const { phoneNumber, message } = job.data;
      await this.sendSMS(phoneNumber, message);
    });

    this.notificationQueue.process('web-push', async job => {
      const { subscription, notification } = job.data;
      await this.sendWebPushNotification(subscription, notification);
    });

    this.notificationQueue.on('failed', async (job, error) => {
      await this.handleNotificationFailure(job.data.notificationId, error);
    });
  }

  private async validatePayload(
    payload: NotificationPayload
  ): Promise<void> {
    if (!payload.userId) {
      throw new ValidationError('User ID is required');
    }

    if (!payload.template) {
      throw new ValidationError('Template is required');
    }

    if (
      payload.scheduledFor &&
      payload.scheduledFor < new Date()
    ) {
      throw new ValidationError('Scheduled date must be in the future');
    }
  }

  private async getUserPreferences(
    userId: string
  ): Promise<NotificationPreferences> {
    // Try cache first
    const cached = await this.redis.get(`preferences:${userId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from database
    const preferences = await this.prisma.notificationPreferences.findUnique({
      where: { userId }
    }) || {
      userId,
      channels: {
        push: true,
        email: true,
        sms: true,
        inApp: true
      }
    };

    // Cache preferences
    await this.redis.setex(
      `preferences:${userId}`,
      3600,
      JSON.stringify(preferences)
    );

    return preferences;
  }

  private async getTemplate(
    templateName: string
  ): Promise<NotificationTemplate> {
    const template = await this.prisma.notificationTemplate.findFirst({
      where: { name: templateName }
    });

    if (!template) {
      throw new ValidationError(`Template ${templateName} not found`);
    }

    return template;
  }

  private async isInQuietHours(
    userId: string,
    preferences: NotificationPreferences
  ): Promise<boolean> {
    if (!preferences.quiet_hours) return false;

    const { start, end, timezone } = preferences.quiet_hours;
    const now = DateTime.now().setZone(timezone);
    const startTime = DateTime.fromFormat(start, 'HH:mm', { zone: timezone });
    const endTime = DateTime.fromFormat(end, 'HH:mm', { zone: timezone });

    return now >= startTime && now <= endTime;
  }

  private async prepareNotificationData(
    template: NotificationTemplate,
    data?: Record<string, any>
  ): Promise<{
    title: string;
    body: string;
    data?: Record<string, any>;
  }> {
    // Compile template with data
    const compiled = await this.compileTemplate(template, data);

    return {
      title: compiled.title || template.title || '',
      body: compiled.body,
      data: {
        ...template.data,
        ...data
      }
    };
  }

  private async compileTemplate(
    template: NotificationTemplate,
    data?: Record<string, any>
  ): Promise<{ title?: string; body: string }> {
    // Simple template compilation
    let title = template.title;
    let body = template.body;

    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        if (title) title = title.replace(regex, value);
        body = body.replace(regex, value);
      });
    }

    return { title, body };
  }

  private determineChannels(
    template: NotificationTemplate,
    preferences: NotificationPreferences,
    requestedChannels?: string[],
    isQuietHours?: boolean
  ): string[] {
    const channels = new Set<string>();

    // Start with template channels
    if (template.channels) {
      template.channels.forEach(channel => channels.add(channel));
    }

    // Filter by requested channels
    if (requestedChannels) {
      channels.forEach(channel => {
        if (!requestedChannels.includes(channel)) {
          channels.delete(channel);
        }
      });
    }

    // Filter by user preferences
    channels.forEach(channel => {
      const key = channel as keyof typeof preferences.channels;
      if (!preferences.channels[key]) {
        channels.delete(channel);
      }
    });

    // During quiet hours, only allow critical notifications
    if (isQuietHours) {
      channels.clear();
      channels.add('inApp'); // Always allow in-app notifications
    }

    return Array.from(channels);
  }

  private async createNotificationRecord(
    payload: NotificationPayload,
    data: any
  ) {
    return this.prisma.notification.create({
      data: {
        userId: payload.userId,
        template: payload.template,
        title: data.title,
        body: data.body,
        data: data.data,
        status: 'pending',
        scheduledFor: payload.scheduledFor
      }
    });
  }

  private async queueNotifications(
    notificationId: string,
    channels: string[],
    data: any,
    payload: NotificationPayload
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId }
    });

    if (!user) {
      throw new ValidationError('User not found');
    }

    const jobs = [];

    for (const channel of channels) {
      const jobData = {
        notificationId,
        userId: payload.userId,
        ...data
      };

      switch (channel) {
        case 'push':
          if (user.pushTokens?.length) {
            jobs.push({
              name: 'push',
              data: {
                ...jobData,
                tokens: user.pushTokens
              }
            });
          }
          break;

        case 'sms':
          if (user.phone) {
            jobs.push({
              name: 'sms',
              data: {
                ...jobData,
                phoneNumber: user.phone,
                message: data.body
              }
            });
          }
          break;

        case 'email':
          if (user.email) {
            await this.emailService.sendEmail({
              to: user.email,
              subject: data.title,
              template: 'notification',
              data: {
                title: data.title,
                body: data.body,
                ...data.data
              }
            });
          }
          break;

        case 'web-push':
          if (user.webPushSubscriptions?.length) {
            jobs.push({
              name: 'web-push',
              data: {
                ...jobData,
                subscriptions: user.webPushSubscriptions
              }
            });
          }
          break;
      }
    }

    if (jobs.length > 0) {
      const options: any = {
        priority: this.getPriority(payload.priority)
      };

      if (payload.scheduledFor) {
        options.delay = payload.scheduledFor.getTime() - Date.now();
      }

      await this.notificationQueue.addBulk(
        jobs.map(job => ({
          ...job,
          opts: options
        }))
      );
    }
  }

  private async sendPushNotification(
    tokens: string[],
    notification: {
      title: string;
      body: string;
      data?: any;
    }
  ): Promise<void> {
    const messages: ExpoPushMessage[] = tokens
      .filter(token => Expo.isExpoPushToken(token))
      .map(token => ({
        to: token,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        sound: 'default'
      }));

    const chunks = this.expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        await this.expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        this.logger.error('Push notification error:', error);
        throw error;
      }
    }
  }

  private async sendSMS(
    phoneNumber: string,
    message: string
  ): Promise<void> {
    try {
      await this.twilio.messages.create({
        to: phoneNumber,
        from: process.env.TWILIO_PHONE_NUMBER,
        body: message
      });
    } catch (error) {
      this.logger.error('SMS error:', error);
      throw error;
    }
  }

  private async sendWebPushNotification(
    subscription: PushSubscription,
    notification: {
      title: string;
      body: string;
      data?: any;
    }
  ): Promise<void> {
    try {
      await this.webPush.sendNotification(
        subscription,
        JSON.stringify(notification)
      );
    } catch (error) {
      this.logger.error('Web push notification error:', error);
      throw error;
    }
  }

  private async handleNotificationFailure(
    notificationId: string,
    error: Error
  ): Promise<void> {
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: 'failed',
        error: error.message
      }
    });
  }

  private getPriority(
    priority?: 'high' | 'normal' | 'low'
  ): number {
    switch (priority) {
      case 'high':
        return 1;
      case 'low':
        return 3;
      default:
        return 2;
    }
  }

  async createNotificationGroup(
    data: {
      name: string;
      description?: string;
      rules: Omit<NotificationRule, 'id'>[];
    }
  ): Promise<NotificationGroup> {
    return this.prisma.notificationGroup.create({
      data: {
        name: data.name,
        description: data.description,
        rules: {
          create: data.rules
        }
      },
      include: {
        rules: true
      }
    });
  }

  async scheduleNotification(
    data: {
      template: string;
      userIds: string[];
      scheduledFor: Date;
      data?: Record<string, any>;
      priority?: 'high' | 'normal' | 'low';
      channels?: string[];
    }
  ): Promise<void> {
    const notifications = data.userIds.map(userId => ({
      userId,
      template: data.template,
      data: data.data,
      priority: data.priority,
      channels: data.channels,
      scheduledFor: data.scheduledFor
    }));

    await Promise.all(
      notifications.map(notification =>
        this.sendNotification(notification)
      )
    );
  }

  async createNotificationCampaign(
    data: {
      name: string;
      template: string;
      audience: {
        type: 'all' | 'segment' | 'specific';
        segmentId?: string;
        userIds?: string[];
      };
      schedule?: {
        type: 'immediate' | 'scheduled' | 'recurring';
        startDate?: Date;
        endDate?: Date;
        recurringPattern?: string;
      };
      data?: Record<string, any>;
      priority?: 'high' | 'normal' | 'low';
      channels?: string[];
    }
  ): Promise<void> {
    const campaign = await this.prisma.notificationCampaign.create({
      data: {
        name: data.name,
        template: data.template,
        audienceType: data.audience.type,
        audienceData: {
          segmentId: data.audience.segmentId,
          userIds: data.audience.userIds
        },
        schedule: data.schedule,
        data: data.data,
        priority: data.priority,
        channels: data.channels,
        status: 'pending'
      }
    });

    if (data.schedule?.type === 'immediate') {
      await this.processCampaign(campaign.id);
    }
  }

  async getNotificationMetrics(
    options: {
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      groupBy?: 'day' | 'week' | 'month';
    } = {}
  ): Promise<NotificationMetrics> {
    const where: any = {};

    if (options.userId) {
      where.userId = options.userId;
    }

    if (options.startDate || options.endDate) {
      where.createdAt = {
        ...(options.startDate && { gte: options.startDate }),
        ...(options.endDate && { lte: options.endDate })
      };
    }

    const [
      total,
      read,
      unread,
      byChannel,
      byStatus,
      delivered,
      failed
    ] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { ...where, readAt: { not: null } }
      }),
      this.prisma.notification.count({
        where: { ...where, readAt: null }
      }),
      this.prisma.notification.groupBy({
        by: ['channel'],
        where,
        _count: true
      }),
      this.prisma.notification.groupBy({
        by: ['status'],
        where,
        _count: true
      }),
      this.prisma.notification.count({
        where: { ...where, status: 'delivered' }
      }),
      this.prisma.notification.count({
        where: { ...where, status: 'failed' }
      })
    ]);

    return {
      total,
      read,
      unread,
      byChannel: Object.fromEntries(
        byChannel.map(({ channel, _count }) => [channel, _count])
      ),
      byStatus: Object.fromEntries(
        byStatus.map(({ status, _count }) => [status, _count])
      ),
      deliveryRate: total ? (delivered / total) * 100 : 0,
      readRate: delivered ? (read / delivered) * 100 : 0
    };
  }

  async batchDeleteNotifications(
    options: {
      userIds?: string[];
      olderThan?: Date;
      status?: string[];
      excludeUnread?: boolean;
    }
  ): Promise<number> {
    const where: any = {};

    if (options.userIds?.length) {
      where.userId = { in: options.userIds };
    }

    if (options.olderThan) {
      where.createdAt = { lt: options.olderThan };
    }

    if (options.status?.length) {
      where.status = { in: options.status };
    }

    if (options.excludeUnread) {
      where.readAt = { not: null };
    }

    const result = await this.prisma.notification.deleteMany({ where });
    return result.count;
  }

  private async processCampaign(
    campaignId: string
  ): Promise<void> {
    const campaign = await this.prisma.notificationCampaign.findUnique({
      where: { id: campaignId }
    });

    if (!campaign) {
      throw new ValidationError('Campaign not found');
    }

    let userIds: string[] = [];

    switch (campaign.audienceType) {
      case 'all':
        userIds = await this.getAllUserIds();
        break;

      case 'segment':
        userIds = await this.getUserIdsFromSegment(
          campaign.audienceData.segmentId
        );
        break;

      case 'specific':
        userIds = campaign.audienceData.userIds;
        break;
    }

    const notifications = userIds.map(userId => ({
      userId,
      template: campaign.template,
      data: campaign.data,
      priority: campaign.priority,
      channels: campaign.channels
    }));

    await Promise.all([
      this.prisma.notificationCampaign.update({
        where: { id: campaignId },
        data: { status: 'processing' }
      }),
      ...notifications.map(notification =>
        this.sendNotification(notification)
      )
    ]);

    await this.prisma.notificationCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'completed',
        completedAt: new Date()
      }
    });
  }

  private async getAllUserIds(): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      select: { id: true },
      where: { active: true }
    });
    return users.map(user => user.id);
  }

  private async getUserIdsFromSegment(
    segmentId: string
  ): Promise<string[]> {
    const segment = await this.prisma.userSegment.findUnique({
      where: { id: segmentId },
      include: { users: { select: { id: true } } }
    });

    if (!segment) {
      throw new ValidationError('Segment not found');
    }

    return segment.users.map(user => user.id);
  }

  async getDeliveryStatus(
    notificationId: string
  ): Promise<DeliveryStatus[]> {
    return this.prisma.deliveryStatus.findMany({
      where: { notificationId },
      orderBy: { timestamp: 'desc' }
    });
  }

  async retryFailedNotifications(
    options: {
      olderThan?: Date;
      newerThan?: Date;
      channels?: string[];
      limit?: number;
    } = {}
  ): Promise<number> {
    const where: any = {
      status: 'failed',
      ...(options.olderThan && {
        createdAt: { lt: options.olderThan }
      }),
      ...(options.newerThan && {
        createdAt: { gt: options.newerThan }
      }),
      ...(options.channels && {
        channel: { in: options.channels }
      })
    };

    const failedNotifications = await this.prisma.notification.findMany({
      where,
      take: options.limit,
      include: {
        deliveryStatus: true
      }
    });

    let retryCount = 0;
    for (const notification of failedNotifications) {
      try {
        await this.sendNotification({
          userId: notification.userId,
          template: notification.template,
          data: notification.data,
          channels: [notification.channel]
        });
        retryCount++;
      } catch (error) {
        this.logger.error(
          `Retry failed for notification ${notification.id}:`,
          error
        );
      }
    }

    return retryCount;
  }

  private async validateTemplate(
    template: NotificationTemplate
  ): Promise<void> {
    const requiredVariables = this.extractVariables(template.body);
    const missingVariables = requiredVariables.filter(
      v => !template.variables.includes(v)
    );

    if (missingVariables.length > 0) {
      throw new ValidationError(
        `Template is missing variable definitions: ${missingVariables.join(', ')}`
      );
    }
  }

  private extractVariables(text: string): string[] {
    const matches = text.match(/{{([^}]+)}}/g) || [];
    return matches.map(match => match.slice(2, -2).trim());
  }
} 