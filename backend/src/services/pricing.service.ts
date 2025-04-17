import { PrismaClient } from '@prisma/client';

export class PricingService {
  constructor(private prisma: PrismaClient) {}

  async calculatePrice(params: {
    productId: string;
    quantity: number;
    customerId?: string;
    branchId: string;
    date: Date;
  }) {
    const product = await this.prisma.product.findUnique({
      where: { id: params.productId }
    });

    if (!product) throw new Error('Product not found');

    let basePrice = product.basePrice;
    let finalPrice = basePrice;

    // Apply quantity-based pricing
    const quantityPricing = await this.prisma.quantityPricing.findFirst({
      where: {
        productId: params.productId,
        minimumQuantity: {
          lte: params.quantity
        }
      },
      orderBy: {
        minimumQuantity: 'desc'
      }
    });

    if (quantityPricing) {
      finalPrice = quantityPricing.price;
    }

    // Apply customer group pricing
    if (params.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: params.customerId },
        include: { group: true }
      });

      if (customer?.group) {
        const groupPricing = await this.prisma.customerGroupPricing.findFirst({
          where: {
            productId: params.productId,
            customerGroupId: customer.group.id
          }
        });

        if (groupPricing) {
          finalPrice = Math.min(finalPrice, groupPricing.price);
        }
      }
    }

    // Apply time-based pricing
    const timeBasedPricing = await this.prisma.timeBasedPricing.findFirst({
      where: {
        productId: params.productId,
        startDate: { lte: params.date },
        endDate: { gte: params.date },
        daysOfWeek: {
          has: params.date.getDay()
        },
        startTime: { lte: params.date.toTimeString().slice(0, 5) },
        endTime: { gte: params.date.toTimeString().slice(0, 5) }
      }
    });

    if (timeBasedPricing) {
      finalPrice = timeBasedPricing.price;
    }

    // Apply branch-specific pricing
    const branchPricing = await this.prisma.branchPricing.findFirst({
      where: {
        productId: params.productId,
        branchId: params.branchId
      }
    });

    if (branchPricing) {
      finalPrice = branchPricing.price;
    }

    // Apply margin rules
    const marginRules = await this.prisma.marginRule.findMany({
      where: {
        OR: [
          { productId: params.productId },
          { categoryId: product.categoryId }
        ]
      }
    });

    for (const rule of marginRules) {
      const minimumPrice = product.costPrice * (1 + rule.minimumMargin / 100);
      finalPrice = Math.max(finalPrice, minimumPrice);
    }

    return {
      basePrice,
      finalPrice,
      discount: basePrice - finalPrice,
      discountPercentage: ((basePrice - finalPrice) / basePrice) * 100
    };
  }
} 