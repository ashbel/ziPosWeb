import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { CustomerStatus, LoyaltyTier } from '@prisma/client';

interface CustomerCreate {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  taxId?: string;
  notes?: string;
}

export class CustomerService extends BaseService {
  async createCustomer(data: CustomerCreate) {
    // Validate unique fields
    if (data.email) {
      const existingEmail = await this.prisma.customer.findUnique({
        where: { email: data.email }
      });
      if (existingEmail) {
        throw new ValidationError('Email already registered');
      }
    }

    if (data.phone) {
      const existingPhone = await this.prisma.customer.findUnique({
        where: { phone: data.phone }
      });
      if (existingPhone) {
        throw new ValidationError('Phone number already registered');
      }
    }

    // Create customer with initial loyalty program setup
    return this.prisma.$transaction(async (prisma) => {
      const customer = await prisma.customer.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          status: CustomerStatus.ACTIVE,
          address: data.address,
          taxId: data.taxId,
          notes: data.notes,
          loyaltyPoints: 0,
          loyaltyTier: LoyaltyTier.STANDARD
        }
      });

      // Initialize customer metrics
      await prisma.customerMetrics.create({
        data: {
          customerId: customer.id,
          totalSpent: 0,
          visitCount: 0,
          averageTransactionValue: 0,
          lastVisitDate: null
        }
      });

      // Create initial credit limit if needed
      await prisma.creditLimit.create({
        data: {
          customerId: customer.id,
          limit: 0,
          available: 0,
          status: 'ACTIVE'
        }
      });

      return customer;
    });
  }

  async updateCustomer(id: string, data: Partial<CustomerCreate>) {
    // Validate unique fields if being updated
    if (data.email) {
      const existingEmail = await this.prisma.customer.findFirst({
        where: {
          email: data.email,
          NOT: { id }
        }
      });
      if (existingEmail) {
        throw new ValidationError('Email already registered');
      }
    }

    if (data.phone) {
      const existingPhone = await this.prisma.customer.findFirst({
        where: {
          phone: data.phone,
          NOT: { id }
        }
      });
      if (existingPhone) {
        throw new ValidationError('Phone number already registered');
      }
    }

    return this.prisma.customer.update({
      where: { id },
      data
    });
  }

  async updateLoyaltyPoints(customerId: string, points: number, transactionId: string) {
    return this.prisma.$transaction(async (prisma) => {
      // Update points
      const customer = await prisma.customer.update({
        where: { id: customerId },
        data: {
          loyaltyPoints: {
            increment: points
          }
        },
        include: {
          loyaltyHistory: true
        }
      });

      // Record points history
      await prisma.loyaltyHistory.create({
        data: {
          customerId,
          points,
          type: points > 0 ? 'EARNED' : 'REDEEMED',
          transactionId,
          balance: customer.loyaltyPoints
        }
      });

      // Check and update loyalty tier
      await this.updateLoyaltyTier(customerId, customer.loyaltyPoints);

      return customer;
    });
  }

  async updateCreditLimit(
    customerId: string,
    data: {
      limit: number;
      reason: string;
    }
  ) {
    return this.prisma.$transaction(async (prisma) => {
      const currentCredit = await prisma.creditLimit.findUnique({
        where: { customerId },
        include: {
          customer: true
        }
      });

      if (!currentCredit) {
        throw new ValidationError('Credit limit record not found');
      }

      // Calculate new available credit
      const used = currentCredit.limit - currentCredit.available;
      const newAvailable = Math.max(data.limit - used, 0);

      // Update credit limit
      const updatedCredit = await prisma.creditLimit.update({
        where: { customerId },
        data: {
          limit: data.limit,
          available: newAvailable
        }
      });

      // Record credit limit change
      await prisma.creditLimitHistory.create({
        data: {
          customerId,
          oldLimit: currentCredit.limit,
          newLimit: data.limit,
          reason: data.reason
        }
      });

      return updatedCredit;
    });
  }

  async getCustomerAnalytics(customerId: string) {
    const [
      transactions,
      loyaltyHistory,
      creditHistory,
      metrics
    ] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      this.prisma.loyaltyHistory.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      this.prisma.creditLimitHistory.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      this.prisma.customerMetrics.findUnique({
        where: { customerId }
      })
    ]);

    return {
      recentTransactions: transactions,
      loyaltyHistory,
      creditHistory,
      metrics
    };
  }

  private async updateLoyaltyTier(customerId: string, totalPoints: number) {
    let newTier = LoyaltyTier.STANDARD;

    // Define tier thresholds
    if (totalPoints >= 10000) {
      newTier = LoyaltyTier.PLATINUM;
    } else if (totalPoints >= 5000) {
      newTier = LoyaltyTier.GOLD;
    } else if (totalPoints >= 1000) {
      newTier = LoyaltyTier.SILVER;
    }

    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (customer && customer.loyaltyTier !== newTier) {
      await this.prisma.customer.update({
        where: { id: customerId },
        data: { loyaltyTier: newTier }
      });

      // Record tier change
      await this.prisma.loyaltyTierHistory.create({
        data: {
          customerId,
          oldTier: customer.loyaltyTier,
          newTier,
          pointsAtChange: totalPoints
        }
      });
    }
  }
} 