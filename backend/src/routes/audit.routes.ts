import { Router } from 'express';
import { AuditController } from '../controllers/audit.controller';
import { AuditService } from '../services/audit.service';
import { authMiddleware } from '../middleware/auth.middleware'; 
import { Logger } from '../utils/logger';
import {PrismaClient} from '@prisma/client';
import Redis from 'ioredis';

const router = Router();
const prisma = new PrismaClient();
const redis = new Redis();
const logger = new Logger('AuditService');

const auditService = new AuditService(prisma, redis, logger);

const auditController = new AuditController(auditService);

router.use(authMiddleware);

router.get('/events', auditController.getEvents);
router.get('/event-summary', auditController.getEventSummary);
router.get('/resource-history/:resourceType/:resourceId', auditController.getResourceHistory);
router.get('/user-activity/:userId', auditController.getUserActivity);
router.get('/anomalies', auditController.getAnomalies);
router.post('/alerts', auditController.createAlert);
router.post('/resolve-alert/:alertId', auditController.resolveAlert);
router.get('/compliance-report', auditController.generateComplianceReport);

export const auditRoutes = router;

