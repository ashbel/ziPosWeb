import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { validateRequest } from '../middleware/validate-request';
import { AnalyticsSchema } from '../validators/analytics.validator';

export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  async trackMetric(req: Request, res: Response) {
    await validateRequest(req, AnalyticsSchema.metric);
    const metric = await this.analyticsService.trackMetric(req.body);
    res.json(metric);
  }

  async batchTrackMetrics(req: Request, res: Response) {
    await validateRequest(req, AnalyticsSchema.batchMetrics);
    await this.analyticsService.batchTrackMetrics(req.body);
    res.sendStatus(200);
  }

  async queryMetrics(req: Request, res: Response) {
    await validateRequest(req, AnalyticsSchema.query);
    const report = await this.analyticsService.queryMetrics(req.body);
    res.json(report);
  }

  async getTopMetrics(req: Request, res: Response) {
    await validateRequest(req, AnalyticsSchema.topMetrics);
    const metrics = await this.analyticsService.getTopMetrics(req.query);
    res.json(metrics);
  }

  async createDashboard(req: Request, res: Response) {
    await validateRequest(req, AnalyticsSchema.dashboard);
    const dashboard = await this.analyticsService.createDashboard(
      req.body
    );
    res.json(dashboard);
  }

  async getDashboardData(req: Request, res: Response) {
    const data = await this.analyticsService.getDashboardData(
      req.params.dashboardId
    );
    res.json(data);
  }

  async createAlert(req: Request, res: Response) {
    await validateRequest(req, AnalyticsSchema.alert);
    const alert = await this.analyticsService.createAlert(req.body);
    res.json(alert);
  }

  async getForecast(req: Request, res: Response) {
    await validateRequest(req, AnalyticsSchema.forecast);
    const forecast = await this.analyticsService.getForecast(req.query);
    res.json(forecast);
  }

  async getCorrelations(req: Request, res: Response) {
    await validateRequest(req, AnalyticsSchema.correlations);
    const correlations = await this.analyticsService.getCorrelations(
      req.body
    );
    res.json(correlations);
  }

  async generateReport(req: Request, res: Response) {
    await validateRequest(req, AnalyticsSchema.report);
    const report = await this.analyticsService.generateReport(req.body);

    const filename = `analytics-report-${DateTime.now().toFormat('yyyy-MM-dd')}.${
      req.body.format || 'json'
    }`;

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    res.setHeader(
      'Content-Type',
      req.body.format === 'csv'
        ? 'text/csv'
        : 'application/json'
    );

    res.send(report);
  }
} 