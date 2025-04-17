import { Router } from 'express';
import { ProductController } from '../controllers/product.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { upload } from '../middleware/upload';

export function createProductRoutes(
  controller: ProductController
): Router {
  const router = Router();

  router.use(authenticate);

  router.post(
    '/',
    authorize('products.create'),
    upload.array('images'),
    controller.createProduct.bind(controller)
  );

  router.put(
    '/:id',
    authorize('products.update'),
    upload.array('images'),
    controller.updateProduct.bind(controller)
  );

  router.get(
    '/:id',
    authorize('products.read'),
    controller.getProduct.bind(controller)
  );

  router.get(
    '/',
    authorize('products.read'),
    controller.searchProducts.bind(controller)
  );

  router.post(
    '/categories',
    authorize('products.manage'),
    upload.single('image'),
    controller.createCategory.bind(controller)
  );

  router.post(
    '/:productId/pricing-rules',
    authorize('products.manage'),
    controller.createPricingRule.bind(controller)
  );

  router.post(
    '/import',
    authorize('products.manage'),
    controller.importProducts.bind(controller)
  );

  return router;
} 