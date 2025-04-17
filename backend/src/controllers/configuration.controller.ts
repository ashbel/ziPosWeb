import { Request, Response } from 'express';
import { ConfigurationService } from '../services/configuration.service';
import { validateRequest } from '../middleware/validate-request';
import { ConfigurationSchema } from '../validators/configuration.validator';

export class ConfigurationController {
  constructor(private configService: ConfigurationService) {}

  async setConfiguration(req: Request, res: Response) {
    await validateRequest(req, ConfigurationSchema.set);
    await this.configService.setConfiguration(
      req.params.key,
      req.body.value,
      req.body.options
    );
    res.sendStatus(200);
  }

  async getConfiguration(req: Request, res: Response) {
    const value = await this.configService.getConfiguration(
      req.params.key,
      req.query
    );
    res.json(value);
  }

  async setFeatureFlag(req: Request, res: Response) {
    await validateRequest(req, ConfigurationSchema.featureFlag);
    const flag = await this.configService.setFeatureFlag(req.body);
    res.json(flag);
  }

  async checkFeatureFlag(req: Request, res: Response) {
    const enabled = await this.configService.isFeatureEnabled(
      req.params.name,
      req.body.context
    );
    res.json({ enabled });
  }

  async bulkUpdate(req: Request, res: Response) {
    await validateRequest(req, ConfigurationSchema.bulkUpdate);
    await this.configService.bulkUpdateConfiguration(req.body);
    res.sendStatus(200);
  }

  async getHistory(req: Request, res: Response) {
    const history = await this.configService.getConfigurationHistory(
      req.params.key,
      req.query
    );
    res.json(history);
  }
} 