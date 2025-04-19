import { Request, Response } from 'express';
import { DiscountService } from '../services/discount.service';
import { validateRequest } from '../middleware/validate-request';
import { DiscountSchema } from '../validators/discount.validator';

export class DiscountController {
  constructor(private discountService: DiscountService) {}

  async getDiscounts(req: Request, res: Response) {
    const discounts = await this.discountService.getDiscounts();
    res.json(discounts);
  }

  async createDiscount(req: Request, res: Response) {
    await validateRequest(req, DiscountSchema.create);
    const discount = await this.discountService.createDiscount(req.body);
    res.status(201).json(discount);
  }

  async updateDiscount(req: Request, res: Response) {
    await validateRequest(req, DiscountSchema.update);
    const discount = await this.discountService.updateDiscount(req.params.id, req.body);
    res.json(discount);
  }

  async deleteDiscount(req: Request, res: Response) {
    await this.discountService.deleteDiscount(req.params.id);
    res.status(204).send();
  }

  async validateDiscount(req: Request, res: Response) {
    await validateRequest(req, DiscountSchema.validate);
    const result = await this.discountService.validateDiscount(
      req.params.code,
      req.body
    );
    res.json(result);
  }

  async createPromotionCampaign(req: Request, res: Response) {
    await validateRequest(req, DiscountSchema.campaign);
    const campaign = await this.discountService.createPromotionCampaign(
      req.body
    );
    res.status(201).json(campaign);
  }

  async generateDiscountCodes(req: Request, res: Response) {
    await validateRequest(req, DiscountSchema.generate);
    const codes = await this.discountService.generateUniqueDiscountCodes(
      req.body
    );
    res.json(codes);
  }

  async getPerformanceAnalytics(req: Request, res: Response) {
    await validateRequest(req, DiscountSchema.analytics);
    const analytics = await this.discountService.analyzeDiscountPerformance(
      req.query
    );
    res.json(analytics);
  }

  async bulkUpdateDiscounts(req: Request, res: Response) {
    await validateRequest(req, DiscountSchema.bulkUpdate);
    const count = await this.discountService.bulkUpdateDiscounts(
      req.body.filter,
      req.body.updates
    );
    res.json({ updatedCount: count });
  }
} 