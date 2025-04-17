import { Request, Response } from 'express';
import { ProductService } from '../services/product.service';
import { validateRequest } from '../middleware/validate-request';
import { ProductSchema } from '../validators/product.validator';

export class ProductController {
  constructor(private productService: ProductService) {}

  async createProduct(req: Request, res: Response) {
    await validateRequest(req, ProductSchema.create);
    const product = await this.productService.createProduct(req.body);
    res.status(201).json(product);
  }

  async updateProduct(req: Request, res: Response) {
    await validateRequest(req, ProductSchema.update);
    const product = await this.productService.updateProduct(
      req.params.id,
      req.body
    );
    res.json(product);
  }

  async getProduct(req: Request, res: Response) {
    const product = await this.productService.getProduct(req.params.id);
    res.json(product);
  }

  async searchProducts(req: Request, res: Response) {
    await validateRequest(req, ProductSchema.search);
    const results = await this.productService.searchProducts(req.query);
    res.json(results);
  }

  async createCategory(req: Request, res: Response) {
    await validateRequest(req, ProductSchema.category);
    const category = await this.productService.createCategory(req.body);
    res.status(201).json(category);
  }

  async createPricingRule(req: Request, res: Response) {
    await validateRequest(req, ProductSchema.pricingRule);
    const rule = await this.productService.createPricingRule(
      req.params.productId,
      req.body
    );
    res.status(201).json(rule);
  }

  async importProducts(req: Request, res: Response) {
    await validateRequest(req, ProductSchema.import);
    const result = await this.productService.importProducts(req.body);
    res.json(result);
  }
} 