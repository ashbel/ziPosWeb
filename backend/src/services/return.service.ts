import { PrismaClient } from '@prisma/client';

export class ReturnService {
  constructor(private prisma: PrismaClient) {}

  async createReturn(data: {
    saleId: string;
    items: Array<{
      saleItemId: string;
      quantity: number;
      reason: string;
      condition: 'GOOD' | 'DAMAGED';
    }>;
    refundType: 'CASH' | 'STORE_CREDIT' | 'ORIGINAL_PAYMENT';
    notes?: string;
  }) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: data.saleId },
      include: {
        items: true,
        payments: true
      }
    });

    if (!sale) throw new Error('Sale not found');

    // Calculate refund amount
    let refundAmount = 0;
    for (const returnItem of data.items) {
      const saleItem = sale.items.find(item => item.id === returnItem.saleItemId);
      if (!saleItem) throw new Error(`Sale item ${returnItem.saleItemId} not found`);
      if (returnItem.quantity > saleItem.quantity) {
        throw new Error(`Cannot return more items than purchased for ${saleItem.id}`);
      }
      refundAmount += saleItem.price * returnItem.quantity;
    }

    // Create return record
    const returnRecord = await this.prisma.return.create({
      data: {
        saleId: data.saleId,
        refundAmount,
        refundType: data.refundType,
        notes: data.notes,
        status: 'PENDING',
        items: {
          create: data.items.map(item => ({
            saleItemId: item.saleItemId,
            quantity: item.quantity,
            reason: item.reason,
            condition: item.condition
          }))
        }
      },
      include: {
        items: true
      }
    });

    // Process refund based on type
    switch (data.refundType) {
      case 'CASH':
        await this.prisma.cashDrawer.update({
          where: { id: sale.cashDrawerId },
          data: {
            balance: {
              decrement: refundAmount
            }
          }
        });
        break;
      case 'STORE_CREDIT':
        await this.prisma.customer.update({
          where: { id: sale.customerId! },
          data: {
            storeCredit: {
              increment: refundAmount
            }
          }
        });
        break;
      case 'ORIGINAL_PAYMENT':
        // Integrate with payment gateway for refund
        // This is a placeholder for payment gateway integration
        break;
    }

    // Update inventory
    for (const item of data.items) {
      if (item.condition === 'GOOD') {
        await this.prisma.inventory.update({
          where: {
            productId: item.saleItemId
          },
          data: {
            quantity: {
              increment: item.quantity
            }
          }
        });
      }
    }

    return returnRecord;
  }

  async getReturns(filters: {
    startDate?: Date;
    endDate?: Date;
    status?: string;
    branchId?: string;
  }) {
    return this.prisma.return.findMany({
      where: {
        createdAt: {
          gte: filters.startDate,
          lte: filters.endDate
        },
        status: filters.status,
        sale: {
          branchId: filters.branchId
        }
      },
      include: {
        sale: {
          include: {
            customer: true
          }
        },
        items: {
          include: {
            saleItem: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });
  }
} 