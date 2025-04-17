import { BaseService } from './base.service';
import { TransactionType, PaymentMethod, TransactionStatus } from '@prisma/client';
import { ValidationError } from '../utils/errors';
import { EventEmitter } from 'events';

interface TransactionItem {
  productId: string;
  quantity: number;
  price: number;
  discountId?: string;
}

interface TransactionData {
  items: TransactionItem[];
  customerId?: string;
  employeeId: string;
  branchId: string;
  paymentMethod: PaymentMethod;
  paymentDetails?: any;
  notes?: string;
}

export class TransactionService extends BaseService {
  private events: EventEmitter;

  constructor(deps: any) {
    super(deps);
    this.events = new EventEmitter();
  }

  async createSale(data: TransactionData) {
    const session = await this.prisma.$transaction(async (prisma) => {
      // Validate inventory
      await this.validateInventory(data.items, data.branchId);

      // Calculate totals
      const { subtotal, tax, total, discounts } = await this.calculateTotals(data.items);

      // Create transaction
      const transaction = await prisma.transaction.create({
        data: {
          type: TransactionType.SALE,
          status: TransactionStatus.PENDING,
          subtotal,
          tax,
          total,
          discounts,
          customerId: data.customerId,
          employeeId: data.employeeId,
          branchId: data.branchId,
          paymentMethod: data.paymentMethod,
          paymentDetails: data.paymentDetails,
          notes: data.notes,
          items: {
            create: data.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              discountId: item.discountId
            }))
          }
        },
        include: {
          items: {
            include: {
              product: true
            }
          },
          customer: true,
          employee: true
        }
      });

      // Update inventory
      await this.updateInventory(data.items, data.branchId, prisma);

      // Process payment
      const payment = await this.processPayment(transaction);

      // Update transaction status
      const updatedTransaction = await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TransactionStatus.COMPLETED,
          paymentDetails: payment
        }
      });

      // Emit events
      this.events.emit('sale.completed', updatedTransaction);

      return updatedTransaction;
    });

    return session;
  }

  async createRefund(
    transactionId: string,
    items: Array<{ productId: string; quantity: number }>,
    reason: string
  ) {
    const session = await this.prisma.$transaction(async (prisma) => {
      // Get original transaction
      const originalTransaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          items: true,
          customer: true
        }
      });

      if (!originalTransaction) {
        throw new ValidationError('Original transaction not found');
      }

      // Validate refund items
      this.validateRefundItems(originalTransaction.items, items);

      // Calculate refund amount
      const refundAmount = this.calculateRefundAmount(originalTransaction.items, items);

      // Create refund transaction
      const refund = await prisma.transaction.create({
        data: {
          type: TransactionType.REFUND,
          status: TransactionStatus.PENDING,
          subtotal: -refundAmount,
          tax: -(refundAmount * 0.1), // Assuming 10% tax
          total: -(refundAmount * 1.1),
          customerId: originalTransaction.customerId,
          employeeId: originalTransaction.employeeId,
          branchId: originalTransaction.branchId,
          paymentMethod: originalTransaction.paymentMethod,
          notes: reason,
          originalTransactionId: transactionId,
          items: {
            create: items.map(item => ({
              productId: item.productId,
              quantity: -item.quantity,
              price: this.getOriginalPrice(originalTransaction.items, item.productId)
            }))
          }
        }
      });

      // Process refund
      await this.processRefund(refund);

      // Update inventory
      await this.updateInventory(
        items.map(item => ({
          ...item,
          price: this.getOriginalPrice(originalTransaction.items, item.productId)
        })),
        originalTransaction.branchId,
        prisma,
        true
      );

      // Update transaction status
      const updatedRefund = await prisma.transaction.update({
        where: { id: refund.id },
        data: {
          status: TransactionStatus.COMPLETED
        }
      });

      // Emit events
      this.events.emit('refund.completed', updatedRefund);

      return updatedRefund;
    });

    return session;
  }

  async voidTransaction(transactionId: string, reason: string) {
    const session = await this.prisma.$transaction(async (prisma) => {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId },
        include: {
          items: true
        }
      });

      if (!transaction) {
        throw new ValidationError('Transaction not found');
      }

      if (transaction.status === TransactionStatus.VOIDED) {
        throw new ValidationError('Transaction already voided');
      }

      // Reverse inventory changes
      if (transaction.type === TransactionType.SALE) {
        await this.updateInventory(
          transaction.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price
          })),
          transaction.branchId,
          prisma,
          true
        );
      }

      // Process void in payment system
      await this.processVoid(transaction);

      // Update transaction status
      const voidedTransaction = await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: TransactionStatus.VOIDED,
          notes: `${transaction.notes || ''}\nVOIDED: ${reason}`
        }
      });

      // Emit events
      this.events.emit('transaction.voided', voidedTransaction);

      return voidedTransaction;
    });

    return session;
  }

  private async validateInventory(items: TransactionItem[], branchId: string) {
    const inventoryChecks = items.map(item =>
      this.prisma.inventory.findUnique({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId
          }
        }
      })
    );

    const inventoryLevels = await Promise.all(inventoryChecks);

    items.forEach((item, index) => {
      const inventory = inventoryLevels[index];
      if (!inventory) {
        throw new ValidationError(`Product ${item.productId} not found in inventory`);
      }
      if (inventory.quantity < item.quantity) {
        throw new ValidationError(
          `Insufficient inventory for product ${item.productId}. Available: ${inventory.quantity}`
        );
      }
    });
  }

  private async calculateTotals(items: TransactionItem[]) {
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    // Get applicable discounts
    const discounts = await this.calculateDiscounts(items);
    
    // Calculate tax (assuming 10% tax rate)
    const taxableAmount = subtotal - discounts;
    const tax = taxableAmount * 0.1;
    
    return {
      subtotal,
      tax,
      total: taxableAmount + tax,
      discounts
    };
  }

  private async calculateDiscounts(items: TransactionItem[]) {
    let totalDiscount = 0;

    for (const item of items) {
      if (item.discountId) {
        const discount = await this.prisma.discount.findUnique({
          where: { id: item.discountId }
        });

        if (discount && discount.isActive) {
          const itemTotal = item.price * item.quantity;
          totalDiscount += discount.type === 'PERCENTAGE'
            ? itemTotal * (discount.value / 100)
            : discount.value;
        }
      }
    }

    return totalDiscount;
  }

  private async updateInventory(
    items: TransactionItem[],
    branchId: string,
    prisma: any,
    isRefund: boolean = false
  ) {
    const updates = items.map(item =>
      prisma.inventory.update({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId
          }
        },
        data: {
          quantity: {
            increment: isRefund ? item.quantity : -item.quantity
          }
        }
      })
    );

    await Promise.all(updates);
  }

  private async processPayment(transaction: any) {
    // Implementation would depend on payment provider
    // This is a placeholder
    return {
      status: 'success',
      transactionId: Date.now().toString(),
      timestamp: new Date()
    };
  }

  private async processRefund(refund: any) {
    // Implementation would depend on payment provider
    // This is a placeholder
    return {
      status: 'success',
      refundId: Date.now().toString(),
      timestamp: new Date()
    };
  }

  private async processVoid(transaction: any) {
    // Implementation would depend on payment provider
    // This is a placeholder
    return {
      status: 'success',
      voidId: Date.now().toString(),
      timestamp: new Date()
    };
  }

  private validateRefundItems(originalItems: any[], refundItems: any[]) {
    for (const refundItem of refundItems) {
      const originalItem = originalItems.find(
        item => item.productId === refundItem.productId
      );

      if (!originalItem) {
        throw new ValidationError(
          `Product ${refundItem.productId} not found in original transaction`
        );
      }

      if (refundItem.quantity > originalItem.quantity) {
        throw new ValidationError(
          `Refund quantity exceeds original quantity for product ${refundItem.productId}`
        );
      }
    }
  }

  private calculateRefundAmount(originalItems: any[], refundItems: any[]) {
    return refundItems.reduce((total, refundItem) => {
      const originalItem = originalItems.find(
        item => item.productId === refundItem.productId
      );
      return total + (originalItem.price * refundItem.quantity);
    }, 0);
  }

  private getOriginalPrice(originalItems: any[], productId: string): number {
    const item = originalItems.find(item => item.productId === productId);
    return item ? item.price : 0;
  }

  // Event handlers
  onSaleCompleted(handler: (transaction: any) => void) {
    this.events.on('sale.completed', handler);
  }

  onRefundCompleted(handler: (transaction: any) => void) {
    this.events.on('refund.completed', handler);
  }

  onTransactionVoided(handler: (transaction: any) => void) {
    this.events.on('transaction.voided', handler);
  }
} 