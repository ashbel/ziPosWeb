import { Request, Response } from 'express';
import { AuditService } from '../services/audit.service';
import { validateRequest } from '../middleware/validate-request';
import { AuditSchema } from '../validators/audit.validator';
import { DateTime } from 'luxon';

export class AuditController {
  constructor(private auditService: AuditService) {}

  async getEvents(req: Request, res: Response) {
    await validateRequest(req, AuditSchema.query);
    const events = await this.auditService.getEvents(req.query);
    res.json(events);
  }

  async getEventSummary(req: Request, res: Response) {
    await validateRequest(req, AuditSchema.query);
    const summary = await this.auditService.getEventSummary(req.query);
    res.json(summary);
  }

  async getResourceHistory(req: Request, res: Response) {
    const { resourceType, resourceId } = req.params;
    const history = await this.auditService.getResourceHistory(
      resourceType,
      resourceId
    );
    res.json(history);
  }

  async getUserActivity(req: Request, res: Response) {
    const { userId } = req.params;
    const activity = await this.auditService.getUserActivity(
      userId,
      req.query
    );
    res.json(activity);
  }

  async getAnomalies(req: Request, res: Response) {
    await validateRequest(req, AuditSchema.anomalies);
    const anomalies = await this.auditService.getAnomalies(req.query);
    res.json(anomalies);
  }

  async createAlert(req: Request, res: Response) {
    await validateRequest(req, AuditSchema.alert);
    const alert = await this.auditService.createAlert(req.body);
    res.json(alert);
  }

  async resolveAlert(req: Request, res: Response) {
    const { alertId } = req.params;
    const alert = await this.auditService.resolveAlert(
      alertId,
      req.user.id
    );
    res.json(alert);
  }

  async generateComplianceReport(req: Request, res: Response) {
    await validateRequest(req, AuditSchema.compliance);
    const report = await this.auditService.generateComplianceReport(
      req.body.startDate,
      req.body.endDate
    );
    res.json(report);
  }

  async exportAuditLogs(req: Request, res: Response) {
    await validateRequest(req, AuditSchema.export);
    const data = await this.auditService.exportAuditLogs(req.query);
    
    const filename = `audit-logs-${DateTime.now().toFormat('yyyy-MM-dd')}.${
      req.query.format || 'json'
    }`;
    
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    res.setHeader(
      'Content-Type',
      req.query.format === 'csv'
        ? 'text/csv'
        : 'application/json'
    );
    
    res.send(data);
  }
} 