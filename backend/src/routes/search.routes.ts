import { Router } from 'express';
import { SearchController } from '../controllers/search.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

export function createSearchRoutes(
  controller: SearchController
): Router {
  const router = Router();

  router.use(authenticate);

  router.post(
    '/:type/search',
    authorize('search.read'),
    controller.search.bind(controller)
  );

  router.get(
    '/:type/suggest',
    authorize('search.read'),
    controller.suggest.bind(controller)
  );

  router.post(
    '/index',
    authorize('search.write'),
    controller.indexDocument.bind(controller)
  );

  router.post(
    '/bulk-index',
    authorize('search.write'),
    controller.bulkIndex.bind(controller)
  );

  router.delete(
    '/:type/:id',
    authorize('search.write'),
    controller.deleteDocument.bind(controller)
  );

  router.post(
    '/:type/reindex',
    authorize('search.manage'),
    controller.reindex.bind(controller)
  );

  return router;
} 