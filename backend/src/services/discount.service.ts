import { PrismaClient } from '@prisma/client';
import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { DateTime } from 'luxon';

interface DiscountRule {
  type: 'percentage' | 'fixed' | 'buy_x_get_y' | 'bulk';
  value: number;
  minPurchase?: number;
  maxDiscount?: number;
  buyQuantity?: number;
  getQuantity?: number;
  stackable: boolean;
}

interface DiscountCondition {
  type: 'customer_group' | 'first_purchase' | 'total_spent' | 'product' | 'category';
  value: any;
}

interface PromotionCampaign {
  id: string;
  name: string;
  type: 'flash_sale' | 'seasonal' | 'loyalty' | 'referral';
  discounts: string[];
  startDate: Date;
  endDate: Date;
  targetAudience?: {
    customerGroups?: string[];
    minPurchaseHistory?: number;
    locations?: string[];
  };
  triggers?: {
    type: 'cart_value' | 'product_quantity' | 'customer_segment';
    condition: any;
  }[];
  notifications?: {
    email?: boolean;
    sms?: boolean;
    push?: boolean;
  };
}

export class DiscountService extends BaseService {
  constructor(private prisma: PrismaClient) {
    super(prisma);
  }

  async createDiscount(data: {
    code: string;
    name: string;
    description?: string;
    rules: DiscountRule[];
    conditions?: DiscountCondition[];
    startDate?: Date;
    endDate?: Date;
    usageLimit?: number;
    perCustomerLimit?: number;
    status: 'active' | 'inactive' | 'scheduled';
    metadata?: Record<string, any>;
  }): Promise<any> {
    // Validate code uniqueness
    const existingDiscount = await this.prisma.discount.findUnique({
      where: { code: data.code }
    });

    if (existingDiscount) {
      throw new ValidationError('Discount code already exists');
    }

    // Validate dates
    if (data.startDate && data.endDate) {
      if (data.startDate >= data.endDate) {
        throw new ValidationError('End date must be after start date');
      }
    }

    return this.prisma.discount.create({
      data: {
        ...data,
        rules: data.rules,
        conditions: data.conditions || []
      }
    });
  }

  async validateDiscount(
    code: string,
    context: {
      customerId?: string;
      items: Array<{
        productId: string;
        quantity: number;
        price: number;
      }>;
      subtotal: number;
    }
  ): Promise<{
    valid: boolean;
    discount?: any;
    reasons?: string[];
  }> {
    const discount = await this.prisma.discount.findUnique({
      where: { code },
      include: {
        usage: true
      }
    });

    if (!discount) {
      return {
        valid: false,
        reasons: ['Discount code not found']
      };
    }

    const reasons: string[] = [];

    // Check status
    if (discount.status !== 'active') {
      reasons.push('Discount is not active');
    }

    // Check dates
    const now = new Date();
    if (discount.startDate && discount.startDate > now) {
      reasons.push('Discount has not started yet');
    }
    if (discount.endDate && discount.endDate < now) {
      reasons.push('Discount has expired');
    }

    // Check usage limits
    if (discount.usageLimit) {
      const totalUsage = discount.usage.length;
      if (totalUsage >= discount.usageLimit) {
        reasons.push('Discount usage limit reached');
      }
    }

    // Check per-customer limit
    if (context.customerId && discount.perCustomerLimit) {
      const customerUsage = discount.usage.filter(
        u => u.customerId === context.customerId
      ).length;
      if (customerUsage >= discount.perCustomerLimit) {
        reasons.push('Customer usage limit reached');
      }
    }

    // Check conditions
    for (const condition of discount.conditions) {
      const isValid = await this.validateCondition(
        condition,
        context
      );
      if (!isValid) {
        reasons.push(`Condition not met: ${condition.type}`);
      }
    }

    return {
      valid: reasons.length === 0,
      discount: reasons.length === 0 ? discount : undefined,
      reasons: reasons.length > 0 ? reasons : undefined
    };
  }

  async calculateDiscount(
    discount: any,
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
    }>,
    subtotal: number
  ): Promise<{
    discountAmount: number;
    itemDiscounts: Array<{
      productId: string;
      amount: number;
    }>;
  }> {
    let totalDiscount = 0;
    const itemDiscounts: Array<{
      productId: string;
      amount: number;
    }> = [];

    for (const rule of discount.rules) {
      switch (rule.type) {
        case 'percentage':
          if (subtotal >= (rule.minPurchase || 0)) {
            const amount = subtotal * (rule.value / 100);
            totalDiscount += rule.maxDiscount
              ? Math.min(amount, rule.maxDiscount)
              : amount;
          }
          break;

        case 'fixed':
          if (subtotal >= (rule.minPurchase || 0)) {
            totalDiscount += rule.value;
          }
          break;

        case 'buy_x_get_y':
          for (const item of items) {
            const sets = Math.floor(
              item.quantity / (rule.buyQuantity || 1)
            );
            const freeItems = Math.min(
              sets * (rule.getQuantity || 1),
              item.quantity - sets * (rule.buyQuantity || 1)
            );
            const amount = freeItems * item.price;
            totalDiscount += amount;
            itemDiscounts.push({
              productId: item.productId,
              amount
            });
          }
          break;

        case 'bulk':
          if (rule.minPurchase && subtotal >= rule.minPurchase) {
            const amount = subtotal * (rule.value / 100);
            totalDiscount += rule.maxDiscount
              ? Math.min(amount, rule.maxDiscount)
              : amount;
          }
          break;
      }

      if (!rule.stackable) break;
    }

    return {
      discountAmount: totalDiscount,
      itemDiscounts
    };
  }

  async recordDiscountUsage(
    discountId: string,
    data: {
      customerId?: string;
      orderId: string;
      amount: number;
    }
  ): Promise<void> {
    await this.prisma.discountUsage.create({
      data: {
        discountId,
        ...data
      }
    });
  }

  private async validateCondition(
    condition: DiscountCondition,
    context: {
      customerId?: string;
      items: Array<{
        productId: string;
        quantity: number;
        price: number;
      }>;
      subtotal: number;
    }
  ): Promise<boolean> {
    switch (condition.type) {
      case 'customer_group':
        if (!context.customerId) return false;
        const customer = await this.prisma.customer.findUnique({
          where: { id: context.customerId }
        });
        return customer?.groupId === condition.value;

      case 'first_purchase':
        if (!context.customerId) return false;
        const orderCount = await this.prisma.order.count({
          where: { customerId: context.customerId }
        });
        return orderCount === 0;

      case 'total_spent':
        if (!context.customerId) return false;
        const totalSpent = await this.prisma.order.aggregate({
          where: {
            customerId: context.customerId,
            status: 'completed'
          },
          _sum: { total: true }
        });
        return (totalSpent._sum.total || 0) >= condition.value;

      case 'product':
        return context.items.some(
          item => item.productId === condition.value
        );

      case 'category':
        const products = await this.prisma.product.findMany({
          where: {
            id: {
              in: context.items.map(item => item.productId)
            }
          }
        });
        return products.some(
          product => product.categoryId === condition.value
        );

      default:
        return false;
    }
  }

  async createPromotionCampaign(
    data: Omit<PromotionCampaign, 'id'>
  ): Promise<PromotionCampaign> {
    // Validate dates
    if (data.startDate >= data.endDate) {
      throw new ValidationError('End date must be after start date');
    }

    // Validate discounts exist
    const discounts = await this.prisma.discount.findMany({
      where: {
        id: { in: data.discounts }
      }
    });

    if (discounts.length !== data.discounts.length) {
      throw new ValidationError('Some discount codes not found');
    }

    return this.prisma.promotionCampaign.create({
      data: {
        ...data,
        status: 'scheduled'
      },
      include: {
        discounts: true
      }
    });
  }

  async generateUniqueDiscountCodes(
    data: {
      prefix: string;
      count: number;
      length: number;
      discountRule: DiscountRule;
      expiryDate?: Date;
    }
  ): Promise<string[]> {
    const codes: string[] = [];
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    
    while (codes.length < data.count) {
      const code = `${data.prefix}-${Array.from(
        { length: data.length },
        () => characters[Math.floor(Math.random() * characters.length)]
      ).join('')}`;

      // Check if code already exists
      const exists = await this.prisma.discount.findUnique({
        where: { code }
      });

      if (!exists) {
        await this.createDiscount({
          code,
          name: `Generated code ${code}`,
          rules: [data.discountRule],
          status: 'active',
          endDate: data.expiryDate
        });
        codes.push(code);
      }
    }

    return codes;
  }

  async analyzeDiscountPerformance(
    options: {
      discountId?: string;
      campaignId?: string;
      dateRange?: {
        start: Date;
        end: Date;
      };
    }
  ): Promise<{
    usage: number;
    revenue: number;
    averageOrderValue: number;
    conversionRate: number;
    costToCompany: number;
    roi: number;
  }> {
    const where: any = {};

    if (options.discountId) {
      where.discountId = options.discountId;
    }

    if (options.campaignId) {
      where.discount = {
        campaignId: options.campaignId
      };
    }

    if (options.dateRange) {
      where.createdAt = {
        gte: options.dateRange.start,
        lte: options.dateRange.end
      };
    }

    const [usage, orders] = await Promise.all([
      this.prisma.discountUsage.findMany({
        where,
        include: {
          order: true
        }
      }),
      this.prisma.order.findMany({
        where: {
          discountUsage: {
            some: where
          }
        }
      })
    ]);

    const totalRevenue = orders.reduce(
      (sum, order) => sum + order.total,
      0
    );
    const totalDiscount = usage.reduce(
      (sum, use) => sum + use.amount,
      0
    );

    return {
      usage: usage.length,
      revenue: totalRevenue,
      averageOrderValue: totalRevenue / orders.length || 0,
      conversionRate: orders.length / usage.length || 0,
      costToCompany: totalDiscount,
      roi: (totalRevenue - totalDiscount) / totalDiscount || 0
    };
  }

  async bulkUpdateDiscounts(
    filter: {
      ids?: string[];
      status?: string;
      endDateBefore?: Date;
    },
    updates: {
      status?: string;
      endDate?: Date;
      rules?: DiscountRule[];
    }
  ): Promise<number> {
    const where: any = {};

    if (filter.ids?.length) {
      where.id = { in: filter.ids };
    }

    if (filter.status) {
      where.status = filter.status;
    }

    if (filter.endDateBefore) {
      where.endDate = { lte: filter.endDateBefore };
    }

    const result = await this.prisma.discount.updateMany({
      where,
      data: updates
    });

    return result.count;
  }
} 