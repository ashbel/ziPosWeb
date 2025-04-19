import { Request, Response } from 'express';
import { ReportService } from '../services/report.service';
import { ValidationError } from '../utils/errors';

export class ReportController {
  constructor(private reportService: ReportService) {}

  async getSalesReport(req: Request, res: Response) {
    try {
      const report = await this.reportService.getSalesReport(req.query);
      res.json(report);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getInventoryReport(req: Request, res: Response) {
    try {
      const report = await this.reportService.getInventoryReport(req.query);
      res.json(report);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getCustomerReport(req: Request, res: Response) {
    try {
      const report = await this.reportService.getCustomerReport(req.query);
      res.json(report);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
} 