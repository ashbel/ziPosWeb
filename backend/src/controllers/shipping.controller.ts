import { Request, Response } from 'express';
import { ShippingService } from '../services/shipping.service';
import { ValidationError } from '../utils/errors';
import { Decimal } from 'decimal.js';

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
      const { orderId, carrier, from, to, weight, dimensions, items } = req.body;

      const shipment = await this.shippingService.createShipment(
        orderId,
        {
          carrier,
          origin: from,
          destination: to,
          packages: [{
            weight,
            length: dimensions.length,
            width: dimensions.width,
            height: dimensions.height,
            value: new Decimal(0),
            contents: items
          }],
          service: 'standard'
        }
      );

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
        trackingNumber,
        carrier
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