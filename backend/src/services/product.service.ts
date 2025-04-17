import { PrismaClient } from '@prisma/client';
import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { DateTime } from 'luxon';
import { S3 } from 'aws-sdk';
import sharp from 'sharp';

interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  cost?: number;
  barcode?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
}

interface ProductImage {
  id: string;
  url: string;
  alt?: string;
  position: number;
  variants?: string[];
}

interface PricingRule {
  id: string;
  name: string;
  type: 'fixed' | 'percentage' | 'bulk';
  value: number;
  minQuantity?: number;
  maxQuantity?: number;
  startDate?: Date;
  endDate?: Date;
  customerGroups?: string[];
}

export class ProductService extends BaseService {
  private s3: S3;

  constructor(deps: any) {
    super(deps);
    
    this.s3 = new S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION
    });
  }

  async createProduct(data: {
    name: string;
    description?: string;
    categoryId?: string;
    tags?: string[];
    status: 'active' | 'draft' | 'archived';
    type: 'simple' | 'variable';
    sku?: string;
    barcode?: string;
    price?: number;
    compareAtPrice?: number;
    cost?: number;
    taxable: boolean;
    taxClassId?: string;
    weight?: number;
    dimensions?: {
      length: number;
      width: number;
      height: number;
    };
    attributes?: Record<string, string[]>;
    variants?: Omit<ProductVariant, 'id'>[];
    images?: Omit<ProductImage, 'id' | 'url'>[];
    metadata?: Record<string, any>;
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
        tags: data.tags,
        status: data.status,
        type: data.type,
        sku: data.sku,
        barcode: data.barcode,
        price: data.price,
        compareAtPrice: data.compareAtPrice,
        cost: data.cost,
        taxable: data.taxable,
        taxClassId: data.taxClassId,
        weight: data.weight,
        dimensions: data.dimensions,
        attributes: data.attributes,
        metadata: data.metadata
      }
    });

    // Create variants if product is variable
    if (data.type === 'variable' && data.variants) {
      await this.createProductVariants(product.id, data.variants);
    }

    // Process and upload images
    if (data.images?.length) {
      await this.processProductImages(product.id, data.images);
    }

    // Index product for search
    await this.indexProduct(product);

    return this.getProduct(product.id);
  }

  async updateProduct(
    id: string,
    data: Partial<Parameters<typeof this.createProduct>[0]>
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
      }
    });

    // Update variants if provided
    if (data.variants) {
      await this.updateProductVariants(id, data.variants);
    }

    // Update images if provided
    if (data.images) {
      await this.updateProductImages(id, data.images);
    }

    // Update search index
    await this.indexProduct(product);

    return this.getProduct(id);
  }

  async getProduct(id: string): Promise<any> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        variants: true,
        images: {
          orderBy: { position: 'asc' }
        },
        pricingRules: {
          where: {
            OR: [
              {
                startDate: null,
                endDate: null
              },
              {
                startDate: { lte: new Date() },
                endDate: { gte: new Date() }
              }
            ]
          }
        }
      }
    });

    if (!product) {
      throw new ValidationError('Product not found');
    }

    return product;
  }

  async searchProducts(params: {
    query?: string;
    categoryId?: string;
    tags?: string[];
    status?: string[];
    priceRange?: { min?: number; max?: number };
    inStock?: boolean;
    page?: number;
    limit?: number;
    sort?: {
      field: string;
      order: 'asc' | 'desc';
    };
  }): Promise<{
    products: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const {
      query,
      categoryId,
      tags,
      status,
      priceRange,
      inStock,
      page = 1,
      limit = 20,
      sort = { field: 'createdAt', order: 'desc' }
    } = params;

    const where: any = {};

    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { sku: { contains: query, mode: 'insensitive' } },
        { barcode: { contains: query, mode: 'insensitive' } }
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (tags?.length) {
      where.tags = { hasEvery: tags };
    }

    if (status?.length) {
      where.status = { in: status };
    }

    if (priceRange) {
      where.price = {
        ...(priceRange.min !== undefined && { gte: priceRange.min }),
        ...(priceRange.max !== undefined && { lte: priceRange.max })
      };
    }

    if (inStock !== undefined) {
      where.stockQuantity = inStock ? { gt: 0 } : { lte: 0 };
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: {
          category: true,
          variants: true,
          images: {
            orderBy: { position: 'asc' }
          }
        },
        orderBy: { [sort.field]: sort.order },
        skip: (page - 1) * limit,
        take: limit
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

  async createCategory(data: {
    name: string;
    description?: string;
    parentId?: string;
    image?: {
      data: Buffer;
      mimetype: string;
    };
    metadata?: Record<string, any>;
  }): Promise<any> {
    let imageUrl: string | undefined;

    if (data.image) {
      imageUrl = await this.uploadCategoryImage(data.image);
    }

    return this.prisma.category.create({
      data: {
        name: data.name,
        description: data.description,
        parentId: data.parentId,
        imageUrl,
        metadata: data.metadata
      }
    });
  }

  async createPricingRule(
    productId: string,
    data: Omit<PricingRule, 'id'>
  ): Promise<PricingRule> {
    return this.prisma.pricingRule.create({
      data: {
        ...data,
        productId
      }
    });
  }

  async importProducts(
    data: Array<Parameters<typeof this.createProduct>[0]>
  ): Promise<{
    successful: number;
    failed: number;
    errors: Array<{ index: number; error: string }>;
  }> {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as Array<{ index: number; error: string }>
    };

    for (let i = 0; i < data.length; i++) {
      try {
        await this.createProduct(data[i]);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          index: i,
          error: error.message
        });
      }
    }

    return results;
  }

  private async createProductVariants(
    productId: string,
    variants: Omit<ProductVariant, 'id'>[]
  ): Promise<void> {
    await this.prisma.productVariant.createMany({
      data: variants.map(variant => ({
        ...variant,
        productId
      }))
    });
  }

  private async updateProductVariants(
    productId: string,
    variants: Omit<ProductVariant, 'id'>[]
  ): Promise<void> {
    // Delete existing variants
    await this.prisma.productVariant.deleteMany({
      where: { productId }
    });

    // Create new variants
    await this.createProductVariants(productId, variants);
  }

  private async processProductImages(
    productId: string,
    images: Omit<ProductImage, 'id' | 'url'>[]
  ): Promise<void> {
    const processedImages = await Promise.all(
      images.map(async (image, index) => {
        const url = await this.uploadProductImage(
          productId,
          image,
          index
        );
        return {
          ...image,
          url,
          position: index,
          productId
        };
      })
    );

    await this.prisma.productImage.createMany({
      data: processedImages
    });
  }

  private async updateProductImages(
    productId: string,
    images: Omit<ProductImage, 'id' | 'url'>[]
  ): Promise<void> {
    // Delete existing images
    await this.prisma.productImage.deleteMany({
      where: { productId }
    });

    // Upload and create new images
    await this.processProductImages(productId, images);
  }

  private async uploadProductImage(
    productId: string,
    image: any,
    position: number
  ): Promise<string> {
    const optimizedImage = await sharp(image.data)
      .resize(1200, 1200, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    const key = `products/${productId}/${position}-${Date.now()}.jpg`;
    
    await this.s3.upload({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Body: optimizedImage,
      ContentType: 'image/jpeg',
      ACL: 'public-read'
    }).promise();

    return `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${key}`;
  }

  private async uploadCategoryImage(image: {
    data: Buffer;
    mimetype: string;
  }): Promise<string> {
    const optimizedImage = await sharp(image.data)
      .resize(800, 800, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    const key = `categories/${Date.now()}.jpg`;
    
    await this.s3.upload({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Body: optimizedImage,
      ContentType: 'image/jpeg',
      ACL: 'public-read'
    }).promise();

    return `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${key}`;
  }

  private async indexProduct(product: any): Promise<void> {
    // Implement search indexing logic here
    // This could use Elasticsearch, Algolia, or similar
    // For now, we'll just log that indexing would happen
    this.logger.info(`Indexing product ${product.id}`);
  }

  async createProductBundle(data: {
    name: string;
    description?: string;
    items: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
    }>;
    price: number;
    compareAtPrice?: number;
    status: 'active' | 'draft';
  }): Promise<any> {
    // Validate all products exist
    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: data.items.map(item => item.productId)
        }
      },
      include: {
        variants: true
      }
    });

    if (products.length !== new Set(data.items.map(i => i.productId)).size) {
      throw new ValidationError('Some products not found');
    }

    // Create bundle
    return this.prisma.productBundle.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        compareAtPrice: data.compareAtPrice,
        status: data.status,
        items: {
          create: data.items
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });
  }

  async createProductCollection(data: {
    name: string;
    description?: string;
    rules?: Array<{
      field: string;
      operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
      value: any;
    }>;
    products?: string[];
    status: 'active' | 'draft';
    sortOrder?: string;
  }): Promise<any> {
    return this.prisma.productCollection.create({
      data: {
        name: data.name,
        description: data.description,
        rules: data.rules,
        status: data.status,
        sortOrder: data.sortOrder,
        products: data.products
          ? {
              connect: data.products.map(id => ({ id }))
            }
          : undefined
      }
    });
  }

  async generateProductReport(
    options: {
      type: 'inventory' | 'sales' | 'performance';
      dateRange?: {
        start: Date;
        end: Date;
      };
      categoryId?: string;
      format?: 'csv' | 'json';
    }
  ): Promise<string> {
    const data = await this.getProductReportData(options);
    
    if (options.format === 'csv') {
      return this.convertToCSV(data);
    }
    
    return JSON.stringify(data, null, 2);
  }

  private async getProductReportData(
    options: {
      type: string;
      dateRange?: {
        start: Date;
        end: Date;
      };
      categoryId?: string;
    }
  ): Promise<any[]> {
    switch (options.type) {
      case 'inventory':
        return this.prisma.product.findMany({
          where: {
            categoryId: options.categoryId
          },
          select: {
            id: true,
            name: true,
            sku: true,
            stockQuantity: true,
            variants: {
              select: {
                id: true,
                name: true,
                sku: true,
                stockQuantity: true
              }
            }
          }
        });

      case 'sales':
        return this.prisma.orderItem.groupBy({
          by: ['productId'],
          where: {
            order: {
              createdAt: {
                gte: options.dateRange?.start,
                lte: options.dateRange?.end
              },
              status: 'completed'
            },
            product: {
              categoryId: options.categoryId
            }
          },
          _sum: {
            quantity: true,
            price: true
          }
        });

      case 'performance':
        const sales = await this.prisma.orderItem.groupBy({
          by: ['productId'],
          where: {
            order: {
              createdAt: {
                gte: options.dateRange?.start,
                lte: options.dateRange?.end
              }
            },
            product: {
              categoryId: options.categoryId
            }
          },
          _sum: {
            quantity: true,
            price: true
          }
        });

        const views = await this.prisma.productView.groupBy({
          by: ['productId'],
          where: {
            createdAt: {
              gte: options.dateRange?.start,
              lte: options.dateRange?.end
            },
            product: {
              categoryId: options.categoryId
            }
          },
          _count: true
        });

        return sales.map(sale => ({
          productId: sale.productId,
          sales: sale._sum.price,
          quantity: sale._sum.quantity,
          views: views.find(v => v.productId === sale.productId)?._count || 0,
          conversionRate: views.find(v => v.productId === sale.productId)?._count
            ? (sale._sum.quantity || 0) / views.find(v => v.productId === sale.productId)!._count
            : 0
        }));

      default:
        throw new ValidationError('Invalid report type');
    }
  }
} 