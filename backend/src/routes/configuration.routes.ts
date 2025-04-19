import { Router } from 'express';
import { ConfigurationController } from '../controllers/configuration.controller';
import { ConfigurationService } from '../services/configuration.service';
import { authMiddleware } from '../middleware/auth.middleware'; 
import { Logger } from '../utils/logger';
import {PrismaClient} from '@prisma/client';
import Redis from 'ioredis';


const router = Router();
const prisma = new PrismaClient();
const redis = new Redis();
const logger = new Logger('ConfigurationService');

const configurationService = new ConfigurationService({
  prisma,
  redis,
  logger
});

const configurationController = new ConfigurationController(configurationService);

router.use(authMiddleware);

router.get('/', configurationController.getConfiguration);
router.post('/set-configuration', configurationController.setConfiguration);
router.post('/bulk-update', configurationController.bulkUpdate);
router.post('/check-feature-flag', configurationController.checkFeatureFlag);
router.get('/history', configurationController.getHistory);
router.post('/feature-flags', configurationController.setFeatureFlag);

export const configurationRoutes = router;
