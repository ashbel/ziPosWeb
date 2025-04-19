import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { ReportService } from '../services/report.service';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();
const redis = new Redis();
const logger = new Logger('ReportService');
const reportService = new ReportService(prisma, redis, logger);
const reportController = new ReportController(reportService);

router.use(authMiddleware);

router.get('/sales', reportController.getSalesReport);
router.get('/inventory', reportController.getInventoryReport);
router.get('/customers', reportController.getCustomerReport);

export const reportRoutes = router; 