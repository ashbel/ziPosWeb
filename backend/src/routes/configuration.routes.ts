import { Router } from 'express';
import { ConfigurationController } from '../controllers/configuration.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

export function createConfigurationRoutes(
  controller: ConfigurationController
): Router {
  const router = Router();

  router.use(authenticate);

  router.put(
    '/:key',
    authorize('config.write'),
    controller.setConfiguration.bind(controller)
  );

  router.get(
    '/:key',
    authorize('config.read'),
    controller.getConfiguration.bind(controller)
  );

  router.post(
    '/feature-flags',
    authorize('config.manage'),
    controller.setFeatureFlag.bind(controller)
  );

  router.get(
    '/feature-flags/:name',
    authorize('config.read'),
    controller.checkFeatureFlag.bind(controller)
  );

  router.post(
    '/bulk-update',
    authorize('config.manage'),
    controller.bulkUpdate.bind(controller)
  );

  router.get(
    '/:key/history',
    authorize('config.read'),
    controller.getHistory.bind(controller)
  );

  return router;
} 