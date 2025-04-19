import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import webpush from 'web-push';

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export class WebPushService extends BaseService {
  constructor(deps: any) {
    super(deps);
    
    // Initialize web-push with VAPID keys
    webpush.setVapidDetails(
      `mailto:${process.env.VAPID_EMAIL}`,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
  }

  async subscribe(userId: string, subscription: PushSubscription): Promise<void> {
    try {
      await this.prisma.pushSubscription.upsert({
        where: {
          userId_endpoint: {
            userId,
            endpoint: subscription.endpoint
          }
        },
        update: {
          keys: subscription.keys
        },
        create: {
          userId,
          endpoint: subscription.endpoint,
          keys: subscription.keys
        }
      });
    } catch (error) {
      this.logger.error('Failed to subscribe user to push notifications', { error });
      throw new ValidationError('Failed to subscribe to push notifications');
    }
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    try {
      await this.prisma.pushSubscription.delete({
        where: {
          userId_endpoint: {
            userId,
            endpoint
          }
        }
      });
    } catch (error) {
      this.logger.error('Failed to unsubscribe user from push notifications', { error });
      throw new ValidationError('Failed to unsubscribe from push notifications');
    }
  }

  async sendNotification(
    userId: string,
    notification: {
      title: string;
      body: string;
      data?: any;
    }
  ): Promise<void> {
    try {
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: { userId }
      });

      const promises = subscriptions.map(subscription =>
        webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: subscription.keys
          },
          JSON.stringify(notification)
        ).catch(error => {
          if (error.statusCode === 410) {
            // Subscription has expired or is no longer valid
            return this.unsubscribe(userId, subscription.endpoint);
          }
          throw error;
        })
      );

      await Promise.all(promises);
    } catch (error) {
      this.logger.error('Failed to send push notification', { error });
      throw new ValidationError('Failed to send push notification');
    }
  }

  async getSubscriptions(userId: string): Promise<PushSubscription[]> {
    try {
      const subscriptions = await this.prisma.pushSubscription.findMany({
        where: { userId }
      });
      return subscriptions.map(sub => ({
        endpoint: sub.endpoint,
        keys: sub.keys
      }));
    } catch (error) {
      this.logger.error('Failed to get push subscriptions', { error });
      throw new ValidationError('Failed to get push subscriptions');
    }
  }
} 