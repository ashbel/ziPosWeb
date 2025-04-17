import { Request, Response } from 'express';
import { ShippingService } from '../services/shipping.service';
import { ValidationError } from '../utils/errors';

export class ShippingController {
  constructor(private shippingService: ShippingService) {}

  async getRates(req: Request, res: Response) {
    try {
      const { carrier, from, to, weight, dimensions } = req.body;
      
      const rates = await this.shippingService.getRates({
        carrier,
        from,
        to,
        weight,
        dimensions
      });

      res.json(rates);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async createShipment(req: Request, res: Response) {
    try {
      const { carrier, from, to, weight, dimensions, items } = req.body;

      const shipment = await this.shippingService.createShipment({
        carrier,
        from,
        to,
        weight,
        dimensions,
        items
      });

      res.json(shipment);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async trackShipment(req: Request, res: Response) {
    try {
      const { carrier, trackingNumber } = req.params;

      const tracking = await this.shippingService.trackShipment(
        carrier,
        trackingNumber
      );

      res.json(tracking);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async validateAddress(req: Request, res: Response) {
    try {
      const { address } = req.body;

      const validation = await this.shippingService.validateAddress(address);

      res.json(validation);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
} 