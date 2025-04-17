import { Request, Response } from 'express';
import { SearchService } from '../services/search.service';
import { validateRequest } from '../middleware/validate-request';
import { SearchSchema } from '../validators/search.validator';

export class SearchController {
  constructor(private searchService: SearchService) {}

  async search(req: Request, res: Response) {
    await validateRequest(req, SearchSchema.search);
    const results = await this.searchService.search(
      req.params.type,
      req.body
    );
    res.json(results);
  }

  async suggest(req: Request, res: Response) {
    await validateRequest(req, SearchSchema.suggest);
    const suggestions = await this.searchService.suggest(
      req.params.type,
      req.query.field as string,
      req.query.prefix as string,
      {
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
        minScore: req.query.minScore ? parseFloat(req.query.minScore as string) : undefined
      }
    );
    res.json(suggestions);
  }

  async indexDocument(req: Request, res: Response) {
    await validateRequest(req, SearchSchema.index);
    await this.searchService.indexDocument(req.body);
    res.sendStatus(200);
  }

  async bulkIndex(req: Request, res: Response) {
    await validateRequest(req, SearchSchema.bulkIndex);
    await this.searchService.bulkIndex(req.body);
    res.sendStatus(200);
  }

  async deleteDocument(req: Request, res: Response) {
    await this.searchService.deleteDocument(
      req.params.type,
      req.params.id
    );
    res.sendStatus(200);
  }

  async reindex(req: Request, res: Response) {
    const progress = (percent: number) => {
      res.write(`data: ${JSON.stringify({ progress: percent })}\n\n`);
    };

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      await this.searchService.reindex(req.params.type, {
        batchSize: req.query.batchSize ? parseInt(req.query.batchSize as string) : undefined,
        progressCallback: progress
      });
      res.write('data: {"complete": true}\n\n');
    } catch (error) {
      res.write(`data: {"error": "${error.message}"}\n\n`);
    } finally {
      res.end();
    }
  }
} 