import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

export function createAuditRoutes(
  controller: AuditController
): Router {
  const router = Router();

  router.use(authenticate);

  router.get(
    '/events',
    authorize('audit.read'),
    controller.getEvents.bind(controller)
  );

  router.get(
    '/summary',
    authorize('audit.read'),
    controller.getEventSummary.bind(controller)
  );

  router.get(
    '/resource/:resourceType/:resourceId',
    authorize('audit.read'),
    controller.getResourceHistory.bind(controller)
  );

  router.get(
    '/user/:userId',
    authorize('audit.read'),
    controller.getUserActivity.bind(controller)
  );

  router.get(
    '/anomalies',
    authorize('audit.read'),
    controller.getAnomalies.bind(controller)
  );

  router.post(
    '/alerts',
    authorize('audit.manage'),
    controller.createAlert.bind(controller)
  );

  router.post(
    '/alerts/:alertId/resolve',
    authorize('audit.manage'),
    controller.resolveAlert.bind(controller)
  );

  router.post(
    '/compliance/report',
    authorize('audit.compliance'),
    controller.generateComplianceReport.bind(controller)
  );

  router.get(
    '/export',
    authorize('audit.export'),
    controller.exportAuditLogs.bind(controller)
  );

  return router;
} 