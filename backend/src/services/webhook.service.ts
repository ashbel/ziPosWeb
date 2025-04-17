import { BaseService } from './base.service';
import crypto from 'crypto';
import { ValidationError } from '../utils/errors';
import { Queue } from 'bull';

interface WebhookConfig {
  id: string;
  endpoint: string;
  events: string[];
  secret: string;
  isActive: boolean;
  retryConfig?: {
    maxAttempts: number;
    backoffDelay: number;
  };
  headers?: Record<string, string>;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: any;
  status: 'pending' | 'success' | 'failed';
  response?: {
    statusCode: number;
    body: any;
  };
  attempts: number;
  nextAttempt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class WebhookService extends BaseService {
  private readonly deliveryQueue: Queue;
  private readonly defaultRetryConfig = {
    maxAttempts: 3,
    backoffDelay: 5000 // 5 seconds
  };

  constructor(deps: any) {
    super(deps);
    
    this.deliveryQueue = new Queue('webhook-delivery', {
      redis: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379')
      }
    });

    this.initializeQueue();
  }

  async registerWebhook(
    data: Omit<WebhookConfig, 'id' | 'isActive'>
  ): Promise<WebhookConfig> {
    // Validate endpoint URL
    if (!this.isValidUrl(data.endpoint)) {
      throw new ValidationError('Invalid webhook endpoint URL');
    }

    // Create webhook
    const webhook = await this.prisma.webhook.create({
      data: {
        endpoint: data.endpoint,
        events: data.events,
        secret: data.secret,
        isActive: true,
        retryConfig: data.retryConfig || this.defaultRetryConfig,
        headers: data.headers || {}
      }
    });

    return webhook;
  }

  async triggerWebhook(
    event: string,
    payload: any,
    options: {
      immediate?: boolean;
      priority?: number;
    } = {}
  ): Promise<void> {
    // Find all active webhooks subscribed to this event
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        isActive: true,
        events: {
          has: event
        }
      }
    });

    // Create delivery jobs for each webhook
    const deliveries = webhooks.map(webhook => ({
      webhookId: webhook.id,
      event,
      payload,
      status: 'pending' as const,
      attempts: 0
    }));

    if (options.immediate) {
      // Send webhooks immediately
      await Promise.all(
        deliveries.map(delivery => this.processDelivery(delivery))
      );
    } else {
      // Queue webhook deliveries
      await Promise.all(
        deliveries.map(delivery =>
          this.deliveryQueue.add(delivery, {
            priority: options.priority,
            attempts: webhooks.find(w => w.id === delivery.webhookId)?.retryConfig?.maxAttempts
              || this.defaultRetryConfig.maxAttempts
          })
        )
      );
    }
  }

  verifyWebhookSignature(
    signature: string,
    payload: any,
    secret: string
  ): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  async getWebhookDeliveries(
    webhookId: string,
    options: {
      status?: WebhookDelivery['status'];
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<WebhookDelivery[]> {
    return this.prisma.webhookDelivery.findMany({
      where: {
        webhookId,
        status: options.status
      },
      take: options.limit || 50,
      skip: options.offset || 0,
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async retryDelivery(deliveryId: string): Promise<void> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        webhook: true
      }
    });

    if (!delivery) {
      throw new ValidationError('Webhook delivery not found');
    }

    if (delivery.status !== 'failed') {
      throw new ValidationError('Can only retry failed deliveries');
    }

    await this.deliveryQueue.add({
      ...delivery,
      status: 'pending',
      attempts: 0
    });
  }

  private async processDelivery(
    delivery: Omit<WebhookDelivery, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<void> {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: delivery.webhookId }
    });

    if (!webhook || !webhook.isActive) {
      return;
    }

    try {
      const signature = this.generateSignature(delivery.payload, webhook.secret);
      
      const response = await fetch(webhook.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': delivery.event,
          ...webhook.headers
        },
        body: JSON.stringify(delivery.payload)
      });

      const responseBody = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${responseBody?.message || 'Unknown error'}`);
      }

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'success',
          response: {
            statusCode: response.status,
            body: responseBody
          },
          updatedAt: new Date()
        }
      });
    } catch (error) {
      const retryConfig = webhook.retryConfig || this.defaultRetryConfig;
      const shouldRetry = delivery.attempts < retryConfig.maxAttempts;

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: shouldRetry ? 'pending' : 'failed',
          attempts: delivery.attempts + 1,
          nextAttempt: shouldRetry
            ? new Date(Date.now() + retryConfig.backoffDelay * Math.pow(2, delivery.attempts))
            : null,
          response: {
            statusCode: error.status || 500,
            body: { error: error.message }
          },
          updatedAt: new Date()
        }
      });

      if (shouldRetry) {
        await this.scheduleRetry(delivery);
      }
    }
  }

  private async scheduleRetry(
    delivery: Omit<WebhookDelivery, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<void> {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: delivery.webhookId }
    });

    if (!webhook) {
      return;
    }

    const retryConfig = webhook.retryConfig || this.defaultRetryConfig;
    const delay = retryConfig.backoffDelay * Math.pow(2, delivery.attempts);

    await this.deliveryQueue.add(
      {
        ...delivery,
        attempts: delivery.attempts + 1
      },
      {
        delay,
        attempts: retryConfig.maxAttempts - delivery.attempts - 1
      }
    );
  }

  private generateSignature(payload: any, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private initializeQueue(): void {
    this.deliveryQueue.process(async (job) => {
      await this.processDelivery(job.data);
    });

    this.deliveryQueue.on('failed', async (job, error) => {
      this.logger.error('Webhook delivery failed:', {
        jobId: job.id,
        webhookId: job.data.webhookId,
        error: error.message
      });
    });
  }
} 