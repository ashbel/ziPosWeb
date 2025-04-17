import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';

export function createOrderRoutes(
  controller: OrderController
): Router {
  const router = Router();

  router.use(authenticate);

  router.post(
    '/',
    authorize('orders.create'),
    controller.createOrder.bind(controller)
  );

  router.put(
    '/:id/status',
    authorize('orders.update'),
    controller.updateOrderStatus.bind(controller)
  );

  router.post(
    '/:id/refunds',
    authorize('orders.refund'),
    controller.processRefund.bind(controller)
  );

  router.get(
    '/',
    authorize('orders.read'),
    controller.searchOrders.bind(controller)
  );

  return router;
} 