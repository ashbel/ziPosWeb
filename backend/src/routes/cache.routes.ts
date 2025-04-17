import { Router } from 'express';
import { CacheController } from '../controllers/cache.controller';
import { CacheService } from '../services/cache.service';
import { authenticate } from '../middleware/authenticate';
import { validateRequest } from '../middleware/validate';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';

const router = Router();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const logger = new Logger('cache');
const cacheService = new CacheService(redis, logger);
const cacheController = new CacheController(cacheService);

// Get cache value
router.get(
  '/:key',
  authenticate,
  validateRequest({
    params: {
      key: { type: 'string', required: true }
    }
  }),
  (req, res) => cacheController.getCache(req, res)
);

// Set cache value
router.post(
  '/:key',
  authenticate,
  validateRequest({
    params: {
      key: { type: 'string', required: true }
    },
    body: {
      value: { type: 'any', required: true },
      ttl: { type: 'number', required: false }
    }
  }),
  (req, res) => cacheController.setCache(req, res)
);

// Delete cache value
router.delete(
  '/:key',
  authenticate,
  validateRequest({
    params: {
      key: { type: 'string', required: true }
    }
  }),
  (req, res) => cacheController.deleteCache(req, res)
);

// Clear all cache
router.delete(
  '/',
  authenticate,
  (req, res) => cacheController.clearCache(req, res)
);

// Get cache statistics
router.get(
  '/stats',
  authenticate,
  (req, res) => cacheController.getCacheStats(req, res)
);

export default router; 