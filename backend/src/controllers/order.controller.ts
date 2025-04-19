import { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { ValidationError } from '../utils/errors';
import { validateRequest } from '../middleware/validate-request';
import { OrderSchema } from '../validators/order.validator';
import { autoBind } from '../utils/auto-bind';

@autoBind
export class OrderController {
  constructor(private readonly orderService: OrderService) {
    this.createOrder = this.createOrder.bind(this);
    this.updateOrder = this.updateOrder.bind(this);
    this.getOrder = this.getOrder.bind(this);
    this.listOrders = this.listOrders.bind(this);
    this.cancelOrder = this.cancelOrder.bind(this);
    this.processOrder = this.processOrder.bind(this);
    this.completeOrder = this.completeOrder.bind(this);
  }

  async createOrder(req: Request, res: Response) {
    try {
      const order = await this.orderService.createOrder(req.body);
      res.status(201).json(order);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async updateOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const order = await this.orderService.updateOrder(id, req.body);
      res.json(order);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const order = await this.orderService.getOrder(id);
      res.json(order);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async listOrders(req: Request, res: Response) {
    try {
      const orders = await this.orderService.listOrders(req.query);
      res.json(orders);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async cancelOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const order = await this.orderService.cancelOrder(id, req.body);
      res.json(order);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async processOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const order = await this.orderService.processOrder(id);
      res.json(order);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async completeOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const order = await this.orderService.completeOrder(id);
      res.json(order);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async addOrderItem(req: Request, res: Response) {
    try {
      const { orderId } = req.params;
      const order = await this.orderService.addOrderItem(orderId, req.body);
      res.json(order);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async updateOrderItem(req: Request, res: Response) {
    try {
      const { orderId, itemId } = req.params;
      const order = await this.orderService.updateOrderItem(
        orderId,
        itemId,
        req.body
      );
      res.json(order);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async removeOrderItem(req: Request, res: Response) {
    try {
      const { orderId, itemId } = req.params;
      const order = await this.orderService.removeOrderItem(orderId, itemId);
      res.json(order);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getOrderAnalytics(req: Request, res: Response) {
    try {
      const analytics = await this.orderService.getOrderAnalytics(req.query);
      res.json(analytics);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
} 