import { Router } from 'express';
import { ReturnController } from '../controllers/return.controller';
import { validateReturn } from '../validators/return.validator';
import { authenticate, authorize } from '../middleware/auth.middleware';

export const returnRouter = Router();
const returnController = new ReturnController();

returnRouter.use(authenticate);

returnRouter.get(
  '/',
  authorize(['process_returns']),
  returnController.getReturns
);

returnRouter.post(
  '/',
  authorize(['process_returns']),
  validateReturn,
  returnController.createReturn
);

returnRouter.get(
  '/:id',
  authorize(['process_returns']),
  returnController.getReturnById
);

returnRouter.put(
  '/:id/status',
  authorize(['process_returns']),
  returnController.updateReturnStatus
);

returnRouter.get(
  '/sale/:saleId',
  authorize(['process_returns']),
  returnController.getReturnsBySale
); 