import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();
const authController = new AuthController();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and authorization
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authController.login.bind(authController));

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Invalid input
 */
router.post('/register', authController.register.bind(authController));

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh-token', authController.refreshToken.bind(authController));

/**
 * @swagger
 * /api/auth/setup-2fa:
 *   post:
 *     summary: Setup 2FA for user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA setup successful
 *       401:
 *         description: Unauthorized
 */
router.post('/setup-2fa', authMiddleware, authController.setup2FA.bind(authController));

/**
 * @swagger
 * /api/auth/verify-2fa:
 *   post:
 *     summary: Verify 2FA code
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: 2FA verification successful
 *       401:
 *         description: Invalid code
 */
router.post('/verify-2fa', authMiddleware, authController.verify2FA.bind(authController));

/**
 * @swagger
 * /api/auth/enable-2fa:
 *   post:
 *     summary: Enable 2FA for user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA enabled successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/enable-2fa', authMiddleware, authController.enable2FA.bind(authController));

/**
 * @swagger
 * /api/auth/disable-2fa:
 *   post:
 *     summary: Disable 2FA for user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA disabled successfully
 *       401:
 *         description: Unauthorized
 */
router.post('/disable-2fa', authMiddleware, authController.disable2FA.bind(authController));

// OAuth routes (to be implemented)
router.get('/google', authController.googleAuth.bind(authController));
router.get('/google/callback', authController.googleCallback.bind(authController));
router.get('/github', authController.githubAuth.bind(authController));
router.get('/github/callback', authController.githubCallback.bind(authController));
router.get('/facebook', authController.facebookAuth.bind(authController));
router.get('/facebook/callback', authController.facebookCallback.bind(authController));

export const authRoutes = router; 