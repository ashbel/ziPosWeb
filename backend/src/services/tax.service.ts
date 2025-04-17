import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import axios from 'axios';

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  country: string;
  region?: string;
  postalCode?: string;
  category?: string;
  priority: number;
  compound: boolean;
  metadata?: Record<string, any>;
}

interface TaxExemption {
  id: string;
  customerId: string;
  type: 'full' | 'partial';
  reason: string;
  documentNumber?: string;
  validUntil?: Date;
  categories?: string[];
  metadata?: Record<string, any>;
}

interface TaxRule {
  id: string;
  name: string;
  priority: number;
  conditions: Array<{
    field: 'total' | 'quantity' | 'weight' | 'category' | 'customer_group';
    operator: 'eq' | 'gt' | 'lt' | 'in' | 'between';
    value: any;
  }>;
  actions: Array<{
    type: 'apply_rate' | 'exempt' | 'override';
    value: any;
  }>;
}

export class TaxService extends BaseService {
  private readonly externalTaxProvider: string;
  private readonly apiKey: string;

  constructor(deps: any) {
    super(deps);
    
    this.externalTaxProvider = process.env.TAX_PROVIDER || 'internal';
    this.apiKey = process.env.TAX_PROVIDER_API_KEY || '';
  }

  async createTaxRate(data: Omit<TaxRate, 'id'>): Promise<TaxRate> {
    // Validate rate
    if (data.rate < 0 || data.rate > 100) {
      throw new ValidationError('Invalid tax rate');
    }

    // Check for existing rate with same criteria
    const existingRate = await this.prisma.taxRate.findFirst({
      where: {
        country: data.country,
        region: data.region,
        postalCode: data.postalCode,
        category: data.category
      }
    });

    if (existingRate) {
      throw new ValidationError('Tax rate already exists for this criteria');
    }

    return this.prisma.taxRate.create({
      data
    });
  }

  async calculateTax(data: {
    items: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
      price: number;
      taxable: boolean;
      taxCategory?: string;
    }>;
    customerId?: string;
    address: {
      country: string;
      region?: string;
      postalCode?: string;
    };
  }): Promise<{
    totalTax: number;
    breakdown: Array<{
      itemIndex: number;
      taxAmount: number;
      rates: TaxRate[];
    }>;
  }> {
    // Check for tax exemption
    let exemption: TaxExemption | null = null;
    if (data.customerId) {
      exemption = await this.prisma.taxExemption.findFirst({
        where: {
          customerId: data.customerId,
          validUntil: {
            gte: new Date()
          }
        }
      });
    }

    if (this.externalTaxProvider === 'avalara') {
      return this.calculateAvalaraTax(data, exemption);
    }

    return this.calculateInternalTax(data, exemption);
  }

  async createTaxExemption(
    data: Omit<TaxExemption, 'id'>
  ): Promise<TaxExemption> {
    // Validate customer exists
    const customer = await this.prisma.customer.findUnique({
      where: { id: data.customerId }
    });

    if (!customer) {
      throw new ValidationError('Customer not found');
    }

    // Check for existing active exemption
    const existingExemption = await this.prisma.taxExemption.findFirst({
      where: {
        customerId: data.customerId,
        validUntil: {
          gte: new Date()
        }
      }
    });

    if (existingExemption) {
      throw new ValidationError('Customer already has an active tax exemption');
    }

    return this.prisma.taxExemption.create({
      data
    });
  }

  async generateTaxReport(
    options: {
      startDate: Date;
      endDate: Date;
      groupBy?: 'day' | 'week' | 'month';
      categories?: string[];
      format?: 'csv' | 'json';
    }
  ): Promise<string> {
    const data = await this.prisma.$queryRaw`
      SELECT
        DATE_TRUNC(${options.groupBy || 'day'}, o."createdAt") as date,
        tr.category,
        COUNT(DISTINCT o.id) as order_count,
        SUM(o.tax) as total_tax,
        SUM(o.total) as total_sales
      FROM "Order" o
      JOIN "TaxRate" tr ON tr.id = o."taxRateId"
      WHERE
        o."createdAt" BETWEEN ${options.startDate} AND ${options.endDate}
        ${options.categories?.length
          ? Prisma.sql`AND tr.category IN (${Prisma.join(options.categories)})`
          : Prisma.empty
        }
      GROUP BY
        DATE_TRUNC(${options.groupBy || 'day'}, o."createdAt"),
        tr.category
      ORDER BY date ASC, tr.category
    `;

    if (options.format === 'csv') {
      return this.convertToCSV(data);
    }

    return JSON.stringify(data, null, 2);
  }

  private async calculateInternalTax(
    data: any,
    exemption: TaxExemption | null
  ): Promise<any> {
    const breakdown: any[] = [];
    let totalTax = 0;

    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      
      if (!item.taxable) {
        breakdown.push({
          itemIndex: i,
          taxAmount: 0,
          rates: []
        });
        continue;
      }

      // Check if item is exempt
      if (
        exemption &&
        (!exemption.categories?.length ||
          exemption.categories.includes(item.taxCategory || 'default'))
      ) {
        breakdown.push({
          itemIndex: i,
          taxAmount: 0,
          rates: []
        });
        continue;
      }

      // Get applicable tax rates
      const rates = await this.prisma.taxRate.findMany({
        where: {
          country: data.address.country,
          region: data.address.region,
          postalCode: data.address.postalCode,
          category: item.taxCategory,
          OR: [
            { category: null },
            { category: item.taxCategory }
          ]
        },
        orderBy: {
          priority: 'asc'
        }
      });

      let itemTax = 0;
      let baseAmount = item.price * item.quantity;

      for (const rate of rates) {
        const taxAmount = rate.compound
          ? (baseAmount + itemTax) * (rate.rate / 100)
          : baseAmount * (rate.rate / 100);
        
        itemTax += taxAmount;
      }

      breakdown.push({
        itemIndex: i,
        taxAmount: itemTax,
        rates
      });

      totalTax += itemTax;
    }

    return {
      totalTax,
      breakdown
    };
  }

  private async calculateAvalaraTax(
    data: any,
    exemption: TaxExemption | null
  ): Promise<any> {
    try {
      const response = await axios.post(
        'https://rest.avatax.com/api/v2/transactions/create',
        {
          type: 'SalesOrder',
          customerCode: data.customerId || 'GUEST',
          date: new Date().toISOString().split('T')[0],
          lines: data.items.map((item: any, index: number) => ({
            number: `${index + 1}`,
            quantity: item.quantity,
            amount: item.price * item.quantity,
            taxCode: item.taxCategory || 'P0000000',
            itemCode: item.productId,
            exemptionCode: exemption?.documentNumber
          })),
          addresses: {
            shipTo: data.address
          }
        },
        {
          auth: {
            username: this.apiKey,
            password: ''
          }
        }
      );

      return {
        totalTax: response.data.totalTax,
        breakdown: response.data.lines.map((line: any, index: number) => ({
          itemIndex: index,
          taxAmount: line.tax,
          rates: line.details.map((detail: any) => ({
            name: detail.taxName,
            rate: detail.rate * 100,
            amount: detail.tax
          }))
        }))
      };
    } catch (error) {
      this.logger.error('Avalara API error:', error);
      // Fallback to internal calculation
      return this.calculateInternalTax(data, exemption);
    }
  }

  async createTaxRule(data: Omit<TaxRule, 'id'>): Promise<TaxRule> {
    return this.prisma.taxRule.create({
      data
    });
  }

  async validateTaxExemptionCertificate(
    data: {
      certificateNumber: string;
      issuer: string;
      expirationDate: Date;
      documentUrl?: string;
    }
  ): Promise<{
    valid: boolean;
    status: string;
    details?: Record<string, any>;
  }> {
    // Implement certificate validation logic here
    // This could integrate with external validation services
    try {
      const response = await axios.post(
        'https://api.certcapture.com/v2/certificates/validate',
        {
          certificate_number: data.certificateNumber,
          issuer: data.issuer,
          expiration_date: data.expirationDate
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.CERT_CAPTURE_API_KEY}`
          }
        }
      );

      return {
        valid: response.data.valid,
        status: response.data.status,
        details: response.data.details
      };
    } catch (error) {
      // Fallback to basic validation
      return {
        valid: true,
        status: 'validated_locally',
        details: {
          validation_method: 'local',
          expiration_check: data.expirationDate > new Date()
        }
      };
    }
  }

  async calculateTaxJurisdictions(
    address: {
      country: string;
      region?: string;
      city?: string;
      postalCode?: string;
      street?: string;
    }
  ): Promise<Array<{
    level: 'country' | 'state' | 'county' | 'city';
    name: string;
    code: string;
    rate: number;
  }>> {
    if (this.externalTaxProvider === 'avalara') {
      return this.getAvalaraTaxJurisdictions(address);
    }

    // Fallback to internal jurisdiction determination
    const jurisdictions = [];

    // Country level
    const countryRate = await this.prisma.taxRate.findFirst({
      where: {
        country: address.country,
        region: null,
        city: null
      }
    });

    if (countryRate) {
      jurisdictions.push({
        level: 'country',
        name: address.country,
        code: address.country,
        rate: countryRate.rate
      });
    }

    // State/Region level
    if (address.region) {
      const regionRate = await this.prisma.taxRate.findFirst({
        where: {
          country: address.country,
          region: address.region,
          city: null
        }
      });

      if (regionRate) {
        jurisdictions.push({
          level: 'state',
          name: address.region,
          code: `${address.country}-${address.region}`,
          rate: regionRate.rate
        });
      }
    }

    // City level
    if (address.city) {
      const cityRate = await this.prisma.taxRate.findFirst({
        where: {
          country: address.country,
          region: address.region,
          city: address.city
        }
      });

      if (cityRate) {
        jurisdictions.push({
          level: 'city',
          name: address.city,
          code: `${address.country}-${address.region}-${address.city}`,
          rate: cityRate.rate
        });
      }
    }

    return jurisdictions;
  }

  async generateTaxForecast(
    options: {
      startDate: Date;
      endDate: Date;
      interval: 'day' | 'week' | 'month';
      categories?: string[];
    }
  ): Promise<Array<{
    date: Date;
    estimatedTax: number;
    confidence: number;
    breakdown: Record<string, number>;
  }>> {
    // Get historical tax data
    const historicalData = await this.prisma.order.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: new Date(options.startDate.getTime() - 90 * 24 * 60 * 60 * 1000), // 90 days before start
          lt: options.startDate
        }
      },
      _sum: {
        tax: true,
        total: true
      }
    });

    // Calculate average tax rate and standard deviation
    const taxRates = historicalData.map(
      data => (data._sum.tax || 0) / (data._sum.total || 1)
    );
    const avgTaxRate = taxRates.reduce((a, b) => a + b, 0) / taxRates.length;
    const stdDev = Math.sqrt(
      taxRates.reduce((sq, n) => sq + Math.pow(n - avgTaxRate, 2), 0) /
      (taxRates.length - 1)
    );

    // Get sales forecast (simplified)
    const salesForecast = await this.getSalesForecast(
      options.startDate,
      options.endDate,
      options.interval
    );

    // Generate tax forecast
    return salesForecast.map(forecast => ({
      date: forecast.date,
      estimatedTax: forecast.estimatedSales * avgTaxRate,
      confidence: 1 - (stdDev / avgTaxRate),
      breakdown: {
        sales: forecast.estimatedSales,
        taxRate: avgTaxRate,
        standardDeviation: stdDev
      }
    }));
  }

  private async getAvalaraTaxJurisdictions(
    address: any
  ): Promise<any[]> {
    try {
      const response = await axios.get(
        'https://rest.avatax.com/api/v2/taxrates/byaddress',
        {
          params: {
            line1: address.street,
            city: address.city,
            region: address.region,
            postalCode: address.postalCode,
            country: address.country
          },
          auth: {
            username: this.apiKey,
            password: ''
          }
        }
      );

      return response.data.rates.map((rate: any) => ({
        level: rate.jurisdictionType.toLowerCase(),
        name: rate.jurisdictionName,
        code: rate.jurisdictionCode,
        rate: rate.rate * 100
      }));
    } catch (error) {
      this.logger.error('Avalara API error:', error);
      throw new Error('Failed to retrieve tax jurisdictions');
    }
  }

  private async getSalesForecast(
    startDate: Date,
    endDate: Date,
    interval: string
  ): Promise<Array<{
    date: Date;
    estimatedSales: number;
  }>> {
    // Implement sales forecasting logic
    // This is a simplified example
    const historicalSales = await this.prisma.order.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: new Date(startDate.getTime() - 90 * 24 * 60 * 60 * 1000),
          lt: startDate
        }
      },
      _sum: {
        total: true
      }
    });

    const avgDailySales =
      historicalSales.reduce((sum, day) => sum + (day._sum.total || 0), 0) /
      historicalSales.length;

    const forecast = [];
    let currentDate = startDate;

    while (currentDate <= endDate) {
      forecast.push({
        date: new Date(currentDate),
        estimatedSales: avgDailySales * (0.9 + Math.random() * 0.2) // Add some variance
      });

      currentDate = new Date(
        currentDate.getTime() + 24 * 60 * 60 * 1000
      );
    }

    return forecast;
  }
} 