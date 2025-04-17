import { PrismaClient, PaymentStatus } from '@prisma/client';
import { Decimal } from 'decimal.js';

export class SalesService {
  constructor(private prisma: PrismaClient) {}

  async createLayaway(data: {
    customerId: string;
    items: Array<{
      productId: string;
      quantity: number;
      price: number;
    }>;
    downPayment: number;
    installments: number;
    installmentFrequency: 'WEEKLY' | 'MONTHLY';
  }) {
    const total = data.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const installmentAmount = (total - data.downPayment) / data.installments;

    const layaway = await this.prisma.layaway.create({
      data: {
        customerId: data.customerId,
        total,
        downPayment: data.downPayment,
        remainingBalance: total - data.downPayment,
        installmentAmount,
        installments: data.installments,
        installmentFrequency: data.installmentFrequency,
        status: 'ACTIVE',
        items: {
          create: data.items
        }
      }
    });

    // Reserve inventory
    for (const item of data.items) {
      await this.prisma.inventory.update({
        where: { productId: item.productId },
        data: {
          reserved: {
            increment: item.quantity
          }
        }
      });
    }

    return layaway;
  }

  async processLayawayPayment(data: {
    layawayId: string;
    amount: number;
    paymentMethod: string;
  }) {
    const layaway = await this.prisma.layaway.findUnique({
      where: { id: data.layawayId }
    });

    if (!layaway) throw new Error('Layaway not found');

    const newBalance = layaway.remainingBalance - data.amount;
    const status = newBalance <= 0 ? 'COMPLETED' : 'ACTIVE';

    // Record payment
    await this.prisma.payment.create({
      data: {
        layawayId: data.layawayId,
        amount: data.amount,
        method: data.paymentMethod
      }
    });

    // Update layaway status
    const updatedLayaway = await this.prisma.layaway.update({
      where: { id: data.layawayId },
      data: {
        remainingBalance: newBalance,
        status
      }
    });

    // If completed, create final sale
    if (status === 'COMPLETED') {
      await this.createSaleFromLayaway(data.layawayId);
    }

    return updatedLayaway;
  }

  async createGiftCard(data: {
    amount: number;
    expiryDate?: Date;
    purchaserId?: string;
  }) {
    const code = this.generateGiftCardCode();

    return this.prisma.giftCard.create({
      data: {
        code,
        initialBalance: data.amount,
        currentBalance: data.amount,
        expiryDate: data.expiryDate,
        purchaserId: data.purchaserId
      }
    });
  }

  async processGiftCardPayment(data: {
    giftCardCode: string;
    amount: number;
  }) {
    const giftCard = await this.prisma.giftCard.findUnique({
      where: { code: data.giftCardCode }
    });

    if (!giftCard) throw new Error('Gift card not found');
    if (giftCard.currentBalance < data.amount) {
      throw new Error('Insufficient gift card balance');
    }
    if (giftCard.expiryDate && giftCard.expiryDate < new Date()) {
      throw new Error('Gift card has expired');
    }

    return this.prisma.giftCard.update({
      where: { code: data.giftCardCode },
      data: {
        currentBalance: {
          decrement: data.amount
        }
      }
    });
  }

  async createCustomOrder(data: {
    customerId: string;
    items: Array<{
      productId: string;
      quantity: number;
      customizations: Record<string, any>;
    }>;
    deposit: number;
    expectedCompletionDate: Date;
    notes?: string;
  }) {
    return this.prisma.customOrder.create({
      data: {
        customerId: data.customerId,
        status: 'PENDING',
        deposit: data.deposit,
        expectedCompletionDate: data.expectedCompletionDate,
        notes: data.notes,
        items: {
          create: data.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            customizations: item.customizations
          }))
        }
      }
    });
  }

  private generateGiftCardCode(): string {
    return Math.random().toString(36).substr(2, 16).toUpperCase();
  }

  private async createSaleFromLayaway(layawayId: string) {
    const layaway = await this.prisma.layaway.findUnique({
      where: { id: layawayId },
      include: {
        items: true,
        payments: true
      }
    });

    if (!layaway) throw new Error('Layaway not found');

    // Create sale record
    await this.prisma.sale.create({
      data: {
        customerId: layaway.customerId,
        total: layaway.total,
        status: 'COMPLETED',
        items: {
          create: layaway.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price
          }))
        },
        payments: {
          create: layaway.payments.map(payment => ({
            amount: payment.amount,
            method: payment.method
          }))
        }
      }
    });

    // Release reserved inventory
    for (const item of layaway.items) {
      await this.prisma.inventory.update({
        where: { productId: item.productId },
        data: {
          reserved: {
            decrement: item.quantity
          },
          quantity: {
            decrement: item.quantity
          }
        }
      });
    }
  }
} 