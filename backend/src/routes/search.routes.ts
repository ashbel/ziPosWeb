import { Router } from 'express';
import { SearchController } from '../controllers/search.controller';
import { SearchService } from '../services/search.service';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();
const searchService = new SearchService(prisma);
const searchController = new SearchController(searchService);

router.use(authMiddleware);

router.get('/products', searchController.searchProducts);
router.get('/customers', searchController.searchCustomers);
router.get('/orders', searchController.searchOrders);

export const searchRoutes = router; 