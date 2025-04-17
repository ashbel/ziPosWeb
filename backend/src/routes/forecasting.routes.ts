import { Router } from 'express';
import { ForecastingController } from '../controllers/forecasting.controller';
import { authenticate } from '../middleware/authenticate';
import { validateRequest } from '../middleware/validate';
import { ForecastingService } from '../services/forecasting.service';

const router = Router();
const forecastingService = new ForecastingService();
const forecastingController = new ForecastingController(forecastingService);

// Sales forecasting routes
router.get(
  '/sales',
  authenticate,
  validateRequest({
    query: {
      productId: { type: 'string', optional: true },
      categoryId: { type: 'string', optional: true },
      days: { type: 'number', optional: true },
      includeSeasonality: { type: 'boolean', optional: true }
    }
  }),
  (req, res) => forecastingController.predictSales(req, res)
);

// Inventory forecasting routes
router.get(
  '/inventory/:productId',
  authenticate,
  validateRequest({
    params: {
      productId: { type: 'string', required: true }
    },
    query: {
      days: { type: 'number', optional: true },
      considerLeadTime: { type: 'boolean', optional: true }
    }
  }),
  (req, res) => forecastingController.predictInventory(req, res)
);

// Demand forecasting routes
router.get(
  '/demand/:productId',
  authenticate,
  validateRequest({
    params: {
      productId: { type: 'string', required: true }
    },
    query: {
      days: { type: 'number', optional: true },
      considerPromotions: { type: 'boolean', optional: true },
      considerSeasonality: { type: 'boolean', optional: true }
    }
  }),
  (req, res) => forecastingController.predictDemand(req, res)
);

// Seasonal trends route
router.get(
  '/trends',
  authenticate,
  (req, res) => forecastingController.getSeasonalTrends(req, res)
);

export default router; 