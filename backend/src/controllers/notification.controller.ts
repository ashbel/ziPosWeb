import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { validateRequest } from '../middleware/validate-request';
import { NotificationSchema } from '../validators/notification.validator';

export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  async sendNotification(req: Request, res: Response) {
    await validateRequest(req, NotificationSchema.send);
    const notification = await this.notificationService.sendNotification(req.body);
    res.json(notification);
  }

  async getNotifications(req: Request, res: Response) {
    const notifications = await this.notificationService.getNotificationHistory(
      req.params.userId,
      req.query
    );
    res.json(notifications);
  }

  async markAsRead(req: Request, res: Response) {
    await this.notificationService.markAsRead(
      req.params.userId,
      req.params.notificationId
    );
    res.sendStatus(200);
  }

  async createTemplate(req: Request, res: Response) {
    await validateRequest(req, NotificationSchema.template);
    const template = await this.notificationService.createTemplate(req.body);
    res.json(template);
  }

  async getMetrics(req: Request, res: Response) {
    const metrics = await this.notificationService.getNotificationMetrics(
      req.query
    );
    res.json(metrics);
  }
} 