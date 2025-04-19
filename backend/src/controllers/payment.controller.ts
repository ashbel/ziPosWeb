import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { ValidationError } from '../utils/errors';

export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  async createPaymentMethod(req: Request, res: Response) {
    try {
      const { customerId } = req.params;
      const paymentMethod = await this.paymentService.createPaymentMethod(customerId, req.body);
      res.status(201).json(paymentMethod);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async createPaymentIntent(req: Request, res: Response) {
    try {
      const paymentIntent = await this.paymentService.createPaymentIntent(req.body);
      res.status(201).json(paymentIntent);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async confirmPayment(req: Request, res: Response) {
    try {
      const { paymentIntentId } = req.params;
      const paymentIntent = await this.paymentService.confirmPayment(paymentIntentId);
      res.json(paymentIntent);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async refundPayment(req: Request, res: Response) {
    try {
      const { paymentIntentId } = req.params;
      const refund = await this.paymentService.refundPayment(paymentIntentId, req.body);
      res.json(refund);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getPaymentMethods(req: Request, res: Response) {
    try {
      const { customerId } = req.params;
      const paymentMethods = await this.paymentService.getPaymentMethods(customerId);
      res.json(paymentMethods);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async deletePaymentMethod(req: Request, res: Response) {
    try {
      const { paymentMethodId } = req.params;
      await this.paymentService.deletePaymentMethod(paymentMethodId);
      res.status(204).send();
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async createSubscriptionPlan(req: Request, res: Response) {
    try {
      const plan = await this.paymentService.createSubscriptionPlan(req.body);
      res.status(201).json(plan);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async createSubscription(req: Request, res: Response) {
    try {
      const subscription = await this.paymentService.createSubscription(req.body);
      res.status(201).json(subscription);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async cancelSubscription(req: Request, res: Response) {
    try {
      const { subscriptionId } = req.params;
      const subscription = await this.paymentService.cancelSubscription(
        subscriptionId,
        req.body
      );
      res.json(subscription);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getPaymentAnalytics(req: Request, res: Response) {
    try {
      const analytics = await this.paymentService.getPaymentAnalytics(req.query);
      res.json(analytics);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async createPaymentLink(req: Request, res: Response) {
    try {
      const paymentLink = await this.paymentService.createPaymentLink(req.body);
      res.status(201).json({ paymentLink });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
} 