import { PrismaClient, InventoryValuationMethod } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { StockMovementType } from '@prisma/client';

export class InventoryService extends BaseService {
  constructor(private prisma: PrismaClient) {
    super(prisma);
  }

  async trackSerialNumber(data: {
    productId: string;
    serialNumber: string;
    batchNumber?: string;
    expiryDate?: Date;
    cost: number;
    status: 'IN_STOCK' | 'SOLD' | 'DEFECTIVE';
  }) {
    return this.prisma.serialNumber.create({
      data: {
        ...data,
        trackingHistory: {
          create: {
            status: data.status,
            notes: 'Initial registration'
          }
        }
      }
    });
  }

  async createBatch(data: {
    productId: string;
    batchNumber: string;
    quantity: number;
    manufacturingDate: Date;
    expiryDate: Date;
    cost: number;
  }) {
    return this.prisma.batch.create({
      data: {
        ...data,
        remainingQuantity: data.quantity
      }
    });
  }

  async adjustInventory(data: {
    productId: string;
    quantity: number;
    cost?: number;
    batchNumber?: string;
    serialNumbers?: string[];
    reason: string;
    reference?: string;
  }) {
    const { productId, quantity, cost, batchNumber, serialNumbers, reason } = data;

    // Handle serial numbered products
    if (serialNumbers && serialNumbers.length > 0) {
      await this.prisma.serialNumber.updateMany({
        where: {
          productId,
          serialNumber: { in: serialNumbers }
        },
        data: {
          status: quantity > 0 ? 'IN_STOCK' : 'SOLD'
        }
      });
    }

    // Handle batched products
    if (batchNumber) {
      await this.prisma.batch.update({
        where: {
          productId_batchNumber: {
            productId,
            batchNumber
          }
        },
        data: {
          remainingQuantity: {
            increment: quantity
          }
        }
      });
    }

    // Update main inventory record
    const inventory = await this.prisma.inventory.update({
      where: { productId },
      data: {
        quantity: {
          increment: quantity
        }
      }
    });

    // Record movement
    await this.prisma.inventoryMovement.create({
      data: {
        productId,
        quantity,
        cost,
        batchNumber,
        serialNumbers,
        reason,
        reference: data.reference
      }
    });

    return inventory;
  }

  async calculateInventoryValue(
    productId: string,
    method: InventoryValuationMethod
  ) {
    const movements = await this.prisma.inventoryMovement.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' }
    });

    let value = new Decimal(0);
    let quantity = new Decimal(0);

    switch (method) {
      case 'FIFO':
        const fifoQueue: Array<{ quantity: number; cost: number }> = [];
        
        for (const movement of movements) {
          if (movement.quantity > 0 && movement.cost) {
            fifoQueue.push({
              quantity: movement.quantity,
              cost: movement.cost
            });
          } else if (movement.quantity < 0) {
            let remainingQuantity = -movement.quantity;
            while (remainingQuantity > 0 && fifoQueue.length > 0) {
              const oldest = fifoQueue[0];
              const deductQuantity = Math.min(oldest.quantity, remainingQuantity);
              oldest.quantity -= deductQuantity;
              remainingQuantity -= deductQuantity;
              if (oldest.quantity === 0) {
                fifoQueue.shift();
              }
            }
          }
        }

        value = fifoQueue.reduce(
          (sum, item) => sum.plus(new Decimal(item.quantity).times(item.cost)),
          new Decimal(0)
        );
        quantity = fifoQueue.reduce(
          (sum, item) => sum.plus(item.quantity),
          new Decimal(0)
        );
        break;

      case 'WEIGHTED_AVERAGE':
        let totalCost = new Decimal(0);
        let totalQuantity = new Decimal(0);

        for (const movement of movements) {
          if (movement.quantity > 0 && movement.cost) {
            totalCost = totalCost.plus(
              new Decimal(movement.quantity).times(movement.cost)
            );
            totalQuantity = totalQuantity.plus(movement.quantity);
          } else if (movement.quantity < 0) {
            totalQuantity = totalQuantity.plus(movement.quantity);
          }
        }

        const averageCost = totalQuantity.isZero() ? 
          new Decimal(0) : 
          totalCost.dividedBy(totalQuantity);
        
        value = totalQuantity.times(averageCost);
        quantity = totalQuantity;
        break;
    }

    return {
      value: value.toNumber(),
      quantity: quantity.toNumber()
    };
  }

  async adjustStock(movement: StockMovement) {
    return this.prisma.$transaction(async (prisma) => {
      // Get current inventory
      const inventory = await prisma.inventory.findUnique({
        where: {
          productId_branchId: {
            productId: movement.productId,
            branchId: movement.branchId
          }
        },
        include: {
          product: true
        }
      });

      if (!inventory) {
        throw new ValidationError('Product not found in inventory');
      }

      // Validate adjustment
      if (
        movement.type === StockMovementType.DECREASE &&
        inventory.quantity + movement.quantity < 0
      ) {
        throw new ValidationError('Insufficient stock');
      }

      // Update inventory
      const updatedInventory = await prisma.inventory.update({
        where: {
          productId_branchId: {
            productId: movement.productId,
            branchId: movement.branchId
          }
        },
        data: {
          quantity: {
            increment: movement.quantity
          },
          lastUpdated: new Date()
        }
      });

      // Record movement
      await prisma.stockMovement.create({
        data: {
          productId: movement.productId,
          branchId: movement.branchId,
          quantity: movement.quantity,
          type: movement.type,
          reference: movement.reference,
          notes: movement.notes,
          cost: movement.cost,
          balance: updatedInventory.quantity
        }
      });

      // Check reorder point
      if (
        updatedInventory.quantity <= inventory.product.reorderPoint &&
        !inventory.product.reorderNotificationSent
      ) {
        await this.handleLowStock(movement.productId, updatedInventory.quantity);
      }

      return updatedInventory;
    });
  }

  async transferStock(data: {
    productId: string;
    quantity: number;
    fromBranchId: string;
    toBranchId: string;
    reference?: string;
    notes?: string;
  }) {
    return this.prisma.$transaction(async (prisma) => {
      // Deduct from source branch
      await this.adjustStock({
        productId: data.productId,
        quantity: -data.quantity,
        type: StockMovementType.TRANSFER_OUT,
        branchId: data.fromBranchId,
        reference: data.reference,
        notes: data.notes
      });

      // Add to destination branch
      await this.adjustStock({
        productId: data.productId,
        quantity: data.quantity,
        type: StockMovementType.TRANSFER_IN,
        branchId: data.toBranchId,
        reference: data.reference,
        notes: data.notes
      });

      // Create transfer record
      return prisma.stockTransfer.create({
        data: {
          productId: data.productId,
          quantity: data.quantity,
          fromBranchId: data.fromBranchId,
          toBranchId: data.toBranchId,
          reference: data.reference,
          notes: data.notes,
          status: 'COMPLETED'
        }
      });
    });
  }

  async countStock(data: {
    branchId: string;
    counts: Array<{
      productId: string;
      counted: number;
      notes?: string;
    }>;
    reference?: string;
  }) {
    return this.prisma.$transaction(async (prisma) => {
      const stockCount = await prisma.stockCount.create({
        data: {
          branchId: data.branchId,
          reference: data.reference,
          status: 'IN_PROGRESS'
        }
      });

      // Process each count
      for (const count of data.counts) {
        const inventory = await prisma.inventory.findUnique({
          where: {
            productId_branchId: {
              productId: count.productId,
              branchId: data.branchId
            }
          }
        });

        if (!inventory) {
          throw new ValidationError(`Product ${count.productId} not found in inventory`);
        }

        const difference = count.counted - inventory.quantity;

        // Record count
        await prisma.stockCountItem.create({
          data: {
            stockCountId: stockCount.id,
            productId: count.productId,
            systemQuantity: inventory.quantity,
            countedQuantity: count.counted,
            difference,
            notes: count.notes
          }
        });

        // Adjust inventory if there's a difference
        if (difference !== 0) {
          await this.adjustStock({
            productId: count.productId,
            quantity: difference,
            type: StockMovementType.COUNT_ADJUSTMENT,
            branchId: data.branchId,
            reference: stockCount.id,
            notes: `Stock count adjustment`
          });
        }
      }

      // Update stock count status
      return prisma.stockCount.update({
        where: { id: stockCount.id },
        data: { status: 'COMPLETED' }
      });
    });
  }

  async getStockMovements(
    productId: string,
    branchId: string,
    startDate?: Date,
    endDate?: Date
  ) {
    return this.prisma.stockMovement.findMany({
      where: {
        productId,
        branchId,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        product: true
      }
    });
  }

  async getInventoryValue(branchId: string) {
    const inventory = await this.prisma.inventory.findMany({
      where: { branchId },
      include: {
        product: true
      }
    });

    return inventory.reduce((total, item) => {
      return total + (item.quantity * item.product.costPrice);
    }, 0);
  }

  private async handleLowStock(productId: string, currentQuantity: number) {
    // Get product details
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        supplier: true
      }
    });

    if (!product) return;

    // Create notification
    await this.prisma.notification.create({
      data: {
        type: 'LOW_STOCK',
        title: 'Low Stock Alert',
        message: `${product.name} is below reorder point. Current quantity: ${currentQuantity}`,
        metadata: {
          productId,
          currentQuantity,
          reorderPoint: product.reorderPoint
        }
      }
    });

    // Update notification status
    await this.prisma.product.update({
      where: { id: productId },
      data: { reorderNotificationSent: true }
    });

    // You could also implement email notifications here
    // await this.emailService.sendLowStockAlert(product, currentQuantity);
  }
} 