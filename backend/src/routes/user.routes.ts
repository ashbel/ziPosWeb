import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { PrismaClient } from '@prisma/client';
import { UserService } from '../services/user.service';
import { Logger } from '../utils/logger';
import Redis from 'ioredis';

const router = Router();
const prisma = new PrismaClient();
const redis = new Redis();
const logger = new Logger('UserService');

const userService = new UserService(prisma, redis, logger);

const userController = new UserController(userService);

// Apply authentication middleware to all routes
router.use(authMiddleware);

// User routes
router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);
router.put('/password', userController.changePassword);

// Admin routes
router.get('/', userController.listUsers);
router.get('/:id', userController.getUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

export const userRoutes = router; 