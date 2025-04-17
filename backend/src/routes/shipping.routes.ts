import { Router } from 'express';
import { ShippingController } from '../controllers/shipping.controller';
import { authenticate } from '../middleware/authenticate';
import { validateRequest } from '../middleware/validate';
import { ShippingService } from '../services/shipping.service';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const logger = new Logger('shipping');
const shippingService = new ShippingService(prisma, redis, logger);
const shippingController = new ShippingController(shippingService);

// Get shipping rates
router.post(
  '/rates',
  authenticate,
  validateRequest({
    body: {
      carrier: { type: 'string', required: true },
      from: { type: 'object', required: true },
      to: { type: 'object', required: true },
      weight: { type: 'number', required: true },
      dimensions: { type: 'object', required: true }
    }
  }),
  (req, res) => shippingController.getRates(req, res)
);

// Create shipment
router.post(
  '/shipments',
  authenticate,
  validateRequest({
    body: {
      carrier: { type: 'string', required: true },
      from: { type: 'object', required: true },
      to: { type: 'object', required: true },
      weight: { type: 'number', required: true },
      dimensions: { type: 'object', required: true },
      items: { type: 'array', required: true }
    }
  }),
  (req, res) => shippingController.createShipment(req, res)
);

// Track shipment
router.get(
  '/tracking/:carrier/:trackingNumber',
  authenticate,
  validateRequest({
    params: {
      carrier: { type: 'string', required: true },
      trackingNumber: { type: 'string', required: true }
    }
  }),
  (req, res) => shippingController.trackShipment(req, res)
);

// Validate address
router.post(
  '/address/validate',
  authenticate,
  validateRequest({
    body: {
      address: { type: 'object', required: true }
    }
  }),
  (req, res) => shippingController.validateAddress(req, res)
);

export default router; 