import { Router } from 'express';
import { DiscountController } from '../controllers/discount.controller';
import { validateDiscount } from '../validators/discount.validator';
import { authMiddleware } from '../middleware/auth.middleware';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../utils/logger';
import { Redis } from 'ioredis';
import { DiscountService } from '../services/discount.service';

const router = Router();
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const logger = new Logger('CustomerService');

const discountService = new DiscountService(prisma);
const discountController = new DiscountController(discountService);
router.use(authMiddleware);

router.get('/', discountController.getDiscounts);

router.post('/', discountController.createDiscount);

router.put('/:id', discountController.updateDiscount);

router.delete('/:id', discountController.deleteDiscount);

export const discountRouter = router;
