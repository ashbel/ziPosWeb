import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { AnalyticsController } from '../controllers/analytics.controller';
import { ExportController } from '../controllers/export.controller';
import { NotificationController } from '../controllers/notification.controller';

export const apiRouter = Router();
const analyticsController = new AnalyticsController();
const exportController = new ExportController();
const notificationController = new NotificationController();

// Analytics endpoints
apiRouter.get(
  '/analytics/sales',
  authenticate,
  authorize(['view_reports']),
  analyticsController.getSalesAnalytics
);

apiRouter.get(
  '/analytics/inventory',
  authenticate,
  authorize(['view_reports']),
  analyticsController.getInventoryAnalytics
);

apiRouter.get(
  '/analytics/customers',
  authenticate,
  authorize(['view_reports']),
  analyticsController.getCustomerAnalytics
);

// Export endpoints
apiRouter.post(
  '/export/sales',
  authenticate,
  authorize(['view_reports']),
  exportController.exportSales
);

apiRouter.post(
  '/export/inventory',
  authenticate,
  authorize(['view_reports']),
  exportController.exportInventory
);

apiRouter.post(
  '/export/customers',
  authenticate,
  authorize(['view_reports']),
  exportController.exportCustomers
);

// Notification endpoints
apiRouter.get(
  '/notifications',
  authenticate,
  notificationController.getNotifications
);

apiRouter.post(
  '/notifications/mark-read',
  authenticate,
  notificationController.markAsRead
);

apiRouter.post(
  '/notifications/subscribe',
  authenticate,
  notificationController.subscribe
); 