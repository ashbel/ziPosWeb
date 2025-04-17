import { Request, Response } from 'express';
import { ForecastingService } from '../services/forecasting.service';
import { ValidationError } from '../utils/errors';

export class ForecastingController {
  constructor(private forecastingService: ForecastingService) {}

  async predictSales(req: Request, res: Response) {
    try {
      const { productId, categoryId, days, includeSeasonality } = req.query;
      
      const forecasts = await this.forecastingService.predictSales({
        productId: productId as string,
        categoryId: categoryId as string,
        days: days ? parseInt(days as string) : undefined,
        includeSeasonality: includeSeasonality === 'true'
      });

      res.json(forecasts);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async predictInventory(req: Request, res: Response) {
    try {
      const { productId } = req.params;
      const { days, considerLeadTime } = req.query;

      const predictions = await this.forecastingService.predictInventory(productId, {
        days: days ? parseInt(days as string) : undefined,
        considerLeadTime: considerLeadTime === 'true'
      });

      res.json(predictions);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async predictDemand(req: Request, res: Response) {
    try {
      const { productId } = req.params;
      const { days, considerPromotions, considerSeasonality } = req.query;

      const predictions = await this.forecastingService.predictDemand(productId, {
        days: days ? parseInt(days as string) : undefined,
        considerPromotions: considerPromotions === 'true',
        considerSeasonality: considerSeasonality === 'true'
      });

      res.json(predictions);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getSeasonalTrends(req: Request, res: Response) {
    try {
      const trends = await this.forecastingService.getSeasonalTrends();
      res.json(trends);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
} 