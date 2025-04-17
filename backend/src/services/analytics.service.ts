import { BaseService } from './base.service';
import { DateTime } from 'luxon';
import { Decimal } from '@prisma/client/runtime';
import { subDays, startOfDay, endOfDay, format } from 'date-fns';

interface SalesAnalytics {
  revenue: number;
  transactions: number;
  averageOrderValue: number;
  salesByHour: Record<number, number>;
  salesByDay: Record<string, number>;
  topProducts: Array<{
    productId: string;
    name: string;
    quantity: number;
    revenue: number;
  }>;
  salesByPaymentMethod: Record<string, number>;
}

interface InventoryAnalytics {
  totalProducts: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  turnoverRate: number;
  topSellingProducts: Array<{
    productId: string;
    name: string;
    salesVelocity: number;
  }>;
}

interface AnalyticsMetric {
  id: string;
  name: string;
  value: number;
  dimension?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface AnalyticsQuery {
  metrics: string[];
  dimensions?: string[];
  startDate?: Date;
  endDate?: Date;
  interval?: 'hour' | 'day' | 'week' | 'month';
  filters?: Record<string, any>;
}

interface AnalyticsReport {
  metrics: Record<string, number>;
  dimensions?: Record<string, Record<string, number>>;
  timeline?: Array<{
    timestamp: Date;
    metrics: Record<string, number>;
  }>;
}

interface AnalyticsDashboard {
  id: string;
  name: string;
  widgets: AnalyticsWidget[];
  filters?: Record<string, any>;
  refreshInterval?: number;
}

interface AnalyticsWidget {
  id: string;
  type: 'metric' | 'chart' | 'table';
  title: string;
  query: AnalyticsQuery;
  visualization?: {
    type: 'line' | 'bar' | 'pie' | 'table';
    options?: Record<string, any>;
  };
}

interface AnalyticsAlert {
  id: string;
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'change';
  threshold: number;
  interval: 'realtime' | '5min' | '15min' | '1hour' | '1day';
  status: 'active' | 'triggered' | 'resolved';
  lastTriggered?: Date;
}

interface TimeRange {
  start: Date;
  end: Date;
}

interface SalesMetrics {
  totalSales: Decimal;
  orderCount: number;
  averageOrderValue: Decimal;
  topProducts: Array<{
    productId: string;
    name: string;
    quantity: number;
    revenue: Decimal;
  }>;
  salesByDay: Array<{
    date: string;
    sales: Decimal;
    orders: number;
  }>;
}

interface CustomerMetrics {
  newCustomers: number;
  activeCustomers: number;
  churnRate: number;
  customerLifetimeValue: Decimal;
  topCustomers: Array<{
    customerId: string;
    name: string;
    totalSpent: Decimal;
    orderCount: number;
  }>;
}

interface InventoryMetrics {
  totalStock: number;
  lowStockItems: number;
  outOfStockItems: number;
  inventoryValue: Decimal;
  turnoverRate: number;
  topSellingItems: Array<{
    productId: string;
    name: string;
    soldQuantity: number;
    revenue: Decimal;
  }>;
}

export class AnalyticsService extends BaseService {
  async getSalesAnalytics(params: {
    startDate: Date;
    endDate: Date;
    branchId?: string;
  }): Promise<SalesAnalytics> {
    const sales = await this.prisma.transaction.findMany({
      where: {
        type: 'SALE',
        status: 'COMPLETED',
        branchId: params.branchId,
        createdAt: {
          gte: params.startDate,
          lte: params.endDate
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    // Calculate basic metrics
    const revenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    const transactions = sales.length;
    const averageOrderValue = transactions > 0 ? revenue / transactions : 0;

    // Analyze sales by hour
    const salesByHour = this.analyzeSalesByHour(sales);

    // Analyze sales by day
    const salesByDay = this.analyzeSalesByDay(sales);

    // Analyze top products
    const topProducts = await this.analyzeTopProducts(sales);

    // Analyze sales by payment method
    const salesByPaymentMethod = this.analyzeSalesByPaymentMethod(sales);

    return {
      revenue,
      transactions,
      averageOrderValue,
      salesByHour,
      salesByDay,
      topProducts,
      salesByPaymentMethod
    };
  }

  async getInventoryAnalytics(branchId?: string): Promise<InventoryAnalytics> {
    const [inventory, sales] = await Promise.all([
      this.prisma.inventory.findMany({
        where: { branchId },
        include: {
          product: true
        }
      }),
      this.prisma.transaction.findMany({
        where: {
          type: 'SALE',
          status: 'COMPLETED',
          branchId,
          createdAt: {
            gte: DateTime.now().minus({ days: 30 }).toJSDate()
          }
        },
        include: {
          items: true
        }
      })
    ]);

    const totalProducts = inventory.length;
    const totalValue = inventory.reduce(
      (sum, item) => sum + (item.quantity * item.product.costPrice),
      0
    );
    const lowStockItems = inventory.filter(
      item => item.quantity <= item.product.reorderPoint
    ).length;
    const outOfStockItems = inventory.filter(
      item => item.quantity === 0
    ).length;

    const turnoverRate = this.calculateInventoryTurnover(inventory, sales);
    const topSellingProducts = this.analyzeProductSalesVelocity(inventory, sales);

    return {
      totalProducts,
      totalValue,
      lowStockItems,
      outOfStockItems,
      turnoverRate,
      topSellingProducts
    };
  }

  async getCustomerAnalytics(params: {
    startDate: Date;
    endDate: Date;
    branchId?: string;
  }) {
    const [customers, transactions] = await Promise.all([
      this.prisma.customer.findMany({
        include: {
          transactions: {
            where: {
              createdAt: {
                gte: params.startDate,
                lte: params.endDate
              },
              branchId: params.branchId
            }
          }
        }
      }),
      this.prisma.transaction.findMany({
        where: {
          type: 'SALE',
          status: 'COMPLETED',
          branchId: params.branchId,
          createdAt: {
            gte: params.startDate,
            lte: params.endDate
          }
        },
        include: {
          customer: true
        }
      })
    ]);

    return {
      customerMetrics: this.calculateCustomerMetrics(customers),
      customerSegments: this.analyzeCustomerSegments(customers),
      customerRetention: this.calculateCustomerRetention(customers, params.startDate),
      topCustomers: this.identifyTopCustomers(customers)
    };
  }

  async getPredictiveAnalytics() {
    const [sales, inventory] = await Promise.all([
      this.prisma.transaction.findMany({
        where: {
          type: 'SALE',
          status: 'COMPLETED',
          createdAt: {
            gte: DateTime.now().minus({ days: 90 }).toJSDate()
          }
        },
        include: {
          items: true
        }
      }),
      this.prisma.inventory.findMany({
        include: {
          product: true,
          stockMovements: {
            where: {
              createdAt: {
                gte: DateTime.now().minus({ days: 90 }).toJSDate()
              }
            }
          }
        }
      })
    ]);

    return {
      salesForecast: this.generateSalesForecast(sales),
      inventoryPredictions: this.predictInventoryNeeds(inventory, sales),
      demandPatterns: this.analyzeDemandPatterns(sales)
    };
  }

  async trackMetric(
    data: Omit<AnalyticsMetric, 'id' | 'timestamp'>
  ): Promise<AnalyticsMetric> {
    return this.prisma.analyticsMetric.create({
      data: {
        ...data,
        timestamp: new Date()
      }
    });
  }

  async batchTrackMetrics(
    metrics: Array<Omit<AnalyticsMetric, 'id' | 'timestamp'>>
  ): Promise<void> {
    await this.prisma.analyticsMetric.createMany({
      data: metrics.map(metric => ({
        ...metric,
        timestamp: new Date()
      }))
    });
  }

  async queryMetrics(
    query: AnalyticsQuery
  ): Promise<AnalyticsReport> {
    const where: any = {};

    if (query.startDate || query.endDate) {
      where.timestamp = {
        ...(query.startDate && { gte: query.startDate }),
        ...(query.endDate && { lte: query.endDate })
      };
    }

    if (query.filters) {
      Object.entries(query.filters).forEach(([key, value]) => {
        where[key] = value;
      });
    }

    const metrics = await this.aggregateMetrics(
      query.metrics,
      where
    );

    const dimensions = query.dimensions
      ? await this.aggregateByDimensions(
          query.metrics,
          query.dimensions,
          where
        )
      : undefined;

    const timeline = query.interval
      ? await this.aggregateTimeline(
          query.metrics,
          query.interval,
          where
        )
      : undefined;

    return {
      metrics,
      dimensions,
      timeline
    };
  }

  async getTopMetrics(
    options: {
      metric: string;
      dimension: string;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<Array<{
    dimension: string;
    value: number;
  }>> {
    const where: any = {
      name: options.metric
    };

    if (options.startDate || options.endDate) {
      where.timestamp = {
        ...(options.startDate && { gte: options.startDate }),
        ...(options.endDate && { lte: options.endDate })
      };
    }

    const metrics = await this.prisma.analyticsMetric.groupBy({
      by: ['dimension'],
      where,
      _sum: {
        value: true
      },
      orderBy: {
        _sum: {
          value: 'desc'
        }
      },
      take: options.limit || 10
    });

    return metrics.map(metric => ({
      dimension: metric.dimension!,
      value: metric._sum.value!
    }));
  }

  async generateReport(
    options: {
      metrics: string[];
      dimensions?: string[];
      startDate: Date;
      endDate: Date;
      interval?: 'day' | 'week' | 'month';
      format?: 'json' | 'csv';
    }
  ): Promise<string> {
    const report = await this.queryMetrics({
      metrics: options.metrics,
      dimensions: options.dimensions,
      startDate: options.startDate,
      endDate: options.endDate,
      interval: options.interval
    });

    if (options.format === 'csv') {
      return this.convertReportToCSV(report);
    }

    return JSON.stringify(report, null, 2);
  }

  private analyzeSalesByHour(sales: any[]): Record<number, number> {
    const hourlyData: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
      hourlyData[i] = 0;
    }

    sales.forEach(sale => {
      const hour = new Date(sale.createdAt).getHours();
      hourlyData[hour] += sale.total;
    });

    return hourlyData;
  }

  private analyzeSalesByDay(sales: any[]): Record<string, number> {
    const dailyData: Record<string, number> = {};

    sales.forEach(sale => {
      const day = DateTime.fromJSDate(sale.createdAt).toISODate();
      dailyData[day] = (dailyData[day] || 0) + sale.total;
    });

    return dailyData;
  }

  private async analyzeTopProducts(sales: any[]) {
    const productSales = new Map<string, {
      name: string;
      quantity: number;
      revenue: number;
    }>();

    sales.forEach(sale => {
      sale.items.forEach((item: any) => {
        const current = productSales.get(item.productId) || {
          name: item.product.name,
          quantity: 0,
          revenue: 0
        };

        productSales.set(item.productId, {
          name: item.product.name,
          quantity: current.quantity + item.quantity,
          revenue: current.revenue + (item.price * item.quantity)
        });
      });
    });

    return Array.from(productSales.entries())
      .map(([productId, data]) => ({
        productId,
        ...data
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }

  private analyzeSalesByPaymentMethod(sales: any[]): Record<string, number> {
    return sales.reduce((acc, sale) => {
      acc[sale.paymentMethod] = (acc[sale.paymentMethod] || 0) + sale.total;
      return acc;
    }, {});
  }

  private calculateInventoryTurnover(inventory: any[], sales: any[]): number {
    const averageInventoryValue = inventory.reduce(
      (sum, item) => sum + (item.quantity * item.product.costPrice),
      0
    ) / inventory.length;

    const costOfGoodsSold = sales.reduce((sum, sale) => {
      return sum + sale.items.reduce((itemSum: number, item: any) => {
        const product = inventory.find(i => i.productId === item.productId)?.product;
        return itemSum + (item.quantity * (product?.costPrice || 0));
      }, 0);
    }, 0);

    return averageInventoryValue > 0 ? costOfGoodsSold / averageInventoryValue : 0;
  }

  private analyzeProductSalesVelocity(inventory: any[], sales: any[]) {
    const productSales = new Map<string, number>();

    sales.forEach(sale => {
      sale.items.forEach((item: any) => {
        productSales.set(
          item.productId,
          (productSales.get(item.productId) || 0) + item.quantity
        );
      });
    });

    return inventory
      .map(item => ({
        productId: item.productId,
        name: item.product.name,
        salesVelocity: (productSales.get(item.productId) || 0) / 30 // Daily sales rate
      }))
      .sort((a, b) => b.salesVelocity - a.salesVelocity)
      .slice(0, 10);
  }

  private calculateCustomerMetrics(customers: any[]) {
    const activeCustomers = customers.filter(c => c.transactions.length > 0);
    const totalCustomers = customers.length;

    return {
      totalCustomers,
      activeCustomers: activeCustomers.length,
      averageTransactionValue: activeCustomers.reduce(
        (sum, c) => sum + c.transactions.reduce((s: number, t: any) => s + t.total, 0),
        0
      ) / activeCustomers.length || 0,
      customerActivationRate: totalCustomers > 0
        ? (activeCustomers.length / totalCustomers) * 100
        : 0
    };
  }

  private analyzeCustomerSegments(customers: any[]) {
    const segments = {
      new: 0,
      occasional: 0,
      regular: 0,
      loyal: 0,
      inactive: 0
    };

    customers.forEach(customer => {
      const transactionCount = customer.transactions.length;
      const lastTransaction = customer.transactions[0]?.createdAt;

      if (!lastTransaction) {
        segments.inactive++;
      } else {
        const daysSinceLastTransaction = DateTime.now().diff(
          DateTime.fromJSDate(lastTransaction),
          'days'
        ).days;

        if (daysSinceLastTransaction <= 30) {
          if (transactionCount >= 10) {
            segments.loyal++;
          } else if (transactionCount >= 5) {
            segments.regular++;
          } else {
            segments.occasional++;
          }
        } else if (daysSinceLastTransaction <= 90) {
          segments.occasional++;
        } else {
          segments.inactive++;
        }
      }
    });

    return segments;
  }

  private calculateCustomerRetention(customers: any[], startDate: Date) {
    const cohorts = new Map<string, {
      total: number;
      retained: number;
    }>();

    customers.forEach(customer => {
      if (customer.transactions.length === 0) return;

      const firstTransaction = DateTime.fromJSDate(
        customer.transactions[customer.transactions.length - 1].createdAt
      );
      const cohortKey = firstTransaction.toFormat('yyyy-MM');

      const cohort = cohorts.get(cohortKey) || { total: 0, retained: 0 };
      cohort.total++;

      // Check if customer made another purchase after first month
      const hasRetention = customer.transactions.some((t: any) =>
        DateTime.fromJSDate(t.createdAt) > firstTransaction.plus({ months: 1 })
      );

      if (hasRetention) {
        cohort.retained++;
      }

      cohorts.set(cohortKey, cohort);
    });

    return Array.from(cohorts.entries()).map(([cohort, data]) => ({
      cohort,
      retentionRate: data.total > 0 ? (data.retained / data.total) * 100 : 0,
      totalCustomers: data.total
    }));
  }

  private identifyTopCustomers(customers: any[]) {
    return customers
      .map(customer => ({
        id: customer.id,
        name: `${customer.firstName} ${customer.lastName}`,
        totalSpent: customer.transactions.reduce((sum: number, t: any) => sum + t.total, 0),
        transactionCount: customer.transactions.length,
        averageTransactionValue: customer.transactions.length > 0
          ? customer.transactions.reduce((sum: number, t: any) => sum + t.total, 0) / customer.transactions.length
          : 0
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);
  }

  private generateSalesForecast(sales: any[]) {
    // Group sales by day
    const dailySales = new Map<string, number>();
    sales.forEach(sale => {
      const day = DateTime.fromJSDate(sale.createdAt).toISODate();
      dailySales.set(day, (dailySales.get(day) || 0) + sale.total);
    });

    // Calculate moving average
    const movingAverageDays = 7;
    const forecast = [];
    let currentDate = DateTime.now();

    for (let i = 0; i < 30; i++) {
      const dateKey = currentDate.toISODate();
      const historicalData = Array.from(dailySales.entries())
        .filter(([day]) => day <= dateKey)
        .slice(-movingAverageDays);

      const average = historicalData.reduce((sum, [, value]) => sum + value, 0) / 
        historicalData.length;

      forecast.push({
        date: dateKey,
        forecast: average
      });

      currentDate = currentDate.plus({ days: 1 });
    }

    return forecast;
  }

  private predictInventoryNeeds(inventory: any[], sales: any[]) {
    return inventory.map(item => {
      const dailySales = this.calculateDailySales(item.productId, sales);
      const leadTime = item.product.leadTime || 7; // Default 7 days if not specified
      const safetyStock = Math.ceil(dailySales * 7); // 7 days safety stock
      const reorderPoint = Math.ceil(dailySales * leadTime + safetyStock);

      return {
        productId: item.productId,
        name: item.product.name,
        currentStock: item.quantity,
        dailySales,
        reorderPoint,
        daysUntilReorder: item.quantity > reorderPoint
          ? Math.floor((item.quantity - reorderPoint) / dailySales)
          : 0,
        suggestedOrder: item.quantity <= reorderPoint
          ? Math.max(reorderPoint * 2 - item.quantity, 0)
          : 0
      };
    });
  }

  private calculateDailySales(productId: string, sales: any[]): number {
    const productSales = sales.reduce((sum, sale) => {
      const productItem = sale.items.find((item: any) => item.productId === productId);
      return sum + (productItem?.quantity || 0);
    }, 0);

    return productSales / 90; // Average daily sales over 90 days
  }

  private analyzeDemandPatterns(sales: any[]) {
    const patterns = new Map<string, number[]>();
    
    // Initialize arrays for each day of the week
    for (let i = 0; i < 7; i++) {
      patterns.set(i.toString(), new Array(24).fill(0));
    }

    sales.forEach(sale => {
      const date = DateTime.fromJSDate(sale.createdAt);
      const dayOfWeek = date.weekday - 1; // 0-6
      const hour = date.hour;

      const hourlyPattern = patterns.get(dayOfWeek.toString())!;
      hourlyPattern[hour] += sale.total;
    });

    return Array.from(patterns.entries()).map(([day, hourlyData]) => ({
      day: parseInt(day),
      hourlyPattern: hourlyData
    }));
  }

  private async aggregateMetrics(
    metrics: string[],
    where: any
  ): Promise<Record<string, number>> {
    const results = await this.prisma.analyticsMetric.groupBy({
      by: ['name'],
      where: {
        ...where,
        name: { in: metrics }
      },
      _sum: {
        value: true
      }
    });

    return Object.fromEntries(
      results.map(result => [
        result.name,
        result._sum.value || 0
      ])
    );
  }

  private async aggregateByDimensions(
    metrics: string[],
    dimensions: string[],
    where: any
  ): Promise<Record<string, Record<string, number>>> {
    const results = await this.prisma.analyticsMetric.groupBy({
      by: ['name', 'dimension'],
      where: {
        ...where,
        name: { in: metrics },
        dimension: { in: dimensions }
      },
      _sum: {
        value: true
      }
    });

    const dimensionMap: Record<string, Record<string, number>> = {};

    results.forEach(result => {
      if (!dimensionMap[result.name]) {
        dimensionMap[result.name] = {};
      }
      dimensionMap[result.name][result.dimension!] =
        result._sum.value || 0;
    });

    return dimensionMap;
  }

  private async aggregateTimeline(
    metrics: string[],
    interval: 'hour' | 'day' | 'week' | 'month',
    where: any
  ): Promise<Array<{
    timestamp: Date;
    metrics: Record<string, number>;
  }>> {
    const dateFormat = {
      hour: 'yyyy-MM-dd HH:00:00',
      day: 'yyyy-MM-dd',
      week: 'yyyy-WW',
      month: 'yyyy-MM'
    }[interval];

    const results = await this.prisma.$queryRaw`
      SELECT
        DATE_TRUNC(${interval}, timestamp) as time_bucket,
        name,
        SUM(value) as total
      FROM "AnalyticsMetric"
      WHERE
        name = ANY(${metrics})
        ${where.timestamp ? Prisma.sql`AND timestamp BETWEEN ${where.timestamp.gte} AND ${where.timestamp.lte}` : Prisma.empty}
      GROUP BY time_bucket, name
      ORDER BY time_bucket ASC
    `;

    const timeline: Record<string, Record<string, number>> = {};

    results.forEach((result: any) => {
      const timestamp = DateTime.fromJSDate(result.time_bucket)
        .toFormat(dateFormat);

      if (!timeline[timestamp]) {
        timeline[timestamp] = {};
      }

      timeline[timestamp][result.name] = Number(result.total);
    });

    return Object.entries(timeline).map(([timestamp, metrics]) => ({
      timestamp: DateTime.fromFormat(timestamp, dateFormat).toJSDate(),
      metrics
    }));
  }

  private convertReportToCSV(report: AnalyticsReport): string {
    const rows: string[] = [];

    // Add metrics
    rows.push('Metrics');
    rows.push('Name,Value');
    Object.entries(report.metrics).forEach(([name, value]) => {
      rows.push(`${name},${value}`);
    });
    rows.push('');

    // Add dimensions if present
    if (report.dimensions) {
      rows.push('Dimensions');
      const metrics = Object.keys(report.dimensions);
      const dimensions = new Set<string>();

      metrics.forEach(metric => {
        Object.keys(report.dimensions![metric]).forEach(dim =>
          dimensions.add(dim)
        );
      });

      rows.push(['Dimension', ...metrics].join(','));
      Array.from(dimensions).forEach(dimension => {
        const values = metrics.map(
          metric => report.dimensions![metric][dimension] || 0
        );
        rows.push([dimension, ...values].join(','));
      });
      rows.push('');
    }

    // Add timeline if present
    if (report.timeline) {
      rows.push('Timeline');
      const metrics = Object.keys(report.timeline[0].metrics);
      rows.push(['Timestamp', ...metrics].join(','));

      report.timeline.forEach(point => {
        const values = metrics.map(
          metric => point.metrics[metric] || 0
        );
        rows.push([
          point.timestamp.toISOString(),
          ...values
        ].join(','));
      });
    }

    return rows.join('\n');
  }

  async createDashboard(
    data: Omit<AnalyticsDashboard, 'id'>
  ): Promise<AnalyticsDashboard> {
    return this.prisma.analyticsDashboard.create({
      data: {
        ...data,
        widgets: {
          create: data.widgets
        }
      },
      include: {
        widgets: true
      }
    });
  }

  async getDashboardData(
    dashboardId: string
  ): Promise<Record<string, any>> {
    const dashboard = await this.prisma.analyticsDashboard.findUnique({
      where: { id: dashboardId },
      include: { widgets: true }
    });

    if (!dashboard) {
      throw new Error('Dashboard not found');
    }

    const widgetData = await Promise.all(
      dashboard.widgets.map(async widget => {
        const data = await this.queryMetrics({
          ...widget.query,
          filters: {
            ...widget.query.filters,
            ...dashboard.filters
          }
        });

        return {
          widgetId: widget.id,
          data
        };
      })
    );

    return {
      dashboard,
      data: Object.fromEntries(
        widgetData.map(({ widgetId, data }) => [widgetId, data])
      )
    };
  }

  async createAlert(
    data: Omit<AnalyticsAlert, 'id' | 'status' | 'lastTriggered'>
  ): Promise<AnalyticsAlert> {
    return this.prisma.analyticsAlert.create({
      data: {
        ...data,
        status: 'active'
      }
    });
  }

  async checkAlerts(): Promise<void> {
    const alerts = await this.prisma.analyticsAlert.findMany({
      where: { status: 'active' }
    });

    for (const alert of alerts) {
      try {
        const value = await this.getMetricValue(
          alert.metric,
          alert.interval
        );

        const isTriggered = this.evaluateAlertCondition(
          alert,
          value
        );

        if (isTriggered) {
          await this.triggerAlert(alert, value);
        }
      } catch (error) {
        this.logger.error(
          `Error checking alert ${alert.id}:`,
          error
        );
      }
    }
  }

  async getForecast(
    options: {
      metric: string;
      horizon: number;
      interval: 'hour' | 'day' | 'week';
      historyDays?: number;
    }
  ): Promise<Array<{
    timestamp: Date;
    value: number;
    confidence?: {
      lower: number;
      upper: number;
    };
  }>> {
    const historyDays = options.historyDays || 30;
    const startDate = DateTime.now()
      .minus({ days: historyDays })
      .toJSDate();

    const historicalData = await this.prisma.analyticsMetric.findMany({
      where: {
        name: options.metric,
        timestamp: { gte: startDate }
      },
      orderBy: { timestamp: 'asc' }
    });

    // Simple moving average forecast
    const values = historicalData.map(d => d.value);
    const movingAverage = this.calculateMovingAverage(values, 7);
    const trend = this.calculateTrend(values);

    const forecast = [];
    let lastTimestamp = historicalData[historicalData.length - 1].timestamp;

    for (let i = 1; i <= options.horizon; i++) {
      const timestamp = DateTime.fromJSDate(lastTimestamp)
        .plus({ [options.interval]: i })
        .toJSDate();

      const baseValue = movingAverage[movingAverage.length - 1];
      const projectedValue = baseValue + (trend * i);
      const confidence = this.calculateConfidenceInterval(
        projectedValue,
        i
      );

      forecast.push({
        timestamp,
        value: projectedValue,
        confidence
      });
    }

    return forecast;
  }

  async getCorrelations(
    options: {
      metrics: string[];
      startDate: Date;
      endDate: Date;
      interval: 'hour' | 'day';
    }
  ): Promise<Array<{
    metric1: string;
    metric2: string;
    correlation: number;
    significance: number;
  }>> {
    const metricsData = await Promise.all(
      options.metrics.map(metric =>
        this.getMetricTimeSeries(metric, options)
      )
    );

    const correlations = [];

    for (let i = 0; i < options.metrics.length; i++) {
      for (let j = i + 1; j < options.metrics.length; j++) {
        const correlation = this.calculateCorrelation(
          metricsData[i],
          metricsData[j]
        );

        const significance = this.calculateSignificance(
          correlation,
          metricsData[i].length
        );

        correlations.push({
          metric1: options.metrics[i],
          metric2: options.metrics[j],
          correlation,
          significance
        });
      }
    }

    return correlations.sort((a, b) =>
      Math.abs(b.correlation) - Math.abs(a.correlation)
    );
  }

  private async getMetricValue(
    metric: string,
    interval: string
  ): Promise<number> {
    const now = new Date();
    const startDate = DateTime.now()
      .minus(this.parseInterval(interval))
      .toJSDate();

    const result = await this.prisma.analyticsMetric.aggregate({
      where: {
        name: metric,
        timestamp: { gte: startDate, lte: now }
      },
      _sum: { value: true }
    });

    return result._sum.value || 0;
  }

  private evaluateAlertCondition(
    alert: AnalyticsAlert,
    value: number
  ): boolean {
    switch (alert.condition) {
      case 'gt':
        return value > alert.threshold;
      case 'lt':
        return value < alert.threshold;
      case 'eq':
        return Math.abs(value - alert.threshold) < 0.0001;
      case 'change':
        // Calculate percentage change
        const previousValue = this.getPreviousMetricValue(
          alert.metric,
          alert.interval
        );
        const change = ((value - previousValue) / previousValue) * 100;
        return Math.abs(change) > alert.threshold;
      default:
        return false;
    }
  }

  private async triggerAlert(
    alert: AnalyticsAlert,
    value: number
  ): Promise<void> {
    await this.prisma.analyticsAlert.update({
      where: { id: alert.id },
      data: {
        status: 'triggered',
        lastTriggered: new Date()
      }
    });

    // Emit alert event
    this.eventEmitter.emit('analytics:alert', {
      alertId: alert.id,
      name: alert.name,
      metric: alert.metric,
      value,
      threshold: alert.threshold,
      timestamp: new Date()
    });
  }

  private parseInterval(interval: string): Duration {
    const [value, unit] = interval.match(/\d+|\D+/g)!;
    return Duration.fromObject({
      [unit]: Number(value)
    });
  }

  private calculateMovingAverage(
    values: number[],
    window: number
  ): number[] {
    const result = [];
    for (let i = window - 1; i < values.length; i++) {
      const sum = values
        .slice(i - window + 1, i + 1)
        .reduce((a, b) => a + b, 0);
      result.push(sum / window);
    }
    return result;
  }

  private calculateTrend(values: number[]): number {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  private calculateConfidenceInterval(
    value: number,
    steps: number
  ): { lower: number; upper: number } {
    const uncertainty = 0.1 * steps; // 10% per step
    const margin = value * uncertainty;

    return {
      lower: value - margin,
      upper: value + margin
    };
  }

  private async getMetricTimeSeries(
    metric: string,
    options: {
      startDate: Date;
      endDate: Date;
      interval: 'hour' | 'day';
    }
  ): Promise<number[]> {
    const results = await this.prisma.$queryRaw`
      SELECT
        DATE_TRUNC(${options.interval}, timestamp) as time_bucket,
        SUM(value) as total
      FROM "AnalyticsMetric"
      WHERE
        name = ${metric}
        AND timestamp BETWEEN ${options.startDate} AND ${options.endDate}
      GROUP BY time_bucket
      ORDER BY time_bucket ASC
    `;

    return results.map((r: any) => Number(r.total));
  }

  private calculateCorrelation(
    series1: number[],
    series2: number[]
  ): number {
    const n = Math.min(series1.length, series2.length);
    const mean1 = series1.reduce((a, b) => a + b, 0) / n;
    const mean2 = series2.reduce((a, b) => a + b, 0) / n;

    const variance1 = series1.reduce(
      (sum, x) => sum + Math.pow(x - mean1, 2),
      0
    );
    const variance2 = series2.reduce(
      (sum, x) => sum + Math.pow(x - mean2, 2),
      0
    );

    const covariance = series1.reduce(
      (sum, x, i) => sum + (x - mean1) * (series2[i] - mean2),
      0
    );

    return covariance / Math.sqrt(variance1 * variance2);
  }

  private calculateSignificance(
    correlation: number,
    n: number
  ): number {
    const t = correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
    return 2 * (1 - this.studentT(Math.abs(t), n - 2));
  }

  private studentT(t: number, df: number): number {
    // Simplified implementation of Student's t-distribution CDF
    const x = df / (df + t * t);
    return 1 - 0.5 * Math.pow(x, df / 2);
  }

  async getSalesMetrics(
    timeRange: TimeRange,
    options: {
      groupBy?: 'day' | 'week' | 'month';
      categoryId?: string;
      branchId?: string;
    } = {}
  ): Promise<SalesMetrics> {
    const { start, end } = timeRange;

    // Get orders within time range
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end
        },
        status: 'completed',
        branchId: options.branchId,
        items: options.categoryId ? {
          some: {
            product: {
              categoryId: options.categoryId
            }
          }
        } : undefined
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    // Calculate basic metrics
    const totalSales = orders.reduce(
      (sum, order) => sum.add(order.total),
      new Decimal(0)
    );

    const averageOrderValue = orders.length > 0
      ? totalSales.div(orders.length)
      : new Decimal(0);

    // Calculate top products
    const productSales = new Map<string, {
      name: string;
      quantity: number;
      revenue: Decimal;
    }>();

    orders.forEach(order => {
      order.items.forEach(item => {
        const existing = productSales.get(item.productId) || {
          name: item.product.name,
          quantity: 0,
          revenue: new Decimal(0)
        };

        productSales.set(item.productId, {
          name: item.product.name,
          quantity: existing.quantity + item.quantity,
          revenue: existing.revenue.add(item.total)
        });
      });
    });

    const topProducts = Array.from(productSales.entries())
      .map(([productId, data]) => ({
        productId,
        ...data
      }))
      .sort((a, b) => b.revenue.comparedTo(a.revenue))
      .slice(0, 10);

    // Calculate sales by day
    const salesByDay = this.calculateSalesByDay(orders, start, end);

    return {
      totalSales,
      orderCount: orders.length,
      averageOrderValue,
      topProducts,
      salesByDay
    };
  }

  async getCustomerMetrics(
    timeRange: TimeRange
  ): Promise<CustomerMetrics> {
    const { start, end } = timeRange;

    // Get new customers
    const newCustomers = await this.prisma.customer.count({
      where: {
        createdAt: {
          gte: start,
          lte: end
        }
      }
    });

    // Get active customers (made at least one order in period)
    const activeCustomers = await this.prisma.customer.count({
      where: {
        orders: {
          some: {
            createdAt: {
              gte: start,
              lte: end
            }
          }
        }
      }
    });

    // Calculate churn rate
    const previousPeriodStart = subDays(start, end.getTime() - start.getTime());
    const previousActiveCustomers = await this.prisma.customer.count({
      where: {
        orders: {
          some: {
            createdAt: {
              gte: previousPeriodStart,
              lt: start
            }
          }
        }
      }
    });

    const churnedCustomers = await this.prisma.customer.count({
      where: {
        orders: {
          some: {
            createdAt: {
              gte: previousPeriodStart,
              lt: start
            }
          },
          none: {
            createdAt: {
              gte: start,
              lte: end
            }
          }
        }
      }
    });

    const churnRate = previousActiveCustomers > 0
      ? (churnedCustomers / previousActiveCustomers) * 100
      : 0;

    // Calculate customer lifetime value
    const customerLifetimeValue = await this.calculateCustomerLifetimeValue();

    // Get top customers
    const topCustomers = await this.prisma.customer.findMany({
      where: {
        orders: {
          some: {
            createdAt: {
              gte: start,
              lte: end
            }
          }
        }
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        orders: {
          where: {
            status: 'completed'
          },
          select: {
            total: true
          }
        },
        _count: {
          select: {
            orders: true
          }
        }
      },
      take: 10,
      orderBy: {
        orders: {
          _count: 'desc'
        }
      }
    });

    return {
      newCustomers,
      activeCustomers,
      churnRate,
      customerLifetimeValue,
      topCustomers: topCustomers.map(customer => ({
        customerId: customer.id,
        name: `${customer.firstName} ${customer.lastName}`,
        totalSpent: customer.orders.reduce(
          (sum, order) => sum.add(order.total),
          new Decimal(0)
        ),
        orderCount: customer._count.orders
      }))
    };
  }

  async getInventoryMetrics(): Promise<InventoryMetrics> {
    // Get current inventory status
    const products = await this.prisma.product.findMany({
      include: {
        inventory: true,
        orderItems: {
          where: {
            order: {
              status: 'completed'
            }
          }
        }
      }
    });

    const lowStockThreshold = 10; // Configure as needed

    const metrics: InventoryMetrics = {
      totalStock: products.reduce((sum, p) => sum + (p.inventory?.quantity || 0), 0),
      lowStockItems: products.filter(p => 
        (p.inventory?.quantity || 0) <= lowStockThreshold && 
        (p.inventory?.quantity || 0) > 0
      ).length,
      outOfStockItems: products.filter(p => 
        !p.inventory?.quantity || p.inventory.quantity === 0
      ).length,
      inventoryValue: products.reduce(
        (sum, p) => sum.add(
          p.price.mul(p.inventory?.quantity || 0)
        ),
        new Decimal(0)
      ),
      turnoverRate: this.calculateInventoryTurnoverRate(products),
      topSellingItems: this.getTopSellingItems(products)
    };

    return metrics;
  }

  async trackEvent(
    eventName: string,
    data: Record<string, any>
  ): Promise<void> {
    await this.prisma.analyticsEvent.create({
      data: {
        name: eventName,
        data,
        timestamp: new Date()
      }
    });
  }

  async generateReport(
    reportType: 'sales' | 'customers' | 'inventory',
    timeRange: TimeRange,
    options: {
      format?: 'json' | 'csv' | 'pdf';
      filters?: Record<string, any>;
    } = {}
  ): Promise<any> {
    let data;

    switch (reportType) {
      case 'sales':
        data = await this.getSalesMetrics(timeRange, options.filters);
        break;
      case 'customers':
        data = await this.getCustomerMetrics(timeRange);
        break;
      case 'inventory':
        data = await this.getInventoryMetrics();
        break;
      default:
        throw new Error('Unsupported report type');
    }

    // Store report generation
    await this.prisma.report.create({
      data: {
        type: reportType,
        parameters: {
          timeRange,
          options
        },
        data,
        createdAt: new Date()
      }
    });

    return this.formatReport(data, options.format || 'json');
  }

  private calculateSalesByDay(
    orders: any[],
    start: Date,
    end: Date
  ): Array<{ date: string; sales: Decimal; orders: number }> {
    const salesByDay = new Map<string, { sales: Decimal; orders: number }>();
    
    let current = startOfDay(start);
    while (current <= end) {
      salesByDay.set(format(current, 'yyyy-MM-dd'), {
        sales: new Decimal(0),
        orders: 0
      });
      current = new Date(current.setDate(current.getDate() + 1));
    }

    orders.forEach(order => {
      const day = format(order.createdAt, 'yyyy-MM-dd');
      const existing = salesByDay.get(day) || { sales: new Decimal(0), orders: 0 };
      
      salesByDay.set(day, {
        sales: existing.sales.add(order.total),
        orders: existing.orders + 1
      });
    });

    return Array.from(salesByDay.entries()).map(([date, data]) => ({
      date,
      ...data
    }));
  }

  private async calculateCustomerLifetimeValue(): Promise<Decimal> {
    const result = await this.prisma.customer.aggregate({
      _avg: {
        lifetimeValue: true
      }
    });

    return new Decimal(result._avg.lifetimeValue || 0);
  }

  private calculateInventoryTurnoverRate(products: any[]): number {
    const totalCostOfGoodsSold = products.reduce(
      (sum, p) => sum + (
        p.orderItems.reduce(
          (itemSum: number, item: any) => itemSum + item.quantity,
          0
        ) * p.cost.toNumber()
      ),
      0
    );

    const averageInventoryValue = products.reduce(
      (sum, p) => sum + (p.inventory?.quantity || 0) * p.cost.toNumber(),
      0
    ) / products.length;

    return averageInventoryValue > 0
      ? totalCostOfGoodsSold / averageInventoryValue
      : 0;
  }

  private getTopSellingItems(products: any[]): InventoryMetrics['topSellingItems'] {
    return products
      .map(p => ({
        productId: p.id,
        name: p.name,
        soldQuantity: p.orderItems.reduce(
          (sum: number, item: any) => sum + item.quantity,
          0
        ),
        revenue: p.orderItems.reduce(
          (sum: Decimal, item: any) => sum.add(item.total),
          new Decimal(0)
        )
      }))
      .sort((a, b) => b.soldQuantity - a.soldQuantity)
      .slice(0, 10);
  }

  private formatReport(
    data: any,
    format: 'json' | 'csv' | 'pdf'
  ): any {
    switch (format) {
      case 'json':
        return data;
      case 'csv':
        // Implement CSV formatting
        return this.convertToCSV(data);
      case 'pdf':
        // Implement PDF formatting
        return this.convertToPDF(data);
      default:
        return data;
    }
  }

  private convertToCSV(data: any): string {
    // Implement CSV conversion
    return '';
  }

  private convertToPDF(data: any): Buffer {
    // Implement PDF conversion
    return Buffer.from('');
  }
} 