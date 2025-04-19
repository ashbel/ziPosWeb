import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { NotificationService } from '../services/notification.service';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();
const redis = new Redis();
const logger = new Logger('NotificationService');

const notificationService = new NotificationService({
  prisma,
  redis,
  logger
});
const notificationController = new NotificationController(notificationService);

router.use(authMiddleware);

router.post('/send', notificationController.sendNotification);
router.get('/:userId', notificationController.getNotifications);
router.post('/:userId/:notificationId/read', notificationController.markAsRead);
router.post('/templates', notificationController.createTemplate);
router.get('/metrics', notificationController.getMetrics);

export const notificationRoutes = router; 