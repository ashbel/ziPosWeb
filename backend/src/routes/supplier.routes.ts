import { Router } from 'express';
import { SupplierController } from '../controllers/supplier.controller';
import { validateSupplier, validatePurchaseOrder } from '../validators/supplier.validator';
import { authenticate, authorize } from '../middleware/auth.middleware';

export const supplierRouter = Router();
const supplierController = new SupplierController();

supplierRouter.use(authenticate);

supplierRouter.get(
  '/',
  authorize(['manage_suppliers']),
  supplierController.getSuppliers
);

supplierRouter.post(
  '/',
  authorize(['manage_suppliers']),
  validateSupplier,
  supplierController.createSupplier
);

supplierRouter.get(
  '/purchase-orders',
  authorize(['manage_suppliers']),
  supplierController.getPurchaseOrders
);

supplierRouter.post(
  '/purchase-orders',
  authorize(['manage_suppliers']),
  validatePurchaseOrder,
  supplierController.createPurchaseOrder
);

supplierRouter.put(
  '/purchase-orders/:id/receive',
  authorize(['manage_suppliers']),
  supplierController.receivePurchaseOrder
); 