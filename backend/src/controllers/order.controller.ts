import { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { validateRequest } from '../middleware/validate-request';
import { OrderSchema } from '../validators/order.validator';

export class OrderController {
  constructor(private orderService: OrderService) {}

  async createOrder(req: Request, res: Response) {
    await validateRequest(req, OrderSchema.create);
    const order = await this.orderService.createOrder(req.body);
    res.status(201).json(order);
  }

  async updateOrderStatus(req: Request, res: Response) {
    await validateRequest(req, OrderSchema.updateStatus);
    const order = await this.orderService.updateOrderStatus(
      req.params.id,
      req.body.status,
      req.body.note
    );
    res.json(order);
  }

  async processRefund(req: Request, res: Response) {
    await validateRequest(req, OrderSchema.refund);
    const refund = await this.orderService.processRefund(
      req.params.id,
      req.body
    );
    res.json(refund);
  }

  async searchOrders(req: Request, res: Response) {
    await validateRequest(req, OrderSchema.search);
    const results = await this.orderService.searchOrders(req.query);
    res.json(results);
  }
} 