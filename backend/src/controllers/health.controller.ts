import { Request, Response } from 'express';
import { HealthService } from '../services/health.service';
import { ValidationError } from '../utils/errors';

export class HealthController {
  constructor(private healthService: HealthService) {}

  async getHealth(req: Request, res: Response) {
    try {
      const health = await this.healthService.getHealth();
      res.json(health);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async checkService(req: Request, res: Response) {
    try {
      const { name } = req.params;
      const status = await this.healthService.checkService(name);
      res.json(status);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getMetrics(req: Request, res: Response) {
    try {
      const metrics = await this.healthService.getMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
} 