import { Request, Response } from 'express';
import { CustomerService } from '../services/customer.service';
import { ValidationError } from '../utils/errors';
import { validateRequest } from '../middleware/validate-request';
import { CustomerSchema } from '../validators/customer.validator';
import { autoBind } from '../utils/auto-bind';

@autoBind
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {
    this.createCustomer = this.createCustomer.bind(this);
    this.updateCustomer = this.updateCustomer.bind(this);
    this.updateLoyaltyPoints = this.updateLoyaltyPoints.bind(this);
    this.updateCreditLimit = this.updateCreditLimit.bind(this);
    this.getCustomerAnalytics = this.getCustomerAnalytics.bind(this);
    this.getCustomer = this.getCustomer.bind(this);
    this.listCustomers = this.listCustomers.bind(this);
    this.deleteCustomer = this.deleteCustomer.bind(this);
  }

  async createCustomer(req: Request, res: Response) {
    try {
      const customer = await this.customerService.createCustomer(req.body);
      res.status(201).json(customer);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async updateCustomer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const customer = await this.customerService.updateCustomer(id, req.body);
      res.json(customer);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async updateLoyaltyPoints(req: Request, res: Response) {
    try {
      const { customerId } = req.params;
      const { points, transactionId } = req.body;
      const customer = await this.customerService.updateLoyaltyPoints(
        customerId,
        points,
        transactionId
      );
      res.json(customer);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async updateCreditLimit(req: Request, res: Response) {
    try {
      const { customerId } = req.params;
      const creditLimit = await this.customerService.updateCreditLimit(
        customerId,
        req.body
      );
      res.json(creditLimit);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getCustomerAnalytics(req: Request, res: Response) {
    try {
      const { customerId } = req.params;
      const analytics = await this.customerService.getCustomerAnalytics(customerId);
      res.json(analytics);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getCustomer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const customer = await this.customerService.getCustomer(id);
      res.json(customer);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async listCustomers(req: Request, res: Response) {
    try {
      const customers = await this.customerService.listCustomers(req.query);
      res.json(customers);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async deleteCustomer(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await this.customerService.deleteCustomer(id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
} 