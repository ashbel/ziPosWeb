import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';
import { authenticate } from '../middleware/authenticate';
import { validateRequest } from '../middleware/validate';
import { HealthService } from '../services/health.service';

const router = Router();
const healthService = new HealthService();
const healthController = new HealthController(healthService);

// Overall health check route
router.get(
  '/',
  authenticate,
  (req, res) => healthController.getHealth(req, res)
);

// Service-specific health check route
router.get(
  '/services/:name',
  authenticate,
  validateRequest({
    params: {
      name: { type: 'string', required: true }
    }
  }),
  (req, res) => healthController.checkService(req, res)
);

// Metrics route
router.get(
  '/metrics',
  authenticate,
  (req, res) => healthController.getMetrics(req, res)
);

export const healthRoutes = router; 