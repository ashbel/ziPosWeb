import { Request, Response } from 'express';
import { CacheService } from '../services/cache.service';
import { ValidationError } from '../utils/errors';

export class CacheController {
  constructor(private cacheService: CacheService) {}

  async getCache(req: Request, res: Response) {
    try {
      const { key } = req.params;
      const value = await this.cacheService.get(key);
      res.json({ value });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async setCache(req: Request, res: Response) {
    try {
      const { key } = req.params;
      const { value, ttl } = req.body;
      await this.cacheService.set(key, value, ttl);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async deleteCache(req: Request, res: Response) {
    try {
      const { key } = req.params;
      await this.cacheService.delete(key);
      res.json({ success: true });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async clearCache(req: Request, res: Response) {
    try {
      await this.cacheService.clear();
      res.json({ success: true });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getCacheStats(req: Request, res: Response) {
    try {
      const stats = await this.cacheService.getStats();
      res.json(stats);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
} 