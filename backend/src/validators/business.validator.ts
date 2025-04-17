import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

export class BusinessValidator {
  constructor(private prisma: PrismaClient) {}

  async validateSale(data: {
    items: Array<{ productId: string; quantity: number }>;
    customerId?: string;
    discountId?: string;
    paymentMethod: string;
    branchId: string;
  }) {
    const errors: string[] = [];

    // Validate stock availability
    for (const item of data.items) {
      const inventory = await this.prisma.inventory.findUnique({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId: data.branchId
          }
        },
        include: {
          product: true
        }
      });

      if (!inventory) {
        errors.push(`Product ${item.productId} not found in branch inventory`);
        continue;
      }

      if (inventory.quantity < item.quantity) {
        errors.push(
          `Insufficient stock for ${inventory.product.name} (requested: ${item.quantity}, available: ${inventory.quantity})`
        );
      }
    }

    // Validate customer credit limit if applicable
    if (data.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: data.customerId },
        include: {
          creditLimit: true,
          outstandingBalance: true
        }
      });

      if (customer && customer.creditLimit) {
        const totalAmount = await this.calculateTotalAmount(data);
        const newBalance = customer.outstandingBalance + totalAmount;

        if (newBalance > customer.creditLimit) {
          errors.push('Sale would exceed customer credit limit');
        }
      }
    }

    // Validate discount applicability
    if (data.discountId) {
      const discount = await this.prisma.discount.findUnique({
        where: { id: data.discountId }
      });

      if (!discount) {
        errors.push('Invalid discount');
      } else {
        const now = new Date();
        if (now < discount.startDate || now > discount.endDate) {
          errors.push('Discount is not active');
        }

        if (discount.minimumPurchase) {
          const totalAmount = await this.calculateTotalAmount(data);
          if (totalAmount < discount.minimumPurchase) {
            errors.push(
              `Minimum purchase amount of ${discount.minimumPurchase} not met for discount`
            );
          }
        }
      }
    }

    // Validate business hours
    const businessHours = await this.prisma.businessHours.findFirst({
      where: {
        branchId: data.branchId,
        dayOfWeek: new Date().getDay()
      }
    });

    if (businessHours && !this.isWithinBusinessHours(businessHours)) {
      errors.push('Branch is currently closed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async validatePurchaseOrder(data: {
    supplierId: string;
    items: Array<{ productId: string; quantity: number; unitPrice: number }>;
    expectedDeliveryDate: Date;
  }) {
    const errors: string[] = [];

    // Validate supplier
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: data.supplierId },
      include: {
        products: true,
        paymentTerms: true
      }
    });

    if (!supplier) {
      errors.push('Invalid supplier');
    } else {
      // Validate supplier products
      for (const item of data.items) {
        const isSupplierProduct = supplier.products.some(
          p => p.id === item.productId
        );
        if (!isSupplierProduct) {
          errors.push(`Product ${item.productId} not available from this supplier`);
        }
      }

      // Validate minimum order value
      if (supplier.minimumOrderValue) {
        const totalValue = data.items.reduce(
          (sum, item) => sum + item.quantity * item.unitPrice,
          0
        );
        if (totalValue < supplier.minimumOrderValue) {
          errors.push(
            `Order value below supplier minimum of ${supplier.minimumOrderValue}`
          );
        }
      }

      // Validate lead time
      const leadTimeDays = supplier.leadTimeDays || 0;
      const minDeliveryDate = new Date();
      minDeliveryDate.setDate(minDeliveryDate.getDate() + leadTimeDays);

      if (data.expectedDeliveryDate < minDeliveryDate) {
        errors.push(
          `Delivery date must be at least ${leadTimeDays} days from today`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async calculateTotalAmount(data: {
    items: Array<{ productId: string; quantity: number }>;
  }) {
    let total = 0;
    for (const item of data.items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId }
      });
      if (product) {
        total += product.sellingPrice * item.quantity;
      }
    }
    return total;
  }

  private isWithinBusinessHours(businessHours: {
    startTime: string;
    endTime: string;
  }) {
    const now = new Date();
    const [startHour, startMinute] = businessHours.startTime.split(':').map(Number);
    const [endHour, endMinute] = businessHours.endTime.split(':').map(Number);

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }
} 