import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { Redis } from 'ioredis';
import { DateTime } from 'luxon';

export class AdvancedInventoryService {
  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {}

  async createTransferOrder(data: {
    fromBranchId: string;
    toBranchId: string;
    items: Array<{
      productId: string;
      quantity: number;
      batchNumbers?: string[];
      serialNumbers?: string[];
    }>;
    requestedBy: string;
    notes?: string;
  }) {
    // Validate stock availability
    for (const item of data.items) {
      const inventory = await this.prisma.inventory.findUnique({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId: data.fromBranchId
          }
        }
      });

      if (!inventory || inventory.quantity < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }
    }

    return this.prisma.transferOrder.create({
      data: {
        fromBranchId: data.fromBranchId,
        toBranchId: data.toBranchId,
        status: 'PENDING',
        requestedBy: data.requestedBy,
        notes: data.notes,
        items: {
          create: data.items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            batchNumbers: item.batchNumbers,
            serialNumbers: item.serialNumbers
          }))
        }
      }
    });
  }

  async processTransferOrder(
    transferOrderId: string,
    processedBy: string
  ) {
    const transferOrder = await this.prisma.transferOrder.findUnique({
      where: { id: transferOrderId },
      include: { items: true }
    });

    if (!transferOrder) throw new Error('Transfer order not found');
    if (transferOrder.status !== 'PENDING') {
      throw new Error('Transfer order already processed');
    }

    // Process each item
    for (const item of transferOrder.items) {
      // Deduct from source branch
      await this.prisma.inventory.update({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId: transferOrder.fromBranchId
          }
        },
        data: {
          quantity: {
            decrement: item.quantity
          }
        }
      });

      // Add to destination branch
      await this.prisma.inventory.upsert({
        where: {
          productId_branchId: {
            productId: item.productId,
            branchId: transferOrder.toBranchId
          }
        },
        create: {
          productId: item.productId,
          branchId: transferOrder.toBranchId,
          quantity: item.quantity
        },
        update: {
          quantity: {
            increment: item.quantity
          }
        }
      });

      // Update serial numbers if applicable
      if (item.serialNumbers) {
        await this.prisma.serialNumber.updateMany({
          where: {
            serialNumber: { in: item.serialNumbers },
            productId: item.productId
          },
          data: {
            branchId: transferOrder.toBranchId
          }
        });
      }

      // Update batch locations if applicable
      if (item.batchNumbers) {
        await this.prisma.batchLocation.createMany({
          data: item.batchNumbers.map(batchNumber => ({
            batchNumber,
            productId: item.productId,
            branchId: transferOrder.toBranchId,
            quantity: item.quantity / item.batchNumbers.length
          }))
        });
      }
    }

    // Update transfer order status
    return this.prisma.transferOrder.update({
      where: { id: transferOrderId },
      data: {
        status: 'COMPLETED',
        processedBy,
        processedAt: new Date()
      }
    });
  }

  async optimizeInventory(branchId: string) {
    const products = await this.prisma.product.findMany({
      where: {
        inventory: {
          some: {
            branchId
          }
        }
      },
      include: {
        inventory: true,
        sales: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
            }
          }
        }
      }
    });

    const recommendations = [];

    for (const product of products) {
      const inventory = product.inventory.find(i => i.branchId === branchId);
      if (!inventory) continue;

      // Calculate average daily sales
      const totalSales = product.sales.reduce(
        (sum, sale) => sum + sale.quantity,
        0
      );
      const avgDailySales = totalSales / 90;

      // Calculate optimal reorder point
      const leadTime = 7; // Assume 7 days lead time
      const safetyStock = Math.ceil(avgDailySales * 3); // 3 days safety stock
      const reorderPoint = Math.ceil(avgDailySales * leadTime + safetyStock);

      // Calculate optimal order quantity (EOQ)
      const annualDemand = avgDailySales * 365;
      const orderingCost = 50; // Assume $50 per order
      const holdingCost = product.costPrice * 0.2; // Assume 20% holding cost
      const eoq = Math.ceil(
        Math.sqrt((2 * annualDemand * orderingCost) / holdingCost)
      );

      if (inventory.quantity <= reorderPoint) {
        recommendations.push({
          productId: product.id,
          currentStock: inventory.quantity,
          reorderPoint,
          orderQuantity: eoq,
          priority:
            inventory.quantity === 0
              ? 'HIGH'
              : inventory.quantity < safetyStock
              ? 'MEDIUM'
              : 'LOW'
        });
      }
    }

    return recommendations;
  }

  async trackBatch(data: {
    productId: string;
    batchNumber: string;
    quantity: number;
    manufacturingDate?: Date;
    expiryDate?: Date;
    supplierPrice: number;
    supplierLotNumber?: string;
  }) {
    return this.prisma.batch.create({
      data: {
        ...data,
        remainingQuantity: data.quantity,
        status: 'ACTIVE'
      }
    });
  }

  async trackSerialNumber(data: {
    productId: string;
    serialNumber: string;
    batchNumber?: string;
    status: 'IN_STOCK' | 'SOLD' | 'DEFECTIVE';
    warrantyExpiryDate?: Date;
  }) {
    return this.prisma.serialNumber.create({
      data
    });
  }

  async calculateReorderPoints() {
    const products = await this.prisma.product.findMany({
      include: {
        inventory: true,
        sales: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
            }
          }
        }
      }
    });

    const reorderPoints = products.map(product => {
      const dailySales = product.sales.length / 90;
      const leadTime = product.leadTime || 7; // Default 7 days if not specified
      const safetyStock = Math.ceil(dailySales * 7); // 7 days safety stock
      const reorderPoint = Math.ceil(dailySales * leadTime + safetyStock);

      return {
        productId: product.id,
        currentStock: product.inventory.quantity,
        reorderPoint,
        suggestedOrderQuantity: product.inventory.quantity <= reorderPoint
          ? Math.max(reorderPoint * 2 - product.inventory.quantity, 0)
          : 0
      };
    });

    // Cache results
    await this.redis.setex(
      'reorder-points',
      3600, // 1 hour cache
      JSON.stringify(reorderPoints)
    );

    return reorderPoints;
  }

  async checkExpiringItems(daysThreshold: number = 30) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysThreshold);

    return this.prisma.batch.findMany({
      where: {
        expiryDate: {
          lte: expiryDate
        },
        remainingQuantity: {
          gt: 0
        }
      },
      include: {
        product: true
      }
    });
  }

  async calculateInventoryTurnover(productId: string, period: 'month' | 'quarter' | 'year') {
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const [averageInventory, sales] = await Promise.all([
      this.prisma.inventorySnapshot.aggregate({
        where: {
          productId,
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        _avg: {
          quantity: true
        }
      }),
      this.prisma.saleItem.aggregate({
        where: {
          productId,
          sale: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        },
        _sum: {
          quantity: true
        }
      })
    ]);

    const avgInventory = averageInventory._avg.quantity || 0;
    const totalSales = sales._sum.quantity || 0;

    return avgInventory > 0 ? totalSales / avgInventory : 0;
  }

  async generateQualityControlReport(batchId: string) {
    const batch = await this.prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        qualityChecks: true,
        product: true
      }
    });

    if (!batch) throw new Error('Batch not found');

    const checksResults = batch.qualityChecks.reduce((acc, check) => {
      acc[check.parameter] = check.result;
      return acc;
    }, {} as Record<string, string>);

    return {
      batchNumber: batch.batchNumber,
      product: batch.product.name,
      manufacturingDate: batch.manufacturingDate,
      expiryDate: batch.expiryDate,
      qualityChecks: checksResults,
      status: this.determineQualityStatus(checksResults)
    };
  }

  private determineQualityStatus(checks: Record<string, string>): 'PASSED' | 'FAILED' | 'WARNING' {
    const results = Object.values(checks);
    if (results.some(r => r === 'FAILED')) return 'FAILED';
    if (results.some(r => r === 'WARNING')) return 'WARNING';
    return 'PASSED';
  }
} 