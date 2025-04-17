import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { Decimal } from '@prisma/client/runtime';

interface PromotionRule {
  type: 'percentage' | 'fixed' | 'bogo' | 'points_multiplier';
  value: number;
  minPurchase?: Decimal;
  maxDiscount?: Decimal;
  applicableTo?: {
    products?: string[];
    categories?: string[];
    collections?: string[];
  };
  conditions?: {
    customerGroups?: string[];
    minItems?: number;
    maxItems?: number;
    firstPurchase?: boolean;
    specificDays?: number[];
    timeRange?: {
      start: string;
      end: string;
    };
  };
}

interface PromotionUsage {
  id: string;
  promotionId: string;
  customerId: string;
  orderId: string;
  discountAmount: Decimal;
  usedAt: Date;
}

export class PromotionService extends BaseService {
  async createPromotion(
    data: {
      code: string;
      name: string;
      description?: string;
      rules: PromotionRule[];
      startDate: Date;
      endDate?: Date;
      usageLimit?: number;
      perCustomerLimit?: number;
      isActive: boolean;
      metadata?: Record<string, any>;
    }
  ): Promise<any> {
    // Validate promotion code uniqueness
    const existing = await this.prisma.promotion.findUnique({
      where: { code: data.code }
    });

    if (existing) {
      throw new ValidationError('Promotion code already exists');
    }

    // Validate dates
    if (data.startDate <= new Date()) {
      throw new ValidationError('Start date must be in the future');
    }

    if (data.endDate && data.endDate <= data.startDate) {
      throw new ValidationError('End date must be after start date');
    }

    // Validate rules
    this.validatePromotionRules(data.rules);

    // Create promotion
    return this.prisma.promotion.create({
      data: {
        ...data,
        rules: data.rules as any
      }
    });
  }

  async validatePromotion(
    code: string,
    context: {
      customerId: string;
      items: Array<{
        productId: string;
        quantity: number;
        price: Decimal;
      }>;
      subtotal: Decimal;
      metadata?: Record<string, any>;
    }
  ): Promise<{
    isValid: boolean;
    promotion?: any;
    error?: string;
  }> {
    const promotion = await this.prisma.promotion.findUnique({
      where: { code },
      include: {
        usage: {
          where: {
            customerId: context.customerId
          }
        }
      }
    });

    if (!promotion) {
      return {
        isValid: false,
        error: 'Invalid promotion code'
      };
    }

    // Check if promotion is active
    if (!promotion.isActive) {
      return {
        isValid: false,
        error: 'Promotion is not active'
      };
    }

    // Check dates
    const now = new Date();
    if (promotion.startDate > now) {
      return {
        isValid: false,
        error: 'Promotion has not started yet'
      };
    }

    if (promotion.endDate && promotion.endDate < now) {
      return {
        isValid: false,
        error: 'Promotion has expired'
      };
    }

    // Check usage limits
    if (promotion.usageLimit && promotion.usage.length >= promotion.usageLimit) {
      return {
        isValid: false,
        error: 'Promotion usage limit reached'
      };
    }

    if (
      promotion.perCustomerLimit &&
      promotion.usage.filter(u => u.customerId === context.customerId).length >= promotion.perCustomerLimit
    ) {
      return {
        isValid: false,
        error: 'Customer usage limit reached'
      };
    }

    // Validate rules
    for (const rule of promotion.rules) {
      const ruleValidation = await this.validatePromotionRule(rule, context);
      if (!ruleValidation.isValid) {
        return ruleValidation;
      }
    }

    return {
      isValid: true,
      promotion
    };
  }

  async applyPromotion(
    promotionId: string,
    context: {
      customerId: string;
      orderId: string;
      items: Array<{
        productId: string;
        quantity: number;
        price: Decimal;
      }>;
      subtotal: Decimal;
    }
  ): Promise<{
    discountAmount: Decimal;
    breakdown: Array<{
      rule: PromotionRule;
      amount: Decimal;
    }>;
  }> {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id: promotionId }
    });

    if (!promotion) {
      throw new ValidationError('Promotion not found');
    }

    // Calculate discount for each rule
    const breakdown = await Promise.all(
      promotion.rules.map(async (rule) => ({
        rule,
        amount: await this.calculateRuleDiscount(rule, context)
      }))
    );

    // Sum up total discount
    const discountAmount = breakdown.reduce(
      (total, item) => total.add(item.amount),
      new Decimal(0)
    );

    // Record usage
    await this.prisma.promotionUsage.create({
      data: {
        promotionId,
        customerId: context.customerId,
        orderId: context.orderId,
        discountAmount
      }
    });

    return {
      discountAmount,
      breakdown
    };
  }

  async getPromotionAnalytics(
    promotionId: string,
    options: {
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{
    totalUsage: number;
    totalDiscount: Decimal;
    averageDiscount: Decimal;
    usageByDay: Array<{
      date: Date;
      count: number;
      amount: Decimal;
    }>;
  }> {
    const usage = await this.prisma.promotionUsage.findMany({
      where: {
        promotionId,
        usedAt: {
          gte: options.startDate,
          lte: options.endDate
        }
      }
    });

    const totalDiscount = usage.reduce(
      (sum, item) => sum.add(item.discountAmount),
      new Decimal(0)
    );

    const usageByDay = this.groupUsageByDay(usage);

    return {
      totalUsage: usage.length,
      totalDiscount,
      averageDiscount: usage.length > 0
        ? totalDiscount.div(usage.length)
        : new Decimal(0),
      usageByDay
    };
  }

  private validatePromotionRules(rules: PromotionRule[]): void {
    if (!rules.length) {
      throw new ValidationError('At least one rule is required');
    }

    for (const rule of rules) {
      if (rule.value <= 0) {
        throw new ValidationError('Rule value must be greater than 0');
      }

      if (rule.type === 'percentage' && rule.value > 100) {
        throw new ValidationError('Percentage discount cannot exceed 100%');
      }

      if (rule.minPurchase && rule.minPurchase.lessThan(0)) {
        throw new ValidationError('Minimum purchase amount cannot be negative');
      }

      if (rule.maxDiscount && rule.maxDiscount.lessThan(0)) {
        throw new ValidationError('Maximum discount amount cannot be negative');
      }
    }
  }

  private async validatePromotionRule(
    rule: PromotionRule,
    context: any
  ): Promise<{
    isValid: boolean;
    error?: string;
  }> {
    // Check minimum purchase
    if (rule.minPurchase && context.subtotal.lessThan(rule.minPurchase)) {
      return {
        isValid: false,
        error: `Minimum purchase amount of ${rule.minPurchase} required`
      };
    }

    // Check applicable products
    if (rule.applicableTo?.products?.length) {
      const hasApplicableProduct = context.items.some(
        item => rule.applicableTo!.products!.includes(item.productId)
      );
      if (!hasApplicableProduct) {
        return {
          isValid: false,
          error: 'No applicable products in cart'
        };
      }
    }

    // Check applicable categories
    if (rule.applicableTo?.categories?.length) {
      const products = await this.prisma.product.findMany({
        where: {
          id: {
            in: context.items.map(item => item.productId)
          }
        },
        include: {
          category: true
        }
      });

      const hasApplicableCategory = products.some(
        product => rule.applicableTo!.categories!.includes(product.category.id)
      );

      if (!hasApplicableCategory) {
        return {
          isValid: false,
          error: 'No products from applicable categories'
        };
      }
    }

    // Check conditions
    if (rule.conditions) {
      // Check customer groups
      if (rule.conditions.customerGroups?.length) {
        const customer = await this.prisma.customer.findUnique({
          where: { id: context.customerId },
          include: {
            groups: true
          }
        });

        const inGroup = customer?.groups.some(
          group => rule.conditions!.customerGroups!.includes(group.id)
        );

        if (!inGroup) {
          return {
            isValid: false,
            error: 'Customer not in eligible group'
          };
        }
      }

      // Check item quantity
      const totalItems = context.items.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      if (
        rule.conditions.minItems &&
        totalItems < rule.conditions.minItems
      ) {
        return {
          isValid: false,
          error: `Minimum ${rule.conditions.minItems} items required`
        };
      }

      if (
        rule.conditions.maxItems &&
        totalItems > rule.conditions.maxItems
      ) {
        return {
          isValid: false,
          error: `Maximum ${rule.conditions.maxItems} items allowed`
        };
      }

      // Check first purchase
      if (rule.conditions.firstPurchase) {
        const previousOrders = await this.prisma.order.count({
          where: {
            customerId: context.customerId,
            status: 'completed'
          }
        });

        if (previousOrders > 0) {
          return {
            isValid: false,
            error: 'Not eligible for first purchase promotion'
          };
        }
      }

      // Check specific days
      if (rule.conditions.specificDays?.length) {
        const today = new Date().getDay();
        if (!rule.conditions.specificDays.includes(today)) {
          return {
            isValid: false,
            error: 'Promotion not valid on this day'
          };
        }
      }

      // Check time range
      if (rule.conditions.timeRange) {
        const now = new Date();
        const currentTime = `${now.getHours()}:${now.getMinutes()}`;
        
        if (
          currentTime < rule.conditions.timeRange.start ||
          currentTime > rule.conditions.timeRange.end
        ) {
          return {
            isValid: false,
            error: 'Promotion not valid at this time'
          };
        }
      }
    }

    return { isValid: true };
  }

  private async calculateRuleDiscount(
    rule: PromotionRule,
    context: any
  ): Promise<Decimal> {
    let discount = new Decimal(0);

    switch (rule.type) {
      case 'percentage':
        discount = context.subtotal.mul(rule.value).div(100);
        break;

      case 'fixed':
        discount = new Decimal(rule.value);
        break;

      case 'bogo':
        discount = await this.calculateBogoDiscount(rule, context);
        break;

      case 'points_multiplier':
        // Points multiplier doesn't affect the discount amount
        discount = new Decimal(0);
        break;
    }

    // Apply maximum discount if specified
    if (rule.maxDiscount && discount.greaterThan(rule.maxDiscount)) {
      discount = rule.maxDiscount;
    }

    return discount;
  }

  private async calculateBogoDiscount(
    rule: PromotionRule,
    context: any
  ): Promise<Decimal> {
    let discount = new Decimal(0);

    // Group items by product
    const itemsByProduct = context.items.reduce((acc: any, item: any) => {
      if (!acc[item.productId]) {
        acc[item.productId] = {
          quantity: 0,
          price: item.price
        };
      }
      acc[item.productId].quantity += item.quantity;
      return acc;
    }, {});

    // Calculate BOGO discount for each product
    for (const [productId, data] of Object.entries(itemsByProduct)) {
      const { quantity, price } = data as { quantity: number; price: Decimal };
      const freeItems = Math.floor(quantity / 2);
      discount = discount.add(price.mul(freeItems));
    }

    return discount;
  }

  private groupUsageByDay(
    usage: PromotionUsage[]
  ): Array<{
    date: Date;
    count: number;
    amount: Decimal;
  }> {
    const byDay = usage.reduce((acc: any, item) => {
      const date = item.usedAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          count: 0,
          amount: new Decimal(0)
        };
      }
      acc[date].count++;
      acc[date].amount = acc[date].amount.add(item.discountAmount);
      return acc;
    }, {});

    return Object.entries(byDay).map(([date, data]: [string, any]) => ({
      date: new Date(date),
      count: data.count,
      amount: data.amount
    }));
  }
} 