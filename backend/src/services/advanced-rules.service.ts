import { PrismaClient } from '@prisma/client';
import { differenceInDays, startOfDay, endOfDay } from 'date-fns';

export class AdvancedRulesService {
  constructor(private prisma: PrismaClient) {}

  async validateComplexTransaction(data: {
    type: 'SALE' | 'RETURN' | 'ADJUSTMENT';
    items: Array<{
      productId: string;
      quantity: number;
      price?: number;
      serialNumbers?: string[];
      batchNumbers?: string[];
    }>;
    customerId?: string;
    employeeId: string;
    branchId: string;
    paymentMethod?: string;
    discountId?: string;
  }) {
    const errors: string[] = [];

    // Check employee status and limits
    const employee = await this.prisma.employee.findUnique({
      where: { id: data.employeeId },
      include: {
        role: true,
        transactionLimits: true,
        branch: true
      }
    });

    if (!employee) {
      errors.push('Invalid employee');
      return { isValid: false, errors };
    }

    // Check daily transaction limits
    const dailyTransactions = await this.prisma.sale.count({
      where: {
        employeeId: data.employeeId,
        createdAt: {
          gte: startOfDay(new Date()),
          lte: endOfDay(new Date())
        }
      }
    });

    if (
      employee.transactionLimits?.dailyLimit &&
      dailyTransactions >= employee.transactionLimits.dailyLimit
    ) {
      errors.push('Employee daily transaction limit exceeded');
    }

    // Validate serial numbers
    for (const item of data.items) {
      if (item.serialNumbers) {
        const serialNumbers = await this.prisma.serialNumber.findMany({
          where: {
            serialNumber: { in: item.serialNumbers },
            productId: item.productId
          }
        });

        for (const sn of item.serialNumbers) {
          const serialNumber = serialNumbers.find(s => s.serialNumber === sn);
          if (!serialNumber) {
            errors.push(`Invalid serial number: ${sn}`);
          } else if (serialNumber.status !== 'IN_STOCK') {
            errors.push(`Serial number ${sn} is not available for sale`);
          }
        }
      }
    }

    // Validate batch numbers and expiry
    for (const item of data.items) {
      if (item.batchNumbers) {
        const batches = await this.prisma.batch.findMany({
          where: {
            batchNumber: { in: item.batchNumbers },
            productId: item.productId
          }
        });

        for (const bn of item.batchNumbers) {
          const batch = batches.find(b => b.batchNumber === bn);
          if (!batch) {
            errors.push(`Invalid batch number: ${bn}`);
          } else {
            if (batch.expiryDate && batch.expiryDate <= new Date()) {
              errors.push(`Batch ${bn} has expired`);
            }
            if (batch.remainingQuantity < item.quantity) {
              errors.push(`Insufficient quantity in batch ${bn}`);
            }
          }
        }
      }
    }

    // Validate customer purchase frequency
    if (data.customerId && data.type === 'SALE') {
      const customer = await this.prisma.customer.findUnique({
        where: { id: data.customerId },
        include: {
          purchaseFrequency: true,
          lastPurchase: true
        }
      });

      if (customer?.purchaseFrequency) {
        const daysSinceLastPurchase = customer.lastPurchase
          ? differenceInDays(new Date(), customer.lastPurchase)
          : Infinity;

        if (daysSinceLastPurchase < customer.purchaseFrequency.minimumDays) {
          errors.push('Purchase frequency limit exceeded');
        }
      }
    }

    // Validate payment method restrictions
    if (data.paymentMethod) {
      const paymentRestrictions = await this.prisma.paymentMethodRestriction.findFirst({
        where: {
          method: data.paymentMethod,
          branchId: data.branchId
        }
      });

      if (paymentRestrictions) {
        const total = data.items.reduce(
          (sum, item) => sum + (item.price || 0) * item.quantity,
          0
        );

        if (
          total < paymentRestrictions.minimumAmount ||
          (paymentRestrictions.maximumAmount &&
            total > paymentRestrictions.maximumAmount)
        ) {
          errors.push(`Invalid amount for payment method ${data.paymentMethod}`);
        }
      }
    }

    // Validate discount stacking
    if (data.discountId) {
      const discount = await this.prisma.discount.findUnique({
        where: { id: data.discountId },
        include: {
          stackingRules: true
        }
      });

      if (discount?.stackingRules?.preventStacking) {
        const hasOtherDiscounts = data.items.some(item =>
          item.price && item.price < item.price
        );

        if (hasOtherDiscounts) {
          errors.push('Discount stacking not allowed');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async applyAutomatedRules(data: {
    type: 'SALE' | 'RETURN';
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
    }>;
    customerId?: string;
  }) {
    const modifications: any[] = [];

    // Apply quantity-based discounts
    const quantityRules = await this.prisma.quantityDiscount.findMany({
      where: {
        productId: {
          in: data.items.map(item => item.productId)
        }
      }
    });

    for (const item of data.items) {
      const rule = quantityRules.find(r => r.productId === item.productId);
      if (rule && item.quantity >= rule.minimumQuantity) {
        modifications.push({
          type: 'PRICE_ADJUSTMENT',
          itemId: item.productId,
          newPrice: item.price * (1 - rule.discountPercentage / 100)
        });
      }
    }

    // Apply customer loyalty rewards
    if (data.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: data.customerId },
        include: {
          loyaltyTier: true
        }
      });

      if (customer?.loyaltyTier) {
        const discount = customer.loyaltyTier.discountPercentage;
        modifications.push({
          type: 'LOYALTY_DISCOUNT',
          percentage: discount
        });
      }
    }

    // Apply time-based promotions
    const currentHour = new Date().getHours();
    const timePromotions = await this.prisma.timePromotion.findMany({
      where: {
        startHour: { lte: currentHour },
        endHour: { gte: currentHour }
      }
    });

    for (const promotion of timePromotions) {
      modifications.push({
        type: 'TIME_PROMOTION',
        promotionId: promotion.id,
        discount: promotion.discountPercentage
      });
    }

    return modifications;
  }
} 