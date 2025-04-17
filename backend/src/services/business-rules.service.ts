import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';

export class BusinessRulesService {
  constructor(private prisma: PrismaClient) {}

  async validateTransaction(data: {
    type: 'SALE' | 'RETURN' | 'ADJUSTMENT';
    items: Array<{
      productId: string;
      quantity: number;
      price?: number;
    }>;
    customerId?: string;
    employeeId: string;
    branchId: string;
  }) {
    const errors: string[] = [];

    // Check business hours
    const isWithinBusinessHours = await this.checkBusinessHours(
      data.branchId,
      new Date()
    );
    if (!isWithinBusinessHours) {
      errors.push('Transaction outside business hours');
    }

    // Check employee permissions
    const hasPermission = await this.checkEmployeePermissions(
      data.employeeId,
      data.type
    );
    if (!hasPermission) {
      errors.push('Employee does not have required permissions');
    }

    // Check inventory levels
    for (const item of data.items) {
      const inventory = await this.prisma.inventory.findUnique({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId: data.branchId
          }
        },
        include: {
          product: {
            include: {
              batches: true
            }
          }
        }
      });

      if (!inventory) {
        errors.push(`Product ${item.productId} not found in branch inventory`);
        continue;
      }

      // Check stock levels
      if (data.type === 'SALE' && inventory.quantity < item.quantity) {
        errors.push(
          `Insufficient stock for ${inventory.product.name}`
        );
      }

      // Check batch expiry
      if (inventory.product.batches.some(
        batch => 
          batch.remainingQuantity > 0 &&
          batch.expiryDate &&
          batch.expiryDate < new Date()
      )) {
        errors.push(
          `Product ${inventory.product.name} has expired batches`
        );
      }
    }

    // Check customer credit limit
    if (data.customerId && data.type === 'SALE') {
      const customer = await this.prisma.customer.findUnique({
        where: { id: data.customerId },
        include: {
          creditLimit: true,
          outstandingBalance: true
        }
      });

      if (customer && customer.creditLimit) {
        const transactionTotal = data.items.reduce(
          (sum, item) => sum + (item.price || 0) * item.quantity,
          0
        );

        if (
          customer.outstandingBalance + transactionTotal >
          customer.creditLimit
        ) {
          errors.push('Transaction would exceed customer credit limit');
        }
      }
    }

    // Check return policy
    if (data.type === 'RETURN') {
      for (const item of data.items) {
        const originalSale = await this.prisma.saleItem.findFirst({
          where: {
            productId: item.productId,
            sale: {
              customerId: data.customerId
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          include: {
            sale: true
          }
        });

        if (!originalSale) {
          errors.push(
            `No original sale found for product ${item.productId}`
          );
          continue;
        }

        const returnWindow = 30; // 30 days return policy
        const daysSinceSale = Math.floor(
          (new Date().getTime() - originalSale.sale.createdAt.getTime()) /
            (1000 * 60 * 60 * 24)
        );

        if (daysSinceSale > returnWindow) {
          errors.push(
            `Return window expired for product ${item.productId}`
          );
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async checkBusinessHours(branchId: string, date: Date) {
    const businessHours = await this.prisma.businessHours.findFirst({
      where: {
        branchId,
        dayOfWeek: date.getDay()
      }
    });

    if (!businessHours) return false;

    const currentTime = date.getHours() * 60 + date.getMinutes();
    const [startHour, startMinute] = businessHours.startTime.split(':');
    const [endHour, endMinute] = businessHours.endTime.split(':');
    const startMinutes = parseInt(startHour) * 60 + parseInt(startMinute);
    const endMinutes = parseInt(endHour) * 60 + parseInt(endMinute);

    return currentTime >= startMinutes && currentTime <= endMinutes;
  }

  private async checkEmployeePermissions(
    employeeId: string,
    transactionType: string
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        role: {
          include: {
            permissions: true
          }
        }
      }
    });

    if (!employee) return false;

    const requiredPermission = {
      SALE: 'PROCESS_SALE',
      RETURN: 'PROCESS_RETURN',
      ADJUSTMENT: 'MANAGE_INVENTORY'
    }[transactionType];

    return employee.role.permissions.some(
      p => p.name === requiredPermission
    );
  }
} 