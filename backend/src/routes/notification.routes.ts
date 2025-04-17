import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

export function createNotificationRoutes(
  controller: NotificationController
): Router {
  const router = Router();

  router.use(authenticate);

  router.post(
    '/send',
    authorize('notifications.send'),
    controller.sendNotification.bind(controller)
  );

  router.get(
    '/user/:userId',
    authorize('notifications.read'),
    controller.getNotifications.bind(controller)
  );

  router.post(
    '/user/:userId/notifications/:notificationId/read',
    authorize('notifications.update'),
    controller.markAsRead.bind(controller)
  );

  router.post(
    '/templates',
    authorize('notifications.manage'),
    controller.createTemplate.bind(controller)
  );

  router.get(
    '/metrics',
    authorize('notifications.metrics'),
    controller.getMetrics.bind(controller)
  );

  return router;
} 