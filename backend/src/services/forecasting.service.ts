import { BaseService } from './base.service';
import { Decimal } from '@prisma/client/runtime';
import { subDays, addDays, startOfDay, endOfDay } from 'date-fns';

interface Forecast {
  date: Date;
  value: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
}

interface SeasonalityPattern {
  daily?: number[];
  weekly?: number[];
  monthly?: number[];
}

interface TrendAnalysis {
  slope: number;
  intercept: number;
  r2: number;
}

export class ForecastingService extends BaseService {
  private readonly defaultForecastDays = 30;
  private readonly confidenceLevel = 0.95;

  async predictSales(
    options: {
      productId?: string;
      categoryId?: string;
      days?: number;
      includeSeasonality?: boolean;
    } = {}
  ): Promise<Forecast[]> {
    const days = options.days || this.defaultForecastDays;
    const historicalData = await this.getHistoricalSales(options);
    
    // Calculate seasonality if requested
    const seasonality = options.includeSeasonality
      ? await this.calculateSeasonality(historicalData)
      : undefined;

    // Calculate trend
    const trend = this.calculateTrend(historicalData);

    // Generate forecasts
    return this.generateForecasts(trend, seasonality, days);
  }

  async predictInventory(
    productId: string,
    options: {
      days?: number;
      considerLeadTime?: boolean;
    } = {}
  ): Promise<Array<{
    date: Date;
    predictedStock: number;
    reorderPoint?: number;
    recommendation?: 'reorder' | 'ok' | 'overstocked';
  }>> {
    const days = options.days || this.defaultForecastDays;

    // Get current inventory level
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        inventory: true
      }
    });

    if (!product) {
      throw new Error('Product not found');
    }

    // Get historical sales data
    const salesForecast = await this.predictSales({
      productId,
      days,
      includeSeasonality: true
    });

    // Calculate safety stock and reorder point if lead time is considered
    const safetyStock = options.considerLeadTime
      ? await this.calculateSafetyStock(productId)
      : 0;

    const reorderPoint = options.considerLeadTime
      ? await this.calculateReorderPoint(productId, safetyStock)
      : 0;

    // Generate inventory predictions
    let currentStock = product.inventory?.quantity || 0;
    
    return salesForecast.map(forecast => {
      currentStock -= forecast.value;

      return {
        date: forecast.date,
        predictedStock: Math.max(0, currentStock),
        reorderPoint: options.considerLeadTime ? reorderPoint : undefined,
        recommendation: this.getInventoryRecommendation(
          currentStock,
          reorderPoint,
          safetyStock
        )
      };
    });
  }

  async predictDemand(
    productId: string,
    options: {
      days?: number;
      considerPromotions?: boolean;
      considerSeasonality?: boolean;
    } = {}
  ): Promise<Array<{
    date: Date;
    demand: number;
    factors: {
      baseline: number;
      seasonal?: number;
      promotional?: number;
    };
  }>> {
    const days = options.days || this.defaultForecastDays;

    // Get historical demand data
    const historicalDemand = await this.getHistoricalDemand(productId);

    // Calculate baseline demand using time series analysis
    const baseline = this.calculateBaselineDemand(historicalDemand);

    // Calculate seasonality factors if requested
    const seasonality = options.considerSeasonality
      ? await this.calculateSeasonality(historicalDemand)
      : undefined;

    // Get promotional impact if requested
    const promotionalImpact = options.considerPromotions
      ? await this.calculatePromotionalImpact(productId)
      : undefined;

    // Generate demand forecasts
    return this.generateDemandForecasts(
      baseline,
      seasonality,
      promotionalImpact,
      days
    );
  }

  async getSeasonalTrends(): Promise<{
    daily: SeasonalityPattern;
    weekly: SeasonalityPattern;
    monthly: SeasonalityPattern;
  }> {
    // Get historical sales data
    const historicalSales = await this.prisma.order.findMany({
      where: {
        status: 'completed',
        createdAt: {
          gte: subDays(new Date(), 365) // Last year
        }
      },
      include: {
        items: true
      }
    });

    // Calculate daily patterns
    const dailyPattern = this.calculateDailyPattern(historicalSales);

    // Calculate weekly patterns
    const weeklyPattern = this.calculateWeeklyPattern(historicalSales);

    // Calculate monthly patterns
    const monthlyPattern = this.calculateMonthlyPattern(historicalSales);

    return {
      daily: dailyPattern,
      weekly: weeklyPattern,
      monthly: monthlyPattern
    };
  }

  private async getHistoricalSales(
    options: {
      productId?: string;
      categoryId?: string;
    }
  ): Promise<Array<{ date: Date; value: number }>> {
    const orders = await this.prisma.order.findMany({
      where: {
        status: 'completed',
        createdAt: {
          gte: subDays(new Date(), 365)
        },
        items: options.productId ? {
          some: {
            productId: options.productId
          }
        } : options.categoryId ? {
          some: {
            product: {
              categoryId: options.categoryId
            }
          }
        } : undefined
      },
      include: {
        items: true
      }
    });

    // Group sales by day
    const salesByDay = new Map<string, number>();

    orders.forEach(order => {
      const day = startOfDay(order.createdAt).toISOString();
      const sales = options.productId
        ? order.items
            .filter(item => item.productId === options.productId)
            .reduce((sum, item) => sum + item.quantity, 0)
        : options.categoryId
        ? order.items
            .filter(item => item.product.categoryId === options.categoryId)
            .reduce((sum, item) => sum + item.quantity, 0)
        : order.items.reduce((sum, item) => sum + item.quantity, 0);

      salesByDay.set(
        day,
        (salesByDay.get(day) || 0) + sales
      );
    });

    return Array.from(salesByDay.entries())
      .map(([date, value]) => ({
        date: new Date(date),
        value
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  private calculateTrend(
    data: Array<{ date: Date; value: number }>
  ): TrendAnalysis {
    const n = data.length;
    if (n < 2) return { slope: 0, intercept: 0, r2: 0 };

    const x = data.map(d => d.date.getTime());
    const y = data.map(d => d.value);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const totalSS = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const regressionSS = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(predicted - yMean, 2);
    }, 0);
    const r2 = regressionSS / totalSS;

    return { slope, intercept, r2 };
  }

  private async calculateSeasonality(
    data: Array<{ date: Date; value: number }>
  ): Promise<SeasonalityPattern> {
    // Calculate average value for each day of week
    const byDayOfWeek = new Array(7).fill(0).map(() => ({
      sum: 0,
      count: 0
    }));

    data.forEach(({ date, value }) => {
      const dayOfWeek = date.getDay();
      byDayOfWeek[dayOfWeek].sum += value;
      byDayOfWeek[dayOfWeek].count++;
    });

    const dailyFactors = byDayOfWeek.map(({ sum, count }) =>
      count > 0 ? sum / count : 1
    );

    // Normalize factors
    const avgFactor = dailyFactors.reduce((a, b) => a + b, 0) / 7;
    const normalizedFactors = dailyFactors.map(f => f / avgFactor);

    return {
      daily: normalizedFactors
    };
  }

  private generateForecasts(
    trend: TrendAnalysis,
    seasonality: SeasonalityPattern | undefined,
    days: number
  ): Forecast[] {
    const forecasts: Forecast[] = [];
    const startDate = new Date();

    for (let i = 0; i < days; i++) {
      const forecastDate = addDays(startDate, i);
      const timeValue = forecastDate.getTime();

      // Calculate trend component
      let forecast = trend.slope * timeValue + trend.intercept;

      // Apply seasonality if available
      if (seasonality?.daily) {
        const dayOfWeek = forecastDate.getDay();
        forecast *= seasonality.daily[dayOfWeek];
      }

      // Calculate confidence interval
      const confidenceInterval = this.calculateConfidenceInterval(
        forecast,
        trend.r2
      );

      forecasts.push({
        date: forecastDate,
        value: Math.max(0, Math.round(forecast)),
        confidenceInterval
      });
    }

    return forecasts;
  }

  private calculateConfidenceInterval(
    forecast: number,
    r2: number
  ): { lower: number; upper: number } {
    const error = 1 - r2;
    const margin = forecast * error * (1 - this.confidenceLevel);

    return {
      lower: Math.max(0, Math.round(forecast - margin)),
      upper: Math.round(forecast + margin)
    };
  }

  private async calculateSafetyStock(
    productId: string
  ): Promise<number> {
    // Get historical demand variability
    const demandData = await this.getHistoricalDemand(productId);
    const standardDeviation = this.calculateStandardDeviation(
      demandData.map(d => d.value)
    );

    // Get lead time from product settings or default
    const product = await this.prisma.product.findUnique({
      where: { id: productId }
    });

    const leadTime = product?.leadTime || 7; // Default 7 days
    const serviceLevel = 0.95; // 95% service level
    const z = 1.645; // Z-score for 95% service level

    return Math.ceil(z * standardDeviation * Math.sqrt(leadTime));
  }

  private async calculateReorderPoint(
    productId: string,
    safetyStock: number
  ): Promise<number> {
    // Get average daily demand
    const demandData = await this.getHistoricalDemand(productId);
    const avgDailyDemand = demandData.reduce(
      (sum, d) => sum + d.value,
      0
    ) / demandData.length;

    // Get lead time
    const product = await this.prisma.product.findUnique({
      where: { id: productId }
    });

    const leadTime = product?.leadTime || 7;

    return Math.ceil(avgDailyDemand * leadTime + safetyStock);
  }

  private getInventoryRecommendation(
    currentStock: number,
    reorderPoint: number,
    safetyStock: number
  ): 'reorder' | 'ok' | 'overstocked' {
    if (currentStock <= reorderPoint) {
      return 'reorder';
    }

    if (currentStock > reorderPoint * 2) {
      return 'overstocked';
    }

    return 'ok';
  }

  private calculateStandardDeviation(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(x => Math.pow(x - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(variance);
  }

  private async getHistoricalDemand(
    productId: string
  ): Promise<Array<{ date: Date; value: number }>> {
    // Similar to getHistoricalSales but includes unfulfilled demand
    // (e.g., out-of-stock situations)
    return this.getHistoricalSales({ productId });
  }

  private calculateBaselineDemand(
    historicalDemand: Array<{ date: Date; value: number }>
  ): TrendAnalysis {
    return this.calculateTrend(historicalDemand);
  }

  private async calculatePromotionalImpact(
    productId: string
  ): Promise<number> {
    // Calculate average lift during promotional periods
    const promotionalPeriods = await this.prisma.promotion.findMany({
      where: {
        rules: {
          path: ['applicableTo', 'products'],
          array_contains: [productId]
        },
        startDate: {
          gte: subDays(new Date(), 365)
        }
      },
      include: {
        usage: true
      }
    });

    if (promotionalPeriods.length === 0) {
      return 1;
    }

    // Calculate average lift
    const lifts = await Promise.all(
      promotionalPeriods.map(async promotion => {
        const normalSales = await this.getAverageDailySales(
          productId,
          promotion.startDate,
          promotion.endDate || new Date(),
          false
        );

        const promotionalSales = await this.getAverageDailySales(
          productId,
          promotion.startDate,
          promotion.endDate || new Date(),
          true
        );

        return promotionalSales / normalSales;
      })
    );

    return lifts.reduce((a, b) => a + b, 0) / lifts.length;
  }

  private async getAverageDailySales(
    productId: string,
    start: Date,
    end: Date,
    duringPromotion: boolean
  ): Promise<number> {
    const sales = await this.prisma.orderItem.aggregate({
      where: {
        productId,
        order: {
          createdAt: {
            gte: start,
            lte: end
          },
          promotions: duringPromotion ? {
            some: {}
          } : {
            none: {}
          }
        }
      },
      _avg: {
        quantity: true
      }
    });

    return sales._avg.quantity || 0;
  }

  private generateDemandForecasts(
    baseline: TrendAnalysis,
    seasonality: SeasonalityPattern | undefined,
    promotionalImpact: number | undefined,
    days: number
  ): Array<{
    date: Date;
    demand: number;
    factors: {
      baseline: number;
      seasonal?: number;
      promotional?: number;
    };
  }> {
    const forecasts = [];
    const startDate = new Date();

    for (let i = 0; i < days; i++) {
      const forecastDate = addDays(startDate, i);
      const timeValue = forecastDate.getTime();

      // Calculate baseline demand
      const baselineDemand = baseline.slope * timeValue + baseline.intercept;

      // Calculate seasonal factor
      let seasonalFactor = 1;
      if (seasonality?.daily) {
        const dayOfWeek = forecastDate.getDay();
        seasonalFactor = seasonality.daily[dayOfWeek];
      }

      // Apply factors
      const demand = Math.max(0, Math.round(
        baselineDemand * seasonalFactor * (promotionalImpact || 1)
      ));

      forecasts.push({
        date: forecastDate,
        demand,
        factors: {
          baseline: baselineDemand,
          seasonal: seasonalFactor,
          promotional: promotionalImpact
        }
      });
    }

    return forecasts;
  }

  private calculateDailyPattern(orders: any[]): SeasonalityPattern['daily'] {
    const dailyPattern = new Array(7).fill(0);
    const totalSales = orders.reduce((sum, order) => sum + order.total, 0);

    orders.forEach(order => {
      const dayOfWeek = order.createdAt.getDay();
      dailyPattern[dayOfWeek] += order.total;
    });

    return dailyPattern.map(sales => sales / totalSales);
  }

  private calculateWeeklyPattern(orders: any[]): SeasonalityPattern['weekly'] {
    const weeklyPattern = new Array(52).fill(0);
    const totalSales = orders.reduce((sum, order) => sum + order.total, 0);

    orders.forEach(order => {
      const weekOfYear = Math.floor((order.createdAt.getTime() - new Date(order.createdAt.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
      weeklyPattern[weekOfYear] += order.total;
    });

    return weeklyPattern.map(sales => sales / totalSales);
  }

  private calculateMonthlyPattern(orders: any[]): SeasonalityPattern['monthly'] {
    const monthlyPattern = new Array(12).fill(0);
    const totalSales = orders.reduce((sum, order) => sum + order.total, 0);

    orders.forEach(order => {
      const month = order.createdAt.getMonth();
      monthlyPattern[month] += order.total;
    });

    return monthlyPattern.map(sales => sales / totalSales);
  }
}

  
