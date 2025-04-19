import { Router } from 'express';
import { InventoryController } from '../controllers/inventory.controller';
import { InventoryService } from '../services/inventory.service';
import { authMiddleware } from '../middleware/auth.middleware';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const inventoryService = new InventoryService(prisma);
const inventoryController = new InventoryController(inventoryService);

/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: Inventory management endpoints
 */

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * /api/inventory/serial:
 *   post:
 *     summary: Track a serial number for a product
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - serialNumber
 *               - cost
 *               - status
 *             properties:
 *               productId:
 *                 type: string
 *               serialNumber:
 *                 type: string
 *               batchNumber:
 *                 type: string
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *               cost:
 *                 type: number
 *               status:
 *                 type: string
 *                 enum: [IN_STOCK, SOLD, DEFECTIVE]
 */
router.post('/serial', inventoryController.trackSerialNumber);

/**
 * @swagger
 * /api/inventory/batch:
 *   post:
 *     summary: Create a new batch
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - batchNumber
 *               - quantity
 *               - manufacturingDate
 *               - expiryDate
 *               - cost
 *             properties:
 *               productId:
 *                 type: string
 *               batchNumber:
 *                 type: string
 *               quantity:
 *                 type: number
 *               manufacturingDate:
 *                 type: string
 *                 format: date-time
 *               expiryDate:
 *                 type: string
 *                 format: date-time
 *               cost:
 *                 type: number
 */
router.post('/batch', inventoryController.createBatch);

/**
 * @swagger
 * /api/inventory/adjust:
 *   post:
 *     summary: Adjust inventory quantity
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - quantity
 *               - reason
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: number
 *               cost:
 *                 type: number
 *               batchNumber:
 *                 type: string
 *               serialNumbers:
 *                 type: array
 *                 items:
 *                   type: string
 *               reason:
 *                 type: string
 *               reference:
 *                 type: string
 */
router.post('/adjust', inventoryController.adjustInventory);

/**
 * @swagger
 * /api/inventory/{productId}/value:
 *   get:
 *     summary: Calculate inventory value for a product
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: method
 *         required: true
 *         schema:
 *           type: string
 *           enum: [FIFO, WEIGHTED_AVERAGE]
 *     responses:
 *       200:
 *         description: Inventory value calculation
 */
router.get('/:productId/value', inventoryController.calculateInventoryValue);

/**
 * @swagger
 * /api/inventory/stock/adjust:
 *   post:
 *     summary: Adjust stock levels
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - branchId
 *               - quantity
 *               - type
 *             properties:
 *               productId:
 *                 type: string
 *               branchId:
 *                 type: string
 *               quantity:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [INCREASE, DECREASE]
 *               reference:
 *                 type: string
 *               notes:
 *                 type: string
 *               cost:
 *                 type: number
 */
router.post('/stock/adjust', inventoryController.adjustStock);

/**
 * @swagger
 * /api/inventory/stock/transfer:
 *   post:
 *     summary: Transfer stock between branches
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - quantity
 *               - fromBranchId
 *               - toBranchId
 *             properties:
 *               productId:
 *                 type: string
 *               quantity:
 *                 type: number
 *               fromBranchId:
 *                 type: string
 *               toBranchId:
 *                 type: string
 *               reference:
 *                 type: string
 *               notes:
 *                 type: string
 */
router.post('/stock/transfer', inventoryController.transferStock);

/**
 * @swagger
 * /api/inventory/stock/count:
 *   post:
 *     summary: Record stock count
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - branchId
 *               - counts
 *             properties:
 *               branchId:
 *                 type: string
 *               counts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - counted
 *                   properties:
 *                     productId:
 *                       type: string
 *                     counted:
 *                       type: number
 *                     notes:
 *                       type: string
 *               reference:
 *                 type: string
 */
router.post('/stock/count', inventoryController.countStock);

/**
 * @swagger
 * /api/inventory/{productId}/{branchId}/movements:
 *   get:
 *     summary: Get stock movements for a product at a branch
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 */
router.get('/:productId/:branchId/movements', inventoryController.getStockMovements);

/**
 * @swagger
 * /api/inventory/{branchId}/value:
 *   get:
 *     summary: Get total inventory value for a branch
 *     tags: [Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 */
router.get('/:branchId/value', inventoryController.getInventoryValue);

export const inventoryRoutes = router;