import { PrismaClient } from '@prisma/client';
import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { PurchaseOrderStatus, SupplierStatus } from '@prisma/client';

interface SupplierCreate {
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  taxId?: string;
  paymentTerms?: string;
  notes?: string;
}

interface PurchaseOrderCreate {
  supplierId: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  expectedDeliveryDate: Date;
  notes?: string;
  shippingAddress?: any;
}

export class SupplierService extends BaseService {
  constructor(private prisma: PrismaClient) {
    super(prisma);
  }

  async createSupplier(data: SupplierCreate) {
    // Validate unique fields
    const existingSupplier = await this.prisma.supplier.findFirst({
      where: {
        OR: [
          { email: data.email },
          { phone: data.phone }
        ]
      }
    });

    if (existingSupplier) {
      throw new ValidationError('Supplier with this email or phone already exists');
    }

    return this.prisma.supplier.create({
      data: {
        ...data,
        status: SupplierStatus.ACTIVE
      }
    });
  }

  async updateSupplier(id: string, data: Partial<SupplierCreate>) {
    if (data.email || data.phone) {
      const existingSupplier = await this.prisma.supplier.findFirst({
        where: {
          OR: [
            data.email ? { email: data.email } : {},
            data.phone ? { phone: data.phone } : {}
          ],
          NOT: { id }
        }
      });

      if (existingSupplier) {
        throw new ValidationError('Supplier with this email or phone already exists');
      }
    }

    return this.prisma.supplier.update({
      where: { id },
      data
    });
  }

  async createPurchaseOrder(data: PurchaseOrderCreate) {
    return this.prisma.$transaction(async (prisma) => {
      // Validate supplier
      const supplier = await prisma.supplier.findUnique({
        where: { id: data.supplierId }
      });

      if (!supplier || supplier.status !== SupplierStatus.ACTIVE) {
        throw new ValidationError('Invalid or inactive supplier');
      }

      // Calculate totals
      const subtotal = data.items.reduce(
        (sum, item) => sum + (item.quantity * item.unitPrice),
        0
      );

      // Create purchase order
      const purchaseOrder = await prisma.purchaseOrder.create({
        data: {
          supplierId: data.supplierId,
          status: PurchaseOrderStatus.DRAFT,
          expectedDeliveryDate: data.expectedDeliveryDate,
          subtotal,
          total: subtotal, // Add tax calculation if needed
          notes: data.notes,
          shippingAddress: data.shippingAddress,
          items: {
            create: data.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.quantity * item.unitPrice
            }))
          }
        },
        include: {
          items: {
            include: {
              product: true
            }
          },
          supplier: true
        }
      });

      // Create notification
      await prisma.notification.create({
        data: {
          type: 'PURCHASE_ORDER_CREATED',
          title: 'New Purchase Order Created',
          message: `Purchase order #${purchaseOrder.id} created for ${supplier.name}`,
          metadata: {
            purchaseOrderId: purchaseOrder.id,
            supplierId: supplier.id
          }
        }
      });

      return purchaseOrder;
    });
  }

  async updatePurchaseOrderStatus(
    id: string,
    status: PurchaseOrderStatus,
    data?: {
      receivedItems?: Array<{
        productId: string;
        quantity: number;
        notes?: string;
      }>;
      notes?: string;
    }
  ) {
    return this.prisma.$transaction(async (prisma) => {
      const purchaseOrder = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
          items: true,
          supplier: true
        }
      });

      if (!purchaseOrder) {
        throw new ValidationError('Purchase order not found');
      }

      if (status === PurchaseOrderStatus.RECEIVED && !data?.receivedItems) {
        throw new ValidationError('Received items data is required');
      }

      // Handle received items
      if (status === PurchaseOrderStatus.RECEIVED && data?.receivedItems) {
        // Validate received quantities
        for (const item of data.receivedItems) {
          const orderItem = purchaseOrder.items.find(i => i.productId === item.productId);
          if (!orderItem) {
            throw new ValidationError(`Product ${item.productId} not in purchase order`);
          }
          if (item.quantity > orderItem.quantity) {
            throw new ValidationError(
              `Received quantity exceeds ordered quantity for product ${item.productId}`
            );
          }
        }

        // Update inventory
        for (const item of data.receivedItems) {
          await prisma.inventory.update({
            where: {
              productId: item.productId
            },
            data: {
              quantity: {
                increment: item.quantity
              },
              lastRestockDate: new Date()
            }
          });

          // Record stock movement
          await prisma.stockMovement.create({
            data: {
              productId: item.productId,
              quantity: item.quantity,
              type: 'PURCHASE_ORDER',
              reference: purchaseOrder.id,
              notes: item.notes
            }
          });
        }
      }

      // Update purchase order
      const updatedPurchaseOrder = await prisma.purchaseOrder.update({
        where: { id },
        data: {
          status,
          notes: data?.notes
            ? `${purchaseOrder.notes || ''}\n${data.notes}`
            : purchaseOrder.notes,
          receivedDate: status === PurchaseOrderStatus.RECEIVED
            ? new Date()
            : undefined
        },
        include: {
          items: {
            include: {
              product: true
            }
          },
          supplier: true
        }
      });

      // Create notification
      await prisma.notification.create({
        data: {
          type: 'PURCHASE_ORDER_UPDATED',
          title: 'Purchase Order Status Updated',
          message: `Purchase order #${id} status updated to ${status}`,
          metadata: {
            purchaseOrderId: id,
            supplierId: purchaseOrder.supplierId,
            status
          }
        }
      });

      return updatedPurchaseOrder;
    });
  }

  async getSupplierPerformance(supplierId: string) {
    const [
      purchaseOrders,
      returns,
      products
    ] = await Promise.all([
      this.prisma.purchaseOrder.findMany({
        where: { supplierId },
        include: {
          items: true
        }
      }),
      this.prisma.supplierReturn.findMany({
        where: { supplierId },
        include: {
          items: true
        }
      }),
      this.prisma.product.findMany({
        where: { supplierId }
      })
    ]);

    const totalOrders = purchaseOrders.length;
    const totalSpent = purchaseOrders.reduce((sum, po) => sum + po.total, 0);
    const averageOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const returnRate = totalOrders > 0
      ? (returns.length / totalOrders) * 100
      : 0;

    const deliveryPerformance = purchaseOrders.reduce((acc, po) => {
      if (po.receivedDate && po.expectedDeliveryDate) {
        const onTime = po.receivedDate <= po.expectedDeliveryDate;
        acc.onTime += onTime ? 1 : 0;
        acc.total += 1;
      }
      return acc;
    }, { onTime: 0, total: 0 });

    return {
      summary: {
        totalOrders,
        totalSpent,
        averageOrderValue,
        returnRate,
        onTimeDeliveryRate: deliveryPerformance.total > 0
          ? (deliveryPerformance.onTime / deliveryPerformance.total) * 100
          : 0,
        activeProducts: products.length
      },
      details: {
        recentOrders: purchaseOrders.slice(0, 5),
        recentReturns: returns.slice(0, 5),
        products
      }
    };
  }
} 