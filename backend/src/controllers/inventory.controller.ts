import { Request, Response } from 'express';
import { InventoryService } from '../services/inventory.service';
import { ValidationError } from '../utils/errors';
import { validateRequest } from '../middleware/validate-request';
import { InventorySchema } from '../validators/inventory.validator';
import { autoBind } from '../utils/auto-bind';

@autoBind
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {
    this.trackSerialNumber = this.trackSerialNumber.bind(this);
    this.createBatch = this.createBatch.bind(this);
    this.adjustInventory = this.adjustInventory.bind(this);
    this.calculateInventoryValue = this.calculateInventoryValue.bind(this);
    this.adjustStock = this.adjustStock.bind(this);
    this.transferStock = this.transferStock.bind(this);
    this.countStock = this.countStock.bind(this);
  }

  async trackSerialNumber(req: Request, res: Response) {
    try {
      const serialNumber = await this.inventoryService.trackSerialNumber(req.body);
      res.status(201).json(serialNumber);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async createBatch(req: Request, res: Response) {
    try {
      const batch = await this.inventoryService.createBatch(req.body);
      res.status(201).json(batch);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async adjustInventory(req: Request, res: Response) {
    try {
      const inventory = await this.inventoryService.adjustInventory(req.body);
      res.json(inventory);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async calculateInventoryValue(req: Request, res: Response) {
    try {
      const { productId } = req.params;
      const { method } = req.query;
      const value = await this.inventoryService.calculateInventoryValue(
        productId,
        method as string
      );
      res.json(value);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async adjustStock(req: Request, res: Response) {
    try {
      const result = await this.inventoryService.adjustStock(req.body);
      res.json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async transferStock(req: Request, res: Response) {
    try {
      const result = await this.inventoryService.transferStock(req.body);
      res.json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async countStock(req: Request, res: Response) {
    try {
      const result = await this.inventoryService.countStock(req.body);
      res.json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getStockMovements(req: Request, res: Response) {
    try {
      const { productId, branchId } = req.params;
      const { startDate, endDate } = req.query;
      const movements = await this.inventoryService.getStockMovements(
        productId,
        branchId,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );
      res.json(movements);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getInventoryValue(req: Request, res: Response) {
    try {
      const { branchId } = req.params;
      const value = await this.inventoryService.getInventoryValue(branchId);
      res.json(value);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
} 