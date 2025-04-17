import { Router } from 'express';
import { DiscountController } from '../controllers/discount.controller';
import { validateDiscount } from '../validators/discount.validator';
import { authenticate, authorize } from '../middleware/auth.middleware';

export const discountRouter = Router();
const discountController = new DiscountController();

discountRouter.use(authenticate);

discountRouter.get(
  '/',
  authorize(['manage_discounts']),
  discountController.getDiscounts
);

discountRouter.post(
  '/',
  authorize(['manage_discounts']),
  validateDiscount,
  discountController.createDiscount
);

discountRouter.put(
  '/:id',
  authorize(['manage_discounts']),
  validateDiscount,
  discountController.updateDiscount
);

discountRouter.delete(
  '/:id',
  authorize(['manage_discounts']),
  discountController.deleteDiscount
);

discountRouter.post(
  '/calculate',
  discountController.calculateDiscount
);

export function createDiscountRoutes(
  controller: DiscountController
): Router {
  const router = Router();

  router.use(authenticate);

  router.post(
    '/',
    authorize('discounts.create'),
    controller.createDiscount.bind(controller)
  );

  router.post(
    '/validate/:code',
    authorize('discounts.validate'),
    controller.validateDiscount.bind(controller)
  );

  router.post(
    '/campaigns',
    authorize('discounts.manage'),
    controller.createPromotionCampaign.bind(controller)
  );

  router.post(
    '/generate',
    authorize('discounts.manage'),
    controller.generateDiscountCodes.bind(controller)
  );

  router.get(
    '/analytics',
    authorize('discounts.read'),
    controller.getPerformanceAnalytics.bind(controller)
  );

  router.post(
    '/bulk-update',
    authorize('discounts.manage'),
    controller.bulkUpdateDiscounts.bind(controller)
  );

  return router;
} 