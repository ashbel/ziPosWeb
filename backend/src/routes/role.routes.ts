import { Router } from 'express';
import { RoleController } from '../controllers/role.controller';
import { RoleService } from '../services/role.service';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { z } from 'zod';

const router = Router();
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const logger = new Logger('RoleRoutes');

const roleService = new RoleService(prisma, redis, logger);
const roleController = new RoleController(roleService);

// Validation schemas
const createRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  permissions: z.array(z.string())
});

const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional()
});

// Routes
router.post('/', 
  authenticate, 
  validateRequest({ body: createRoleSchema }), 
  roleController.createRole.bind(roleController)
);

router.put('/:id', 
  authenticate, 
  validateRequest({ body: updateRoleSchema }), 
  roleController.updateRole.bind(roleController)
);

router.delete('/:id', 
  authenticate, 
  roleController.deleteRole.bind(roleController)
);

router.get('/:id', 
  authenticate, 
  roleController.getRole.bind(roleController)
);

router.get('/', 
  authenticate, 
  roleController.listRoles.bind(roleController)
);

router.get('/permissions/available', 
  authenticate, 
  roleController.getAvailablePermissions.bind(roleController)
);

export default router; 