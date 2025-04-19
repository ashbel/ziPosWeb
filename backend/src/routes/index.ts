import { Express } from 'express';
import { userRoutes } from './user.routes';
import { productRoutes } from './product.routes';
import { orderRoutes } from './order.routes';
import { inventoryRoutes } from './inventory.routes';
import { authRoutes } from './auth.routes';
import { integrationRoutes } from './integration.routes';
import { healthRoutes } from './health.routes';
import { taxRoutes } from './tax.routes';
import { shippingRoutes } from './shipping.routes';
import { searchRoutes } from './search.routes';
import { notificationRoutes } from './notification.routes';
import { forecastingRoutes } from './forecasting.routes';
import { cacheRoutes } from './cache.routes';
import { discountRouter } from './discount.routes';
import { configurationRoutes } from './configuration.routes';
import { auditRoutes } from './audit.routes';
import { reportRoutes } from './report.routes';
import { customerRoutes } from './customer.routes';


export const setupRoutes = (app: Express) => {
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/integrations', integrationRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/tax', taxRoutes);
  app.use('/api/shipping', shippingRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/forecasting', forecastingRoutes);
  app.use('/api/cache', cacheRoutes);
  app.use('/api/discounts', discountRouter);
  app.use('/api/configuration', configurationRoutes);
  app.use('/api/audit', auditRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/customers', customerRoutes);
}; 