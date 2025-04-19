import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { AnalyticsController } from '../controllers/analytics.controller';
import { NotificationController } from '../controllers/notification.controller';
import integrationRoutes from './integration.routes';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';
import { AnalyticsService } from '../services/analytics.service';
import { NotificationService } from '../services/notification.service';
import { EmailService } from '../services/email.service';
import { WebPushService } from '../services/web-push.service';

export const apiRouter = Router();

// Initialize dependencies
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const logger = new Logger('ApiRoutes');

// Initialize services
const analyticsService = new AnalyticsService(prisma, redis, logger);
const emailService = new EmailService({ prisma, redis, logger });
const webPushService = new WebPushService({ prisma, redis, logger });
const notificationService = new NotificationService({
  prisma,
  redis,
  logger,
  emailService,
  webPush: webPushService
});

// Initialize controllers
const analyticsController = new AnalyticsController(analyticsService);
const notificationController = new NotificationController(notificationService);

// Integration routes
apiRouter.use('/integrations', integrationRoutes);

// Analytics endpoints
apiRouter.post(
  '/analytics/metrics',
  authMiddleware,
  analyticsController.trackMetric
);

apiRouter.post(
  '/analytics/metrics/batch',
  authMiddleware,
  analyticsController.batchTrackMetrics
);

apiRouter.get(
  '/analytics/metrics',
  authMiddleware,
  analyticsController.queryMetrics
);

apiRouter.get(
  '/analytics/metrics/top',
  authMiddleware,
  analyticsController.getTopMetrics
);

apiRouter.post(
  '/analytics/dashboards',
  authMiddleware,
  analyticsController.createDashboard
);

apiRouter.get(
  '/analytics/dashboards/:dashboardId',
  authMiddleware,
  analyticsController.getDashboardData
);

apiRouter.post(
  '/analytics/alerts',
  authMiddleware,
  analyticsController.createAlert
);

apiRouter.get(
  '/analytics/forecast',
  authMiddleware,
  analyticsController.getForecast
);

apiRouter.post(
  '/analytics/correlations',
  authMiddleware,
  analyticsController.getCorrelations
);

apiRouter.post(
  '/analytics/reports',
  authMiddleware,
  analyticsController.generateReport
);

// Notification endpoints
apiRouter.get(
  '/notifications',
  authMiddleware,
  notificationController.getNotifications
);

apiRouter.post(
  '/notifications/mark-read',
  authMiddleware,
  notificationController.markAsRead
);

export default apiRouter;