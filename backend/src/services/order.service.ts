import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { DateTime } from 'luxon';

interface OrderItem {
  productId: string;
  variantId?: string;
  quantity: number;
  price: number;
  discounts?: Array<{
    type: string;
    value: number;
  }>;
  metadata?: Record<string, any>;
}

interface OrderAddress {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  email?: string;
}

export class OrderService extends BaseService {
  async createOrder(data: {
    customerId?: string;
    items: OrderItem[];
    billingAddress?: OrderAddress;
    shippingAddress?: OrderAddress;
    paymentMethodId?: string;
    currency: string;
    notes?: string;
    metadata?: Record<string, any>;
  }): Promise<any> {
    // Start
  }

  async createBulkOrders(
    orders: Array<Parameters<typeof this.createOrder>[0]>
  ): Promise<{
    successful: any[];
    failed: Array<{
      order: Parameters<typeof this.createOrder>[0];
      error: string;
    }>;
  }> {
    const results = {
      successful: [],
      failed: []
    };

    for (const orderData of orders) {
      try {
        const order = await this.createOrder(orderData);
        results.successful.push(order);
      } catch (error) {
        results.failed.push({
          order: orderData,
          error: error.message
        });
      }
    }

    return results;
  }

  async generateOrderReport(
    options: {
      type: 'sales' | 'refunds' | 'shipping' | 'tax';
      dateRange: {
        start: Date;
        end: Date;
      };
      groupBy?: 'day' | 'week' | 'month';
      format?: 'csv' | 'json';
    }
  ): Promise<string> {
    const data = await this.getOrderReportData(options);
    
    if (options.format === 'csv') {
      return this.convertToCSV(data);
    }
    
    return JSON.stringify(data, null, 2);
  }

  async splitOrder(
    orderId: string,
    items: Array<{
      orderItemId: string;
      quantity: number;
    }>
  ): Promise<{
    originalOrder: any;
    newOrder: any;
  }> {
    return this.prisma.$transaction(async (prisma) => {
      const originalOrder = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          customer: true
        }
      });

      if (!originalOrder) {
        throw new ValidationError('Order not found');
      }

      // Validate items
      for (const item of items) {
        const orderItem = originalOrder.items.find(
          oi => oi.id === item.orderItemId
        );
        
        if (!orderItem) {
          throw new ValidationError(
            `Order item not found: ${item.orderItemId}`
          );
        }
        
        if (item.quantity > orderItem.quantity) {
          throw new ValidationError(
            `Invalid quantity for item: ${item.orderItemId}`
          );
        }
      }

      // Create new order with split items
      const newOrderItems = items.map(item => {
        const originalItem = originalOrder.items.find(
          oi => oi.id === item.orderItemId
        )!;
        return {
          productId: originalItem.productId,
          variantId: originalItem.variantId,
          quantity: item.quantity,
          price: originalItem.price,
          discounts: originalItem.discounts
        };
      });

      const {
        subtotal: newSubtotal,
        tax: newTax,
        total: newTotal
      } = await this.calculateOrderTotals(
        newOrderItems,
        [],
        originalOrder.currency
      );

      const newOrder = await prisma.order.create({
        data: {
          customerId: originalOrder.customerId,
          status: 'pending',
          currency: originalOrder.currency,
          subtotal: newSubtotal,
          tax: newTax,
          total: newTotal,
          billingAddress: originalOrder.billingAddress,
          shippingAddress: originalOrder.shippingAddress,
          notes: `Split from order ${orderId}`,
          items: {
            create: newOrderItems
          }
        },
        include: {
          items: true
        }
      });

      // Update quantities in original order
      for (const item of items) {
        await prisma.orderItem.update({
          where: { id: item.orderItemId },
          data: {
            quantity: {
              decrement: item.quantity
            }
          }
        });
      }

      // Recalculate totals for original order
      const remainingItems = originalOrder.items.map(item => {
        const splitItem = items.find(
          si => si.orderItemId === item.id
        );
        return {
          productId: item.productId,
          variantId: item.variantId,
          quantity: splitItem
            ? item.quantity - splitItem.quantity
            : item.quantity,
          price: item.price,
          discounts: item.discounts
        };
      });

      const {
        subtotal,
        tax,
        total
      } = await this.calculateOrderTotals(
        remainingItems,
        [],
        originalOrder.currency
      );

      await prisma.order.update({
        where: { id: orderId },
        data: {
          subtotal,
          tax,
          total
        }
      });

      return {
        originalOrder: await prisma.order.findUnique({
          where: { id: orderId },
          include: {
            items: true
          }
        }),
        newOrder
      };
    });
  }

  private async getOrderReportData(
    options: {
      type: string;
      dateRange: {
        start: Date;
        end: Date;
      };
      groupBy?: 'day' | 'week' | 'month';
    }
  ): Promise<any[]> {
    const interval = options.groupBy || 'day';

    switch (options.type) {
      case 'sales':
        return this.prisma.$queryRaw`
          SELECT
            DATE_TRUNC(${interval}, "createdAt") as date,
            COUNT(*) as order_count,
            SUM(total) as total_sales,
            SUM(subtotal) as subtotal,
            SUM(tax) as total_tax
          FROM "Order"
          WHERE
            "createdAt" BETWEEN ${options.dateRange.start} AND ${options.dateRange.end}
            AND status = 'completed'
          GROUP BY DATE_TRUNC(${interval}, "createdAt")
          ORDER BY date ASC
        `;

      case 'refunds':
        return this.prisma.$queryRaw`
          SELECT
            DATE_TRUNC(${interval}, r."createdAt") as date,
            COUNT(*) as refund_count,
            SUM(r.amount) as total_refunded
          FROM "Refund" r
          WHERE
            r."createdAt" BETWEEN ${options.dateRange.start} AND ${options.dateRange.end}
          GROUP BY DATE_TRUNC(${interval}, r."createdAt")
          ORDER BY date ASC
        `;

      case 'shipping':
        return this.prisma.$queryRaw`
          SELECT
            DATE_TRUNC(${interval}, "createdAt") as date,
            shipping_method,
            COUNT(*) as order_count,
            SUM(shipping_cost) as total_shipping
          FROM "Order"
          WHERE
            "createdAt" BETWEEN ${options.dateRange.start} AND ${options.dateRange.end}
            AND status = 'completed'
          GROUP BY
            DATE_TRUNC(${interval}, "createdAt"),
            shipping_method
          ORDER BY date ASC
        `;

      case 'tax':
        return this.prisma.$queryRaw`
          SELECT
            DATE_TRUNC(${interval}, "createdAt") as date,
            SUM(tax) as total_tax,
            COUNT(*) as order_count
          FROM "Order"
          WHERE
            "createdAt" BETWEEN ${options.dateRange.start} AND ${options.dateRange.end}
            AND status = 'completed'
          GROUP BY DATE_TRUNC(${interval}, "createdAt")
          ORDER BY date ASC
        `;

      default:
        throw new ValidationError('Invalid report type');
    }
  }
} 