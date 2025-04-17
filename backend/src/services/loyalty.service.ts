import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { Decimal } from '@prisma/client/runtime';

interface LoyaltyTier {
  id: string;
  name: string;
  requiredPoints: number;
  multiplier: number;
  benefits: {
    discountPercentage?: number;
    freeShipping?: boolean;
    birthdayBonus?: number;
    customBenefits?: Record<string, any>;
  };
}

interface PointsTransaction {
  id: string;
  customerId: string;
  points: number;
  type: 'earn' | 'redeem' | 'expire' | 'adjust';
  source: 'purchase' | 'refund' | 'promotion' | 'manual' | 'system';
  referenceId?: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

interface CustomerLoyalty {
  customerId: string;
  currentPoints: number;
  lifetimePoints: number;
  currentTier: LoyaltyTier;
  nextTier?: LoyaltyTier;
  pointsToNextTier?: number;
  pointsExpiring?: {
    points: number;
    expiryDate: Date;
  };
}

export class LoyaltyService extends BaseService {
  private readonly pointsExpiryDays: number;
  private readonly minimumSpendForPoints: number;
  private readonly pointsPerDollar: number;

  constructor(deps: any) {
    super(deps);
    
    this.pointsExpiryDays = parseInt(process.env.POINTS_EXPIRY_DAYS || '365');
    this.minimumSpendForPoints = parseFloat(process.env.MIN_SPEND_FOR_POINTS || '0');
    this.pointsPerDollar = parseFloat(process.env.POINTS_PER_DOLLAR || '1');
  }

  async calculatePoints(
    orderId: string,
    options: {
      includeBonus?: boolean;
      promotionMultiplier?: number;
    } = {}
  ): Promise<number> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          include: {
            loyaltyTier: true
          }
        },
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!order) {
      throw new ValidationError('Order not found');
    }

    if (order.total.lessThan(this.minimumSpendForPoints)) {
      return 0;
    }

    let points = order.total
      .mul(this.pointsPerDollar)
      .round()
      .toNumber();

    // Apply tier multiplier if any
    if (order.customer?.loyaltyTier) {
      points *= order.customer.loyaltyTier.multiplier;
    }

    // Apply promotion multiplier if any
    if (options.promotionMultiplier) {
      points *= options.promotionMultiplier;
    }

    // Add bonus points if enabled
    if (options.includeBonus) {
      points += await this.calculateBonusPoints(order);
    }

    return Math.floor(points);
  }

  async awardPoints(
    customerId: string,
    points: number,
    data: {
      type: PointsTransaction['type'];
      source: PointsTransaction['source'];
      referenceId?: string;
      description?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<PointsTransaction> {
    if (points <= 0) {
      throw new ValidationError('Points must be greater than 0');
    }

    return this.prisma.$transaction(async (prisma) => {
      // Create points transaction
      const transaction = await prisma.pointsTransaction.create({
        data: {
          customerId,
          points,
          type: data.type,
          source: data.source,
          referenceId: data.referenceId,
          description: data.description,
          metadata: data.metadata,
          expiresAt: this.calculateExpiryDate()
        }
      });

      // Update customer points
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          currentPoints: {
            increment: points
          },
          lifetimePoints: {
            increment: points
          }
        }
      });

      // Check for tier upgrade
      await this.checkAndUpdateTier(customerId, prisma);

      return transaction;
    });
  }

  async redeemPoints(
    customerId: string,
    points: number,
    data: {
      referenceId?: string;
      description?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<PointsTransaction> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) {
      throw new ValidationError('Customer not found');
    }

    if (customer.currentPoints < points) {
      throw new ValidationError('Insufficient points');
    }

    return this.prisma.$transaction(async (prisma) => {
      // Create redemption transaction
      const transaction = await prisma.pointsTransaction.create({
        data: {
          customerId,
          points: -points,
          type: 'redeem',
          source: 'manual',
          referenceId: data.referenceId,
          description: data.description,
          metadata: data.metadata
        }
      });

      // Update customer points
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          currentPoints: {
            decrement: points
          }
        }
      });

      return transaction;
    });
  }

  async getLoyaltyStatus(
    customerId: string
  ): Promise<CustomerLoyalty> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        loyaltyTier: true
      }
    });

    if (!customer) {
      throw new ValidationError('Customer not found');
    }

    // Get next tier
    const nextTier = await this.prisma.loyaltyTier.findFirst({
      where: {
        requiredPoints: {
          gt: customer.lifetimePoints
        }
      },
      orderBy: {
        requiredPoints: 'asc'
      }
    });

    // Get expiring points
    const expiringPoints = await this.getExpiringPoints(customerId);

    return {
      customerId,
      currentPoints: customer.currentPoints,
      lifetimePoints: customer.lifetimePoints,
      currentTier: customer.loyaltyTier,
      nextTier: nextTier || undefined,
      pointsToNextTier: nextTier
        ? nextTier.requiredPoints - customer.lifetimePoints
        : undefined,
      pointsExpiring: expiringPoints
    };
  }

  async getTransactionHistory(
    customerId: string,
    options: {
      type?: PointsTransaction['type'];
      source?: PointsTransaction['source'];
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<PointsTransaction[]> {
    return this.prisma.pointsTransaction.findMany({
      where: {
        customerId,
        type: options.type,
        source: options.source,
        createdAt: {
          gte: options.startDate,
          lte: options.endDate
        }
      },
      take: options.limit,
      skip: options.offset,
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async adjustPoints(
    customerId: string,
    points: number,
    data: {
      reason: string;
      adminId: string;
      metadata?: Record<string, any>;
    }
  ): Promise<PointsTransaction> {
    return this.prisma.$transaction(async (prisma) => {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId }
      });

      if (!customer) {
        throw new ValidationError('Customer not found');
      }

      if (points === 0) {
        throw new ValidationError('Adjustment points cannot be 0');
      }

      // Create adjustment transaction
      const transaction = await prisma.pointsTransaction.create({
        data: {
          customerId,
          points,
          type: 'adjust',
          source: 'manual',
          description: data.reason,
          metadata: {
            ...data.metadata,
            adminId: data.adminId
          }
        }
      });

      // Update customer points
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          currentPoints: {
            increment: points
          },
          lifetimePoints: points > 0 ? {
            increment: points
          } : undefined
        }
      });

      return transaction;
    });
  }

  private async calculateBonusPoints(
    order: any
  ): Promise<number> {
    let bonusPoints = 0;

    // Birthday bonus
    if (order.customer?.loyaltyTier?.benefits?.birthdayBonus) {
      const today = new Date();
      const birthday = order.customer.dateOfBirth;
      
      if (
        birthday &&
        birthday.getDate() === today.getDate() &&
        birthday.getMonth() === today.getMonth()
      ) {
        bonusPoints += order.total
          .mul(order.customer.loyaltyTier.benefits.birthdayBonus)
          .round()
          .toNumber();
      }
    }

    // Product category bonus
    for (const item of order.items) {
      if (item.product.categoryBonus) {
        bonusPoints += item.total
          .mul(item.product.categoryBonus)
          .round()
          .toNumber();
      }
    }

    return bonusPoints;
  }

  private async checkAndUpdateTier(
    customerId: string,
    prisma: any
  ): Promise<void> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        loyaltyTier: true
      }
    });

    if (!customer) {
      return;
    }

    // Find appropriate tier
    const newTier = await prisma.loyaltyTier.findFirst({
      where: {
        requiredPoints: {
          lte: customer.lifetimePoints
        }
      },
      orderBy: {
        requiredPoints: 'desc'
      }
    });

    if (newTier && (!customer.loyaltyTier || customer.loyaltyTier.id !== newTier.id)) {
      // Update customer tier
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          loyaltyTierId: newTier.id
        }
      });

      // Create tier change event
      await prisma.customerEvent.create({
        data: {
          customerId,
          type: 'TIER_CHANGE',
          metadata: {
            fromTier: customer.loyaltyTier?.name,
            toTier: newTier.name,
            lifetimePoints: customer.lifetimePoints
          }
        }
      });
    }
  }

  private async getExpiringPoints(
    customerId: string
  ): Promise<CustomerLoyalty['pointsExpiring']> {
    const expiringTransaction = await this.prisma.pointsTransaction.findFirst({
      where: {
        customerId,
        points: { gt: 0 },
        expiresAt: {
          not: null,
          gt: new Date()
        }
      },
      orderBy: {
        expiresAt: 'asc'
      }
    });

    if (!expiringTransaction) {
      return undefined;
    }

    return {
      points: expiringTransaction.points,
      expiryDate: expiringTransaction.expiresAt!
    };
  }

  private calculateExpiryDate(): Date {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + this.pointsExpiryDays);
    return expiryDate;
  }
} 