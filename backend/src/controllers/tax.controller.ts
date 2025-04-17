import { Request, Response } from 'express';
import { TaxService } from '../services/tax.service';
import { ValidationError } from '../utils/errors';

export class TaxController {
  constructor(private taxService: TaxService) {}

  async createTaxRate(req: Request, res: Response) {
    try {
      const { name, rate, type, jurisdiction } = req.body;
      const taxRate = await this.taxService.createTaxRate({
        name,
        rate,
        type,
        jurisdiction
      });
      res.json(taxRate);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async calculateTax(req: Request, res: Response) {
    try {
      const { items, shippingAddress, billingAddress } = req.body;
      const tax = await this.taxService.calculateTax({
        items,
        shippingAddress,
        billingAddress
      });
      res.json(tax);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async createTaxExemption(req: Request, res: Response) {
    try {
      const { customerId, certificateNumber, type, validFrom, validTo } = req.body;
      const exemption = await this.taxService.createTaxExemption({
        customerId,
        certificateNumber,
        type,
        validFrom,
        validTo
      });
      res.json(exemption);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async validateTaxExemption(req: Request, res: Response) {
    try {
      const { certificateNumber, type } = req.body;
      const validation = await this.taxService.validateTaxExemptionCertificate(
        certificateNumber,
        type
      );
      res.json(validation);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getTaxReport(req: Request, res: Response) {
    try {
      const { startDate, endDate, jurisdiction } = req.query;
      const report = await this.taxService.generateTaxReport({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        jurisdiction: jurisdiction as string
      });
      res.json(report);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async createTaxRule(req: Request, res: Response) {
    try {
      const { name, priority, conditions, actions } = req.body;
      const rule = await this.taxService.createTaxRule({
        name,
        priority,
        conditions,
        actions
      });
      res.json(rule);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async calculateTaxJurisdictions(req: Request, res: Response) {
    try {
      const { address } = req.body;
      const jurisdictions = await this.taxService.calculateTaxJurisdictions(address);
      res.json(jurisdictions);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async generateTaxForecast(req: Request, res: Response) {
    try {
      const { startDate, endDate, jurisdiction } = req.query;
      const forecast = await this.taxService.generateTaxForecast({
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        jurisdiction: jurisdiction as string
      });
      res.json(forecast);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
} 