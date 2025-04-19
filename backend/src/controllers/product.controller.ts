import { Request, Response } from 'express';
import { ProductService } from '../services/product.service';
import { validateRequest } from '../middleware/validate-request';
import { ProductSchema } from '../validators/product.validator';
import { ValidationError } from '../utils/errors';
import { autoBind } from '../utils/auto-bind';

@autoBind
export class ProductController {

  constructor(private readonly productService: ProductService) {
    this.createProduct = this.createProduct.bind(this);
    this.updateProduct = this.updateProduct.bind(this);
    this.getProduct = this.getProduct.bind(this);
    this.searchProducts = this.searchProducts.bind(this);
    this.createCategory = this.createCategory.bind(this);
    this.createPricingRule = this.createPricingRule.bind(this);
    this.importProducts = this.importProducts.bind(this);
    this.listProducts = this.listProducts.bind(this);
    this.deleteProduct = this.deleteProduct.bind(this);
    this.updateProductPrice = this.updateProductPrice.bind(this);
    this.updateProductStock = this.updateProductStock.bind(this);
    this.getProductAnalytics = this.getProductAnalytics.bind(this);
    this.createProductVariant = this.createProductVariant.bind(this);
    this.updateProductVariant = this.updateProductVariant.bind(this);
    this.deleteProductVariant = this.deleteProductVariant.bind(this);
  }
  
  async createProduct(req: Request, res: Response) {
    try {
      const product = await this.productService.createProduct(req.body);
      res.status(201).json(product);
    } catch (error) {
      console.log(error);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async updateProduct(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const product = await this.productService.updateProduct(id, req.body);
      res.json(product);
    } catch (error) {
      console.log(error);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getProduct(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const product = await this.productService.getProduct(id);
      res.json(product);
    } catch (error) {
      console.log(error);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
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

  async listProducts(req: Request, res: Response) {
    try {
      const products = await this.productService.listProducts(req.query);
      res.json(products);
    } catch (error) {
      console.log(error);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async deleteProduct(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await this.productService.deleteProduct(id);
      res.status(204).send();
    } catch (error) {
      console.log(error);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async updateProductPrice(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const product = await this.productService.updateProductPrice(id, req.body);
      res.json(product);
    } catch (error) {
      console.log(error);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async updateProductStock(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const product = await this.productService.updateProductStock(id, req.body);
      res.json(product);
    } catch (error) {
      console.log(error);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getProductAnalytics(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const analytics = await this.productService.getProductAnalytics(id);
      res.json(analytics);
    } catch (error) {
      console.log(error);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async createProductVariant(req: Request, res: Response) {
    try {
      const { productId } = req.params;
      const variant = await this.productService.createProductVariant(
        productId,
        req.body
      );
      res.status(201).json(variant);
    } catch (error) {
      console.log(error);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async updateProductVariant(req: Request, res: Response) {
    try {
      const { productId, variantId } = req.params;
      const variant = await this.productService.updateProductVariant(
        productId,
        variantId,
        req.body
      );
      res.json(variant);
    } catch (error) {
      console.log(error);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async deleteProductVariant(req: Request, res: Response) {
    try {
      const { productId, variantId } = req.params;
      await this.productService.deleteProductVariant(productId, variantId);
      res.status(204).send();
    } catch (error) {
      console.log(error);
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
} 