import { PrismaClient } from '@prisma/client';
import { CustomerSegment } from '@/types/customer';

export class CustomerLoyaltyService {
  constructor(private prisma: PrismaClient) {}

  async calculatePoints(amount: number, customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { tier: true }
    });

    if (!customer?.tier) return 0;

    const pointsMultiplier = customer.tier.pointsMultiplier || 1;
    return Math.floor(amount * pointsMultiplier);
  }

  async addPoints(customerId: string, points: number, transactionId: string) {
    return this.prisma.customerPoints.create({
      data: {
        customerId,
        points,
        transactionId,
        type: 'EARNED',
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year expiry
      }
    });
  }

  async getCustomerSegment(customerId: string): Promise<CustomerSegment> {
    const [
      totalSpent,
      visitFrequency,
      lastPurchase,
      preferences
    ] = await Promise.all([
      this.calculateTotalSpent(customerId),
      this.calculateVisitFrequency(customerId),
      this.getLastPurchaseDate(customerId),
      this.getCustomerPreferences(customerId)
    ]);

    // RFM (Recency, Frequency, Monetary) Scoring
    const recencyScore = this.calculateRecencyScore(lastPurchase);
    const frequencyScore = this.calculateFrequencyScore(visitFrequency);
    const monetaryScore = this.calculateMonetaryScore(totalSpent);

    const rfmScore = (recencyScore + frequencyScore + monetaryScore) / 3;

    return {
      segment: this.determineSegment(rfmScore),
      scores: {
        recency: recencyScore,
        frequency: frequencyScore,
        monetary: monetaryScore
      },
      preferences
    };
  }

  private async calculateTotalSpent(customerId: string): Promise<number> {
    const result = await this.prisma.sale.aggregate({
      where: { customerId },
      _sum: { total: true }
    });
    return result._sum.total || 0;
  }

  private async calculateVisitFrequency(customerId: string): Promise<number> {
    const sales = await this.prisma.sale.findMany({
      where: { customerId },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true }
    });

    if (sales.length < 2) return 0;

    const firstPurchase = sales[0].createdAt;
    const lastPurchase = sales[sales.length - 1].createdAt;
    const daysBetween = (lastPurchase.getTime() - firstPurchase.getTime()) / (1000 * 60 * 60 * 24);
    return sales.length / daysBetween;
  }

  private async getLastPurchaseDate(customerId: string): Promise<Date | null> {
    const lastSale = await this.prisma.sale.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });
    return lastSale?.createdAt || null;
  }

  private async getCustomerPreferences(customerId: string) {
    const purchases = await this.prisma.saleItem.findMany({
      where: { sale: { customerId } },
      include: { product: { include: { category: true } } }
    });

    const categoryPreferences = purchases.reduce((acc, item) => {
      const category = item.product.category.name;
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(categoryPreferences)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([category]) => category);
  }

  private calculateRecencyScore(lastPurchase: Date | null): number {
    if (!lastPurchase) return 0;
    const daysSinceLastPurchase = (Date.now() - lastPurchase.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastPurchase <= 7) return 5;
    if (daysSinceLastPurchase <= 30) return 4;
    if (daysSinceLastPurchase <= 90) return 3;
    if (daysSinceLastPurchase <= 180) return 2;
    return 1;
  }

  private calculateFrequencyScore(frequency: number): number {
    if (frequency >= 0.5) return 5; // More than once every 2 days
    if (frequency >= 0.25) return 4; // More than once every 4 days
    if (frequency >= 0.142) return 3; // More than once per week
    if (frequency >= 0.033) return 2; // More than once per month
    return 1;
  }

  private calculateMonetaryScore(totalSpent: number): number {
    if (totalSpent >= 10000) return 5;
    if (totalSpent >= 5000) return 4;
    if (totalSpent >= 1000) return 3;
    if (totalSpent >= 500) return 2;
    return 1;
  }

  private determineSegment(rfmScore: number): string {
    if (rfmScore >= 4.5) return 'VIP';
    if (rfmScore >= 4) return 'Loyal';
    if (rfmScore >= 3) return 'Regular';
    if (rfmScore >= 2) return 'Occasional';
    return 'At Risk';
  }
} 