import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { Decimal } from '@prisma/client/runtime';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { Logger } from '../utils/logger';

interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

interface Package {
  weight: number;
  length: number;
  width: number;
  height: number;
  value: Decimal;
  contents?: Array<{
    productId: string;
    quantity: number;
  }>;
}

interface ShippingRate {
  carrier: string;
  service: string;
  rate: Decimal;
  estimatedDays: number;
  guaranteedDelivery: boolean;
  trackingAvailable: boolean;
}

interface Shipment {
  id: string;
  orderId: string;
  carrier: string;
  service: string;
  trackingNumber: string;
  status: 'pending' | 'in_transit' | 'delivered' | 'exception';
  labelUrl?: string;
  cost: Decimal;
  createdAt: Date;
  updatedAt: Date;
}

export class ShippingService extends BaseService {
  private readonly carriers: Map<string, any>;
  private readonly defaultCarrier: string;

  constructor(
    private prisma: PrismaClient,
    private redis: Redis,
    private logger: Logger
  ) {
    super({ prisma, redis, logger });
    
    this.carriers = new Map();
    this.defaultCarrier = 'ups';
  }

  async getRates(data: {
    carrier: string;
    from: Address;
    to: Address;
    weight: number;
    dimensions: {
      length: number;
      width: number;
      height: number;
    };
  }): Promise<ShippingRate[]> {
    const packages: Package[] = [{
      weight: data.weight,
      length: data.dimensions.length,
      width: data.dimensions.width,
      height: data.dimensions.height,
      value: new Decimal(0) // Default value, can be updated based on order items
    }];

    return this.calculateRates(
      data.from,
      data.to,
      packages,
      {
        carriers: [data.carrier]
      }
    );
  }

  async calculateRates(
    origin: Address,
    destination: Address,
    packages: Package[],
    options: {
      carriers?: string[];
      service?: string;
      residential?: boolean;
      insurance?: boolean;
    } = {}
  ): Promise<ShippingRate[]> {
    // Validate addresses
    this.validateAddress(origin);
    this.validateAddress(destination);

    // Validate packages
    packages.forEach(this.validatePackage);

    const carriers = options.carriers || [this.defaultCarrier];
    const rates: ShippingRate[] = [];

    for (const carrier of carriers) {
      if (!this.carriers.has(carrier)) {
        continue;
      }

      try {
        const carrierRates = await this.getCarrierRates(
          carrier,
          origin,
          destination,
          packages,
          options
        );
        rates.push(...carrierRates);
      } catch (error) {
        this.logger.error(`Failed to get rates from ${carrier}:`, error);
      }
    }

    if (rates.length === 0) {
      throw new Error('No shipping rates available');
    }

    return rates.sort((a, b) => a.rate.comparedTo(b.rate));
  }

  async createShipment(
    orderId: string,
    carrier: string,
    origin: Address,
    destination: Address,
    weight: number,
    dimensions: { length: number; width: number; height: number },
    items: Array<{ name: string; quantity: number; value: number }>
  ): Promise<Shipment> {
    const shipment = await this.prisma.shipment.create({
      data: {
        orderId,
        carrier,
        trackingNumber: this.generateTrackingNumber(),
        status: 'created',
        origin: origin as any,
        destination: destination as any,
        weight,
        dimensions: dimensions as any,
        items: items as any,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    return shipment;
  }

  async trackShipment(
    trackingNumber: string,
    carrier: string
  ): Promise<{ status: string; location: string; timestamp: Date }> {
    // In a real implementation, this would call the carrier's API
    return {
      status: 'in_transit',
      location: 'New York, NY',
      timestamp: new Date()
    };
  }

  async validateAddress(
    address: Address
  ): Promise<{
    isValid: boolean;
    normalizedAddress?: Address;
    suggestions?: Address[];
  }> {
    try {
      // Use carrier's address validation service
      const carrier = this.carriers.get(this.defaultCarrier);
      const validation = await carrier.validateAddress(address);

      if (!validation.isValid && !validation.suggestions?.length) {
        throw new ValidationError('Invalid address');
      }

      return validation;
    } catch (error) {
      this.logger.error('Address validation failed:', error);
      throw new Error('Failed to validate address');
    }
  }

  async getShipmentLabel(
    shipmentId: string
  ): Promise<{
    url: string;
    format: string;
    expiresAt: Date;
  }> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId }
    });

    if (!shipment) {
      throw new ValidationError('Shipment not found');
    }

    if (!shipment.labelUrl) {
      throw new ValidationError('Shipping label not available');
    }

    // Check if label URL has expired
    const metadata = shipment.metadata as any;
    if (metadata.labelExpiration && new Date(metadata.labelExpiration) <= new Date()) {
      // Regenerate label
      const carrier = this.carriers.get(shipment.carrier);
      const newLabel = await carrier.regenerateLabel(shipment.trackingNumber);

      // Update shipment
      await this.prisma.shipment.update({
        where: { id: shipmentId },
        data: {
          labelUrl: newLabel.url,
          metadata: {
            ...metadata,
            labelExpiration: newLabel.expiresAt
          }
        }
      });

      return newLabel;
    }

    return {
      url: shipment.labelUrl,
      format: metadata.labelFormat || 'PDF',
      expiresAt: new Date(metadata.labelExpiration)
    };
  }

  private validatePackage(pkg: Package): void {
    if (pkg.weight <= 0) {
      throw new ValidationError('Package weight must be greater than 0');
    }

    if (pkg.length <= 0 || pkg.width <= 0 || pkg.height <= 0) {
      throw new ValidationError('Package dimensions must be greater than 0');
    }

    if (pkg.value.lessThan(0)) {
      throw new ValidationError('Package value cannot be negative');
    }
  }

  private async getCarrierRates(
    carrier: string,
    origin: Address,
    destination: Address,
    packages: Package[],
    options: any
  ): Promise<ShippingRate[]> {
    const carrierApi = this.carriers.get(carrier);
    return carrierApi.getRates(origin, destination, packages, options);
  }

  private async createCarrierShipment(
    carrier: string,
    origin: Address,
    destination: Address,
    packages: Package[],
    service: string,
    options: any
  ): Promise<{
    trackingNumber: string;
    labelUrl: string;
    cost: Decimal;
  }> {
    const carrierApi = this.carriers.get(carrier);
    return carrierApi.createShipment(origin, destination, packages, service, options);
  }

  private async trackCarrierShipment(
    carrier: string,
    trackingNumber: string
  ): Promise<{
    status: Shipment['status'];
    events: Array<{
      timestamp: Date;
      location: string;
      description: string;
    }>;
    estimatedDelivery?: Date;
  }> {
    const carrierApi = this.carriers.get(carrier);
    return carrierApi.trackShipment(trackingNumber);
  }

  private initializeUPS(): any {
    // Initialize UPS API client
    return {
      getRates: async () => {
        // Implement UPS rate calculation
      },
      createShipment: async () => {
        // Implement UPS shipment creation
      },
      trackShipment: async () => {
        // Implement UPS tracking
      },
      validateAddress: async () => {
        // Implement UPS address validation
      }
    };
  }

  private initializeFedEx(): any {
    // Initialize FedEx API client
    return {
      getRates: async () => {
        // Implement FedEx rate calculation
      },
      createShipment: async () => {
        // Implement FedEx shipment creation
      },
      trackShipment: async () => {
        // Implement FedEx tracking
      },
      validateAddress: async () => {
        // Implement FedEx address validation
      }
    };
  }

  private initializeUSPS(): any {
    // Initialize USPS API client
    return {
      getRates: async () => {
        // Implement USPS rate calculation
      },
      createShipment: async () => {
        // Implement USPS shipment creation
      },
      trackShipment: async () => {
        // Implement USPS tracking
      },
      validateAddress: async () => {
        // Implement USPS address validation
      }
    };
  }

  private generateTrackingNumber(): string {
    const prefix = 'TRK';
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${prefix}${timestamp}${random}`.toUpperCase();
  }
} 