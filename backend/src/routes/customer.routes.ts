import { Router } from 'express';
import { CustomerController } from '../controllers/customer.controller';
import { CustomerService } from '../services/customer.service';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.middleware';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const logger = new Logger('CustomerService');
const customerService = new CustomerService(prisma, redis, logger);
const customerController = new CustomerController(customerService);

router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Customers
 *   description: Customer management endpoints
 */


    
router.get('/', customerController.listCustomers);
router.post('/', customerController.createCustomer);
router.get('/:id', customerController.getCustomer);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

export const customerRoutes = router; 