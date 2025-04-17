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
    prisma: PrismaClient,
    redis: Redis,
    logger: Logger
  ) {
    super({ prisma, redis, logger });
    
    this.carriers = new Map([
      ['ups', this.initializeUPS()],
      ['fedex', this.initializeFedEx()],
      ['usps', this.initializeUSPS()]
    ]);

    this.defaultCarrier = process.env.DEFAULT_SHIPPING_CARRIER || 'ups';
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
    data: {
      origin: Address;
      destination: Address;
      packages: Package[];
      carrier: string;
      service: string;
      options?: {
        insurance?: boolean;
        signature?: boolean;
        residential?: boolean;
      };
    }
  ): Promise<Shipment> {
    // Validate carrier
    if (!this.carriers.has(data.carrier)) {
      throw new ValidationError('Unsupported carrier');
    }

    try {
      // Create shipment with carrier
      const carrierResponse = await this.createCarrierShipment(
        data.carrier,
        data.origin,
        data.destination,
        data.packages,
        data.service,
        data.options
      );

      // Store shipment in database
      return this.prisma.shipment.create({
        data: {
          orderId,
          carrier: data.carrier,
          service: data.service,
          trackingNumber: carrierResponse.trackingNumber,
          status: 'pending',
          labelUrl: carrierResponse.labelUrl,
          cost: carrierResponse.cost,
          metadata: {
            carrierResponse,
            packages: data.packages,
            options: data.options
          }
        }
      });
    } catch (error) {
      this.logger.error('Shipment creation failed:', error);
      throw new Error('Failed to create shipment');
    }
  }

  async trackShipment(
    trackingNumber: string,
    carrier?: string
  ): Promise<{
    status: Shipment['status'];
    events: Array<{
      timestamp: Date;
      location: string;
      description: string;
    }>;
    estimatedDelivery?: Date;
  }> {
    const shipment = await this.prisma.shipment.findFirst({
      where: {
        trackingNumber,
        carrier: carrier
      }
    });

    if (!shipment && !carrier) {
      throw new ValidationError('Carrier must be specified for unknown tracking numbers');
    }

    const carrierToUse = carrier || shipment?.carrier;
    if (!this.carriers.has(carrierToUse)) {
      throw new ValidationError('Unsupported carrier');
    }

    try {
      const tracking = await this.trackCarrierShipment(
        carrierToUse,
        trackingNumber
      );

      // Update shipment status in database if we have a record
      if (shipment) {
        await this.prisma.shipment.update({
          where: { id: shipment.id },
          data: {
            status: tracking.status,
            metadata: {
              ...shipment.metadata,
              lastTracking: tracking
            }
          }
        });
      }

      return tracking;
    } catch (error) {
      this.logger.error('Shipment tracking failed:', error);
      throw new Error('Failed to track shipment');
    }
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
} 