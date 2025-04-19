import { Router } from 'express';
import { IntegrationController } from '../controllers/integration.controller';
import { IntegrationService } from '../services/integration.service';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const logger = new Logger('IntegrationRoutes');

const integrationService = new IntegrationService(prisma, redis, logger);
const integrationController = new IntegrationController(integrationService);

// Integration routes
router.post(
  '/',
  authMiddleware,
  validateRequest({
    body: z.object({
      name: z.string(),
      type: z.string(),
      config: z.record(z.any()),
      enabled: z.boolean()
    })
  }),
  integrationController.createIntegration
);

router.put(
  '/:id',
  authMiddleware,
  validateRequest({
    params: z.object({
      id: z.string()
    }),
    body: z.object({
      name: z.string().optional(),
      config: z.record(z.any()).optional(),
      enabled: z.boolean().optional()
    })
  }),
  integrationController.updateIntegration
);

router.delete(
  '/:id',
  authMiddleware,
  validateRequest({
    params: z.object({
      id: z.string()
    })
  }),
  integrationController.deleteIntegration
);

router.get(
  '/:id',
  authMiddleware,
  validateRequest({
    params: z.object({
      id: z.string()
    })
  }),
  integrationController.getIntegration
);

router.get(
  '/',
  authMiddleware,
  validateRequest({
    query: z.object({
      type: z.string().optional(),
      enabled: z.string().optional()
    })
  }),
  integrationController.listIntegrations
);

router.post(
  '/:id/test',
  authMiddleware,
  validateRequest({
    params: z.object({
      id: z.string()
    })
  }),
  integrationController.testIntegration
);

// Webhook routes
router.post(
  '/webhooks',
  authMiddleware,
  validateRequest({
    body: z.object({
      integrationId: z.string(),
      event: z.string(),
      url: z.string().url(),
      secret: z.string()
    })
  }),
  integrationController.createWebhook
);

router.delete(
  '/webhooks/:id',
  authMiddleware,
  validateRequest({
    params: z.object({
      id: z.string()
    })
  }),
  integrationController.deleteWebhook
);

router.get(
  '/webhooks',
  authMiddleware,
  validateRequest({
    query: z.object({
      integrationId: z.string()
    })
  }),
  integrationController.listWebhooks
);

// API Key routes
router.post(
  '/api-keys',
  authMiddleware,
  validateRequest({
    body: z.object({
      integrationId: z.string(),
      name: z.string(),
      permissions: z.array(z.string())
    })
  }),
  integrationController.createApiKey
);

router.delete(
  '/api-keys/:id',
  authMiddleware,
  validateRequest({
    params: z.object({
      id: z.string()
    })
  }),
  integrationController.deleteApiKey
);

router.get(
  '/api-keys',
  authMiddleware,
  validateRequest({
    query: z.object({
      integrationId: z.string()
    })
  }),
  integrationController.listApiKeys
);

export const integrationRoutes = router; 

