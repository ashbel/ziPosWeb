import { Router } from 'express';
import { ShippingController } from '../controllers/shipping.controller';
import { ShippingService } from '../services/shipping.service';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const logger = new Logger('ShippingService');
const shippingService = new ShippingService(prisma, redis, logger);
const shippingController = new ShippingController(shippingService);

// Get shipping rates
router.post(
  '/rates',
  authMiddleware,
  validateRequest({
    body: z.object({
      carrier: z.string().optional(),
      origin: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
        country: z.string()
      }),
      destination: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
        country: z.string()
      }),
      weight: z.number().positive(),
      dimensions: z.object({
        length: z.number().positive(),
        width: z.number().positive(),
        height: z.number().positive()
      })
    })
  }),
  shippingController.getRates
);

// Create shipment
router.post(
  '/shipments',
  authMiddleware,
  validateRequest({
    body: z.object({
      orderId: z.string(),
      carrier: z.string().optional(),
      origin: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
        country: z.string()
      }),
      destination: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
        country: z.string()
      }),
      weight: z.number().positive(),
      dimensions: z.object({
        length: z.number().positive(),
        width: z.number().positive(),
        height: z.number().positive()
      }),
      items: z.array(z.object({
        name: z.string(),
        quantity: z.number().positive(),
        weight: z.number().positive(),
        value: z.number().positive()
      }))
    })
  }),
  shippingController.createShipment
);

// Track shipment
router.get(
  '/tracking/:carrier/:trackingNumber',
  authMiddleware,
  validateRequest({
    params: z.object({
      carrier: z.string(),
      trackingNumber: z.string()
    })
  }),
  shippingController.trackShipment
);

// Validate address
router.post(
  '/address/validate',
  authMiddleware,
  validateRequest({
    body: z.object({
      address: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
        country: z.string()
      })
    })
  }),
  shippingController.validateAddress
);

export const shippingRoutes = router; 