import { Router } from 'express';
import { TaxController } from '../controllers/tax.controller';
import { TaxService } from '../services/tax.service';
import { authenticate } from '../middleware/authenticate';
import { validateRequest } from '../middleware/validate';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const logger = new Logger('tax');
const taxService = new TaxService(prisma, redis, logger);
const taxController = new TaxController(taxService);

// Create tax rate
router.post(
  '/rates',
  authenticate,
  validateRequest({
    body: {
      name: { type: 'string', required: true },
      rate: { type: 'number', required: true },
      type: { type: 'string', required: true },
      jurisdiction: { type: 'string', required: true }
    }
  }),
  (req, res) => taxController.createTaxRate(req, res)
);

// Calculate tax
router.post(
  '/calculate',
  authenticate,
  validateRequest({
    body: {
      items: { type: 'array', required: true },
      shippingAddress: { type: 'object', required: true },
      billingAddress: { type: 'object', required: true }
    }
  }),
  (req, res) => taxController.calculateTax(req, res)
);

// Create tax exemption
router.post(
  '/exemptions',
  authenticate,
  validateRequest({
    body: {
      customerId: { type: 'string', required: true },
      certificateNumber: { type: 'string', required: true },
      type: { type: 'string', required: true },
      validFrom: { type: 'string', required: true },
      validTo: { type: 'string', required: true }
    }
  }),
  (req, res) => taxController.createTaxExemption(req, res)
);

// Validate tax exemption
router.post(
  '/exemptions/validate',
  authenticate,
  validateRequest({
    body: {
      certificateNumber: { type: 'string', required: true },
      type: { type: 'string', required: true }
    }
  }),
  (req, res) => taxController.validateTaxExemption(req, res)
);

// Get tax report
router.get(
  '/reports',
  authenticate,
  validateRequest({
    query: {
      startDate: { type: 'string', required: false },
      endDate: { type: 'string', required: false },
      jurisdiction: { type: 'string', required: false }
    }
  }),
  (req, res) => taxController.getTaxReport(req, res)
);

// Create tax rule
router.post(
  '/rules',
  authenticate,
  validateRequest({
    body: {
      name: { type: 'string', required: true },
      priority: { type: 'number', required: true },
      conditions: { type: 'object', required: true },
      actions: { type: 'object', required: true }
    }
  }),
  (req, res) => taxController.createTaxRule(req, res)
);

// Calculate tax jurisdictions
router.post(
  '/jurisdictions',
  authenticate,
  validateRequest({
    body: {
      address: { type: 'object', required: true }
    }
  }),
  (req, res) => taxController.calculateTaxJurisdictions(req, res)
);

// Generate tax forecast
router.get(
  '/forecast',
  authenticate,
  validateRequest({
    query: {
      startDate: { type: 'string', required: false },
      endDate: { type: 'string', required: false },
      jurisdiction: { type: 'string', required: false }
    }
  }),
  (req, res) => taxController.generateTaxForecast(req, res)
);

export const taxRoutes = router; 