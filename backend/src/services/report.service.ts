import { BaseService } from './base.service';
import { DateTime } from 'luxon';
import { ValidationError } from '../utils/errors';

type TimeFrame = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
type ReportFormat = 'json' | 'csv' | 'pdf';

export class ReportService extends BaseService {
  async generateSalesReport(params: {
    timeFrame: TimeFrame;
    startDate?: Date;
    endDate?: Date;
    branchId?: string;
    format?: ReportFormat;
    includeDetails?: boolean;
  }) {
    const { startDate, endDate } = this.getDateRange(params.timeFrame, params.startDate, params.endDate);

    const salesData = await this.prisma.transaction.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        branchId: params.branchId,
        type: 'SALE',
        status: 'COMPLETED'
      },
      include: params.includeDetails ? {
        items: {
          include: {
            product: true
          }
        },
        employee: true,
        customer: true
      } : undefined,
      orderBy: {
        createdAt: 'asc'
      }
    });

    const summary = {
      totalSales: salesData.length,
      totalRevenue: salesData.reduce((sum, sale) => sum + sale.total, 0),
      averageTransactionValue: salesData.length > 0
        ? salesData.reduce((sum, sale) => sum + sale.total, 0) / salesData.length
        : 0,
      timeFrame: params.timeFrame,
      startDate,
      endDate
    };

    if (params.includeDetails) {
      const productSales = this.aggregateProductSales(salesData);
      const hourlySales = this.aggregateHourlySales(salesData);
      const employeeSales = this.aggregateEmployeeSales(salesData);

      return {
        summary,
        details: {
          productSales,
          hourlySales,
          employeeSales,
          transactions: salesData
        }
      };
    }

    return summary;
  }

  async generateInventoryReport(params: {
    branchId?: string;
    categoryId?: string;
    lowStock?: boolean;
    format?: ReportFormat;
  }) {
    const inventory = await this.prisma.inventory.findMany({
      where: {
        branchId: params.branchId,
        product: params.categoryId ? {
          categoryId: params.categoryId
        } : undefined,
        quantity: params.lowStock ? {
          lte: this.prisma.product.fields.reorderPoint
        } : undefined
      },
      include: {
        product: {
          include: {
            category: true,
            supplier: true
          }
        },
        stockMovements: {
          take: 5,
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    const summary = {
      totalProducts: inventory.length,
      totalValue: inventory.reduce(
        (sum, item) => sum + (item.quantity * item.product.costPrice),
        0
      ),
      lowStockItems: inventory.filter(
        item => item.quantity <= item.product.reorderPoint
      ).length,
      outOfStockItems: inventory.filter(item => item.quantity === 0).length
    };

    const details = inventory.map(item => ({
      productId: item.productId,
      name: item.product.name,
      sku: item.product.sku,
      category: item.product.category.name,
      supplier: item.product.supplier.name,
      quantity: item.quantity,
      reorderPoint: item.product.reorderPoint,
      value: item.quantity * item.product.costPrice,
      lastMovements: item.stockMovements
    }));

    return {
      summary,
      details
    };
  }

  async generateFinancialReport(params: {
    timeFrame: TimeFrame;
    startDate?: Date;
    endDate?: Date;
    branchId?: string;
    format?: ReportFormat;
  }) {
    const { startDate, endDate } = this.getDateRange(params.timeFrame, params.startDate, params.endDate);

    const [sales, expenses, refunds] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          type: 'SALE',
          status: 'COMPLETED',
          branchId: params.branchId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      }),
      this.prisma.expense.findMany({
        where: {
          branchId: params.branchId,
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        include: {
          category: true
        }
      }),
      this.prisma.transaction.findMany({
        where: {
          type: 'REFUND',
          status: 'COMPLETED',
          branchId: params.branchId,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      })
    ]);

    const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalRefunds = refunds.reduce((sum, refund) => sum + refund.total, 0);
    const netIncome = revenue - totalExpenses - totalRefunds;

    const expensesByCategory = expenses.reduce((acc, expense) => {
      const category = expense.category.name;
      acc[category] = (acc[category] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);

    return {
      summary: {
        revenue,
        expenses: totalExpenses,
        refunds: totalRefunds,
        netIncome,
        grossMargin: revenue > 0 ? ((revenue - totalExpenses) / revenue) * 100 : 0
      },
      details: {
        expensesByCategory,
        dailyRevenue: this.aggregateDailyFinancials(sales),
        paymentMethods: this.aggregatePaymentMethods(sales)
      }
    };
  }

  async generateCustomerReport(params: {
    timeFrame: TimeFrame;
    startDate?: Date;
    endDate?: Date;
    branchId?: string;
    format?: ReportFormat;
  }) {
    const { startDate, endDate } = this.getDateRange(params.timeFrame, params.startDate, params.endDate);

    const customers = await this.prisma.customer.findMany({
      include: {
        transactions: {
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            },
            branchId: params.branchId
          }
        },
        loyaltyHistory: {
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        }
      }
    });

    const summary = {
      totalCustomers: customers.length,
      activeCustomers: customers.filter(c => c.transactions.length > 0).length,
      averageTransactionValue: customers.reduce(
        (sum, c) => sum + c.transactions.reduce((s, t) => s + t.total, 0),
        0
      ) / customers.filter(c => c.transactions.length > 0).length || 0,
      loyaltyProgramParticipation: customers.filter(c => c.loyaltyHistory.length > 0).length
    };

    const customerSegments = this.analyzeCustomerSegments(customers);
    const customerRetention = this.calculateCustomerRetention(customers, startDate, endDate);

    return {
      summary,
      details: {
        customerSegments,
        customerRetention,
        topCustomers: this.getTopCustomers(customers)
      }
    };
  }

  private getDateRange(timeFrame: TimeFrame, startDate?: Date, endDate?: Date) {
    const now = DateTime.now();

    switch (timeFrame) {
      case 'daily':
        return {
          startDate: now.startOf('day').toJSDate(),
          endDate: now.endOf('day').toJSDate()
        };
      case 'weekly':
        return {
          startDate: now.startOf('week').toJSDate(),
          endDate: now.endOf('week').toJSDate()
        };
      case 'monthly':
        return {
          startDate: now.startOf('month').toJSDate(),
          endDate: now.endOf('month').toJSDate()
        };
      case 'yearly':
        return {
          startDate: now.startOf('year').toJSDate(),
          endDate: now.endOf('year').toJSDate()
        };
      case 'custom':
        if (!startDate || !endDate) {
          throw new ValidationError('Start and end dates are required for custom timeframe');
        }
        return { startDate, endDate };
      default:
        throw new ValidationError('Invalid timeframe');
    }
  }

  private aggregateProductSales(sales: any[]) {
    const productSales = new Map<string, {
      quantity: number;
      revenue: number;
      transactions: number;
    }>();

    sales.forEach(sale => {
      sale.items.forEach((item: any) => {
        const current = productSales.get(item.productId) || {
          quantity: 0,
          revenue: 0,
          transactions: 0
        };

        productSales.set(item.productId, {
          quantity: current.quantity + item.quantity,
          revenue: current.revenue + (item.price * item.quantity),
          transactions: current.transactions + 1
        });
      });
    });

    return Array.from(productSales.entries()).map(([productId, data]) => ({
      productId,
      ...data
    }));
  }

  private aggregateHourlySales(sales: any[]) {
    const hourlySales = new Array(24).fill(0);

    sales.forEach(sale => {
      const hour = new Date(sale.createdAt).getHours();
      hourlySales[hour] += sale.total;
    });

    return hourlySales.map((amount, hour) => ({
      hour,
      amount
    }));
  }

  private aggregateEmployeeSales(sales: any[]) {
    const employeeSales = new Map<string, {
      transactions: number;
      revenue: number;
      averageValue: number;
    }>();

    sales.forEach(sale => {
      const current = employeeSales.get(sale.employeeId) || {
        transactions: 0,
        revenue: 0,
        averageValue: 0
      };

      const updated = {
        transactions: current.transactions + 1,
        revenue: current.revenue + sale.total,
        averageValue: (current.revenue + sale.total) / (current.transactions + 1)
      };

      employeeSales.set(sale.employeeId, updated);
    });

    return Array.from(employeeSales.entries()).map(([employeeId, data]) => ({
      employeeId,
      ...data
    }));
  }

  private aggregateDailyFinancials(sales: any[]) {
    const dailyTotals = new Map<string, number>();

    sales.forEach(sale => {
      const date = DateTime.fromJSDate(sale.createdAt).toISODate();
      const current = dailyTotals.get(date) || 0;
      dailyTotals.set(date, current + sale.total);
    });

    return Array.from(dailyTotals.entries()).map(([date, total]) => ({
      date,
      total
    }));
  }

  private aggregatePaymentMethods(sales: any[]) {
    return sales.reduce((acc, sale) => {
      const method = sale.paymentMethod;
      acc[method] = (acc[method] || 0) + sale.total;
      return acc;
    }, {} as Record<string, number>);
  }

  private analyzeCustomerSegments(customers: any[]) {
    const segments = {
      new: 0,
      regular: 0,
      loyal: 0,
      inactive: 0
    };

    const now = DateTime.now();

    customers.forEach(customer => {
      const lastTransaction = customer.transactions[0]?.createdAt;
      if (!lastTransaction) {
        segments.inactive++;
        return;
      }

      const daysSinceLastTransaction = now.diff(
        DateTime.fromJSDate(lastTransaction),
        'days'
      ).days;

      if (daysSinceLastTransaction <= 30) {
        if (customer.transactions.length >= 10) {
          segments.loyal++;
        } else {
          segments.regular++;
        }
      } else if (daysSinceLastTransaction <= 90) {
        segments.regular++;
      } else {
        segments.inactive++;
      }
    });

    return segments;
  }

  private calculateCustomerRetention(customers: any[], startDate: Date, endDate: Date) {
    const periods = this.splitDateRange(startDate, endDate);
    const retention = [];

    for (const period of periods) {
      const activeInPeriod = customers.filter(customer =>
        customer.transactions.some(t =>
          t.createdAt >= period.start && t.createdAt <= period.end
        )
      ).length;

      const retainedNextPeriod = customers.filter(customer =>
        customer.transactions.some(t =>
          t.createdAt >= period.start && t.createdAt <= period.end
        ) &&
        customer.transactions.some(t =>
          t.createdAt >= period.nextStart && t.createdAt <= period.nextEnd
        )
      ).length;

      retention.push({
        period: period.start,
        retentionRate: activeInPeriod > 0
          ? (retainedNextPeriod / activeInPeriod) * 100
          : 0
      });
    }

    return retention;
  }

  private splitDateRange(startDate: Date, endDate: Date) {
    const periods = [];
    const start = DateTime.fromJSDate(startDate);
    const end = DateTime.fromJSDate(endDate);
    const duration = end.diff(start, 'months').months;

    for (let i = 0; i < duration; i++) {
      const periodStart = start.plus({ months: i });
      const periodEnd = periodStart.endOf('month');
      const nextStart = periodStart.plus({ months: 1 });
      const nextEnd = nextStart.endOf('month');

      periods.push({
        start: periodStart.toJSDate(),
        end: periodEnd.toJSDate(),
        nextStart: nextStart.toJSDate(),
        nextEnd: nextEnd.toJSDate()
      });
    }

    return periods;
  }

  private getTopCustomers(customers: any[]) {
    return customers
      .map(customer => ({
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`,
        totalSpent: customer.transactions.reduce((sum: number, t: any) => sum + t.total, 0),
        transactionCount: customer.transactions.length,
        averageTransactionValue: customer.transactions.length > 0
          ? customer.transactions.reduce((sum: number, t: any) => sum + t.total, 0) / customer.transactions.length
          : 0,
        loyaltyPoints: customer.loyaltyHistory.reduce((sum: number, h: any) => sum + h.points, 0)
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);
  }
} 