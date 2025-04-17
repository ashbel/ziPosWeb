import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

export function createAnalyticsRoutes(
  controller: AnalyticsController
): Router {
  const router = Router();

  router.use(authenticate);

  router.post(
    '/metrics',
    authorize('analytics.write'),
    controller.trackMetric.bind(controller)
  );

  router.post(
    '/metrics/batch',
    authorize('analytics.write'),
    controller.batchTrackMetrics.bind(controller)
  );

  router.post(
    '/query',
    authorize('analytics.read'),
    controller.queryMetrics.bind(controller)
  );

  router.get(
    '/metrics/top',
    authorize('analytics.read'),
    controller.getTopMetrics.bind(controller)
  );

  router.post(
    '/dashboards',
    authorize('analytics.manage'),
    controller.createDashboard.bind(controller)
  );

  router.get(
    '/dashboards/:dashboardId',
    authorize('analytics.read'),
    controller.getDashboardData.bind(controller)
  );

  router.post(
    '/alerts',
    authorize('analytics.manage'),
    controller.createAlert.bind(controller)
  );

  router.get(
    '/forecast',
    authorize('analytics.read'),
    controller.getForecast.bind(controller)
  );

  router.post(
    '/correlations',
    authorize('analytics.read'),
    controller.getCorrelations.bind(controller)
  );

  router.post(
    '/report',
    authorize('analytics.export'),
    controller.generateReport.bind(controller)
  );

  return router;
} 