import { Request, Response } from 'express';
import { IntegrationService } from '../services/integration.service';
import { ValidationError } from '../utils/errors';

export class IntegrationController {
  constructor(private integrationService: IntegrationService) {}

  async createIntegration(req: Request, res: Response) {
    try {
      const { name, type, config, enabled } = req.body;
      const integration = await this.integrationService.createIntegration({
        name,
        type,
        config,
        enabled
      });
      res.json(integration);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async updateIntegration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, config, enabled } = req.body;
      const integration = await this.integrationService.updateIntegration(id, {
        name,
        config,
        enabled
      });
      res.json(integration);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async deleteIntegration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await this.integrationService.deleteIntegration(id);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getIntegration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const integration = await this.integrationService.getIntegration(id);
      res.json(integration);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async listIntegrations(req: Request, res: Response) {
    try {
      const { type, enabled } = req.query;
      const integrations = await this.integrationService.listIntegrations({
        type: type as string,
        enabled: enabled ? enabled === 'true' : undefined
      });
      res.json(integrations);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async testIntegration(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await this.integrationService.testIntegration(id);
      res.json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async createWebhook(req: Request, res: Response) {
    try {
      const { integrationId, event, url, secret } = req.body;
      const webhook = await this.integrationService.createWebhook({
        integrationId,
        event,
        url,
        secret
      });
      res.json(webhook);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async deleteWebhook(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await this.integrationService.deleteWebhook(id);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async listWebhooks(req: Request, res: Response) {
    try {
      const { integrationId } = req.query;
      const webhooks = await this.integrationService.listWebhooks(
        integrationId as string
      );
      res.json(webhooks);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async createApiKey(req: Request, res: Response) {
    try {
      const { integrationId, name, permissions } = req.body;
      const apiKey = await this.integrationService.createApiKey({
        integrationId,
        name,
        permissions
      });
      res.json(apiKey);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async deleteApiKey(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await this.integrationService.deleteApiKey(id);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async listApiKeys(req: Request, res: Response) {
    try {
      const { integrationId } = req.query;
      const apiKeys = await this.integrationService.listApiKeys(
        integrationId as string
      );
      res.json(apiKeys);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
} 