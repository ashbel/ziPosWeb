import { PrismaClient, Prisma } from '@prisma/client';
import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';

export class ProductService extends BaseService {
  constructor(prisma: PrismaClient, redis: Redis, logger: Logger) {
    super(prisma, redis, logger);
  }

  async createProduct(data: {
    name: string;
    description?: string;
    categoryId: string;
    sku: string;
    barcode?: string;
    price: number;
    cost: number;
  }): Promise<any> {
    // Validate SKU uniqueness
    if (data.sku) {
      const existingProduct = await this.prisma.product.findFirst({
        where: { sku: data.sku }
      });

      if (existingProduct) {
        throw new ValidationError('SKU already exists');
      }
    }

    // Create product
    const product = await this.prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        sku: data.sku,
        barcode: data.barcode,
        price: data.price,
        cost: data.cost
      },
      include: {
        category: true,
        inventory: true
      }
    });

    return product;
  }

  async updateProduct(
    id: string,
    data: Partial<{
      name: string;
      description?: string;
      categoryId: string;
      sku: string;
      barcode?: string;
      price: number;
      cost: number;
    }>
  ): Promise<any> {
    // Validate SKU uniqueness
    if (data.sku) {
      const existingProduct = await this.prisma.product.findFirst({
        where: {
          sku: data.sku,
          NOT: { id }
        }
      });

      if (existingProduct) {
        throw new ValidationError('SKU already exists');
      }
    }

    // Update product
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      },
      include: {
        category: true,
        inventory: true,
        orderItems: true,
        discounts: true
      }
    });

    return product;
  }

  async updateProductPrice(id: string, data: { price: number }): Promise<any> {
    return this.updateProduct(id, { price: data.price });
  }

  async getProduct(id: string): Promise<any> {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        inventory: true,
        orderItems: true,
        discounts: true
      }
    });
  }

  async deleteProduct(id: string): Promise<void> {
    await this.prisma.product.delete({
      where: { id }
    });
  }

  async listProducts(params: {
    page?: number;
    limit?: number;
    categoryId?: string;
  } = {}): Promise<{
    products: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, categoryId } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit*1,
        include: {
          category: true,
          inventory: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      this.prisma.product.count({ where })
    ]);

    return {
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }
} 