import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';
import { Decimal } from 'decimal.js';

export class ReportingService {
  constructor(private prisma: PrismaClient) {}

  async generateFinancialReport(params: {
    startDate: Date;
    endDate: Date;
    branchId?: string;
  }) {
    const { startDate, endDate, branchId } = params;

    // Sales Analysis
    const sales = await this.prisma.sale.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        branchId
      },
      include: {
        items: true,
        payments: true
      }
    });

    // Cost Analysis
    const costs = await this.prisma.inventoryMovement.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        product: { branchId }
      }
    });

    // Calculate metrics
    const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalCosts = costs.reduce(
      (sum, cost) => sum + (cost.cost || 0) * Math.abs(cost.quantity),
      0
    );
    const grossProfit = totalSales - totalCosts;
    const grossMargin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;

    // Payment Method Analysis
    const paymentMethods = await this.prisma.payment.groupBy({
      by: ['method'],
      where: {
        createdAt: { gte: startDate, lte: endDate },
        sale: { branchId }
      },
      _sum: {
        amount: true
      }
    });

    return {
      summary: {
        totalSales,
        totalCosts,
        grossProfit,
        grossMargin
      },
      paymentMethods: paymentMethods.map(pm => ({
        method: pm.method,
        amount: pm._sum.amount
      }))
    };
  }

  async generateInventoryReport(params: {
    branchId?: string;
    categoryId?: string;
  }) {
    const { branchId, categoryId } = params;

    const products = await this.prisma.product.findMany({
      where: {
        branchId,
        categoryId
      },
      include: {
        inventory: true,
        batches: true,
        category: true
      }
    });

    const report = await Promise.all(
      products.map(async product => {
        const movements = await this.prisma.inventoryMovement.findMany({
          where: { productId: product.id },
          orderBy: { createdAt: 'desc' },
          take: 30 // Last 30 movements
        });

        const value = await this.calculateInventoryValue(
          product.id,
          product.valuationMethod
        );

        return {
          product: {
            id: product.id,
            name: product.name,
            category: product.category.name
          },
          currentStock: product.inventory.quantity,
          reservedStock: product.inventory.reserved,
          reorderLevel: product.reorderLevel,
          value: value.value,
          batches: product.batches.map(batch => ({
            batchNumber: batch.batchNumber,
            remainingQuantity: batch.remainingQuantity,
            expiryDate: batch.expiryDate
          })),
          recentMovements: movements
        };
      })
    );

    return {
      totalProducts: report.length,
      totalValue: report.reduce((sum, item) => sum + item.value, 0),
      lowStock: report.filter(
        item => item.currentStock <= item.reorderLevel
      ).length,
      report
    };
  }

  async generateEmployeeReport(params: {
    startDate: Date;
    endDate: Date;
    employeeId?: string;
  }) {
    const { startDate, endDate, employeeId } = params;

    // Sales Performance
    const sales = await this.prisma.sale.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        employeeId
      },
      include: {
        employee: true
      }
    });

    // Time and Attendance
    const shifts = await this.prisma.shift.findMany({
      where: {
        startTime: { gte: startDate, lte: endDate },
        employeeId
      }
    });

    // Commissions
    const commissions = await this.prisma.commission.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
        employeeId
      }
    });

    return {
      performance: {
        totalSales: sales.length,
        salesValue: sales.reduce((sum, sale) => sum + sale.total, 0),
        averageTransactionValue:
          sales.length > 0
            ? sales.reduce((sum, sale) => sum + sale.total, 0) / sales.length
            : 0
      },
      attendance: {
        totalShifts: shifts.length,
        totalHours: shifts.reduce(
          (sum, shift) =>
            sum +
            (shift.endTime
              ? (shift.endTime.getTime() - shift.startTime.getTime()) / 3600000
              : 0),
          0
        )
      },
      commissions: {
        totalCommission: commissions.reduce(
          (sum, commission) => sum + commission.amount,
          0
        ),
        commissionsByPeriod: this.groupCommissionsByPeriod(commissions)
      }
    };
  }

  private async calculateInventoryValue(
    productId: string,
    method: string
  ) {
    // Implementation from previous InventoryService
    return { value: 0 }; // Placeholder
  }

  private groupCommissionsByPeriod(commissions: any[]) {
    const grouped = commissions.reduce((acc, commission) => {
      const period = format(commission.createdAt, 'yyyy-MM-dd');
      if (!acc[period]) {
        acc[period] = 0;
      }
      acc[period] += commission.amount;
      return acc;
    }, {});

    return Object.entries(grouped).map(([period, amount]) => ({
      period,
      amount
    }));
  }
} 