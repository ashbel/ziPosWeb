import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { Stripe } from 'stripe';
import { PayPalClient } from '@paypal/checkout-server-sdk';
import { Decimal } from '@prisma/client/runtime';

type PaymentProvider = 'stripe' | 'paypal' | 'square';
type PaymentMethod = 'credit_card' | 'debit_card' | 'paypal' | 'bank_transfer';
type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';

interface PaymentIntent {
  id: string;
  amount: Decimal;
  currency: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  provider: PaymentProvider;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

interface RefundOptions {
  amount?: Decimal;
  reason?: string;
  metadata?: Record<string, any>;
}

export class PaymentGatewayService extends BaseService {
  private readonly stripe: Stripe;
  private readonly paypal: PayPalClient;
  private readonly supportedCurrencies: Set<string>;

  constructor(deps: any) {
    super(deps);
    
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16'
    });

    this.paypal = this.initializePayPal();

    this.supportedCurrencies = new Set(['USD', 'EUR', 'GBP', 'CAD', 'AUD']);
  }

  async createPaymentIntent(
    data: {
      amount: Decimal;
      currency: string;
      paymentMethod: PaymentMethod;
      provider: PaymentProvider;
      customerId?: string;
      orderId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<PaymentIntent> {
    // Validate currency
    if (!this.supportedCurrencies.has(data.currency.toUpperCase())) {
      throw new ValidationError('Unsupported currency');
    }

    // Convert amount to smallest currency unit
    const amount = this.convertToSmallestUnit(data.amount, data.currency);

    try {
      let paymentIntent;

      switch (data.provider) {
        case 'stripe':
          paymentIntent = await this.createStripePaymentIntent(data, amount);
          break;

        case 'paypal':
          paymentIntent = await this.createPayPalOrder(data, amount);
          break;

        default:
          throw new ValidationError('Unsupported payment provider');
      }

      // Store payment intent in database
      return this.prisma.paymentIntent.create({
        data: {
          id: paymentIntent.id,
          amount: data.amount,
          currency: data.currency,
          status: 'pending',
          paymentMethod: data.paymentMethod,
          provider: data.provider,
          customerId: data.customerId,
          orderId: data.orderId,
          metadata: {
            ...data.metadata,
            providerResponse: paymentIntent
          }
        }
      });
    } catch (error) {
      this.logger.error('Payment intent creation failed:', error);
      throw new Error('Failed to create payment intent');
    }
  }

  async processPayment(
    paymentIntentId: string,
    data: {
      paymentMethodId?: string;
      paypalOrderId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<PaymentIntent> {
    const paymentIntent = await this.prisma.paymentIntent.findUnique({
      where: { id: paymentIntentId }
    });

    if (!paymentIntent) {
      throw new ValidationError('Payment intent not found');
    }

    try {
      let result;

      switch (paymentIntent.provider) {
        case 'stripe':
          result = await this.processStripePayment(paymentIntent, data.paymentMethodId!);
          break;

        case 'paypal':
          result = await this.processPayPalPayment(paymentIntent, data.paypalOrderId!);
          break;

        default:
          throw new ValidationError('Unsupported payment provider');
      }

      // Update payment intent status
      return this.prisma.paymentIntent.update({
        where: { id: paymentIntentId },
        data: {
          status: 'completed',
          metadata: {
            ...paymentIntent.metadata,
            ...data.metadata,
            processingResult: result
          },
          updatedAt: new Date()
        }
      });
    } catch (error) {
      // Update payment intent status to failed
      await this.prisma.paymentIntent.update({
        where: { id: paymentIntentId },
        data: {
          status: 'failed',
          metadata: {
            ...paymentIntent.metadata,
            error: error.message
          },
          updatedAt: new Date()
        }
      });

      throw error;
    }
  }

  async refundPayment(
    paymentIntentId: string,
    options: RefundOptions = {}
  ): Promise<PaymentIntent> {
    const paymentIntent = await this.prisma.paymentIntent.findUnique({
      where: { id: paymentIntentId }
    });

    if (!paymentIntent) {
      throw new ValidationError('Payment intent not found');
    }

    if (paymentIntent.status !== 'completed') {
      throw new ValidationError('Payment cannot be refunded');
    }

    const refundAmount = options.amount || paymentIntent.amount;
    if (refundAmount.greaterThan(paymentIntent.amount)) {
      throw new ValidationError('Refund amount cannot exceed payment amount');
    }

    try {
      let refundResult;

      switch (paymentIntent.provider) {
        case 'stripe':
          refundResult = await this.processStripeRefund(paymentIntent, refundAmount, options);
          break;

        case 'paypal':
          refundResult = await this.processPayPalRefund(paymentIntent, refundAmount, options);
          break;

        default:
          throw new ValidationError('Unsupported payment provider');
      }

      // Update payment intent status
      const newStatus = refundAmount.equals(paymentIntent.amount)
        ? 'refunded'
        : 'partially_refunded';

      return this.prisma.paymentIntent.update({
        where: { id: paymentIntentId },
        data: {
          status: newStatus,
          metadata: {
            ...paymentIntent.metadata,
            refund: {
              amount: refundAmount,
              reason: options.reason,
              ...options.metadata,
              result: refundResult
            }
          },
          updatedAt: new Date()
        }
      });
    } catch (error) {
      this.logger.error('Refund processing failed:', error);
      throw new Error('Failed to process refund');
    }
  }

  async getPaymentStatus(paymentIntentId: string): Promise<PaymentStatus> {
    const paymentIntent = await this.prisma.paymentIntent.findUnique({
      where: { id: paymentIntentId }
    });

    if (!paymentIntent) {
      throw new ValidationError('Payment intent not found');
    }

    return paymentIntent.status;
  }

  private async createStripePaymentIntent(
    data: any,
    amount: number
  ): Promise<Stripe.PaymentIntent> {
    const paymentMethodTypes = this.getStripePaymentMethodTypes(data.paymentMethod);

    return this.stripe.paymentIntents.create({
      amount,
      currency: data.currency.toLowerCase(),
      payment_method_types: paymentMethodTypes,
      metadata: data.metadata,
      customer: data.customerId ? await this.getStripeCustomerId(data.customerId) : undefined
    });
  }

  private async createPayPalOrder(
    data: any,
    amount: number
  ): Promise<any> {
    const request = new PayPalClient.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: data.currency,
          value: (amount / 100).toFixed(2)
        }
      }]
    });

    const response = await this.paypal.execute(request);
    return response.result;
  }

  private async processStripePayment(
    paymentIntent: PaymentIntent,
    paymentMethodId: string
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.confirm(paymentIntent.id, {
      payment_method: paymentMethodId
    });
  }

  private async processPayPalPayment(
    paymentIntent: PaymentIntent,
    paypalOrderId: string
  ): Promise<any> {
    const request = new PayPalClient.orders.OrdersCaptureRequest(paypalOrderId);
    const response = await this.paypal.execute(request);
    return response.result;
  }

  private async processStripeRefund(
    paymentIntent: PaymentIntent,
    amount: Decimal,
    options: RefundOptions
  ): Promise<Stripe.Refund> {
    return this.stripe.refunds.create({
      payment_intent: paymentIntent.id,
      amount: this.convertToSmallestUnit(amount, paymentIntent.currency),
      reason: this.mapRefundReason(options.reason),
      metadata: options.metadata
    });
  }

  private async processPayPalRefund(
    paymentIntent: PaymentIntent,
    amount: Decimal,
    options: RefundOptions
  ): Promise<any> {
    const captureId = paymentIntent.metadata?.providerResponse?.purchase_units[0]?.payments?.captures[0]?.id;
    if (!captureId) {
      throw new Error('PayPal capture ID not found');
    }

    const request = new PayPalClient.payments.CapturesRefundRequest(captureId);
    request.requestBody({
      amount: {
        currency_code: paymentIntent.currency,
        value: amount.toString()
      },
      note_to_payer: options.reason
    });

    const response = await this.paypal.execute(request);
    return response.result;
  }

  private convertToSmallestUnit(
    amount: Decimal,
    currency: string
  ): number {
    // Most currencies use 2 decimal places
    const decimalPlaces = currency === 'JPY' ? 0 : 2;
    return Math.round(amount.mul(Math.pow(10, decimalPlaces)).toNumber());
  }

  private getStripePaymentMethodTypes(
    method: PaymentMethod
  ): string[] {
    switch (method) {
      case 'credit_card':
      case 'debit_card':
        return ['card'];
      case 'bank_transfer':
        return ['sepa_debit', 'ach_debit'];
      default:
        return ['card'];
    }
  }

  private async getStripeCustomerId(customerId: string): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer?.stripeCustomerId) {
      // Create Stripe customer
      const stripeCustomer = await this.stripe.customers.create({
        email: customer?.email,
        metadata: {
          customerId
        }
      });

      // Update customer with Stripe ID
      await this.prisma.customer.update({
        where: { id: customerId },
        data: {
          stripeCustomerId: stripeCustomer.id
        }
      });

      return stripeCustomer.id;
    }

    return customer.stripeCustomerId;
  }

  private mapRefundReason(
    reason?: string
  ): Stripe.RefundCreateParams.Reason | undefined {
    const reasonMap: Record<string, Stripe.RefundCreateParams.Reason> = {
      duplicate: 'duplicate',
      fraudulent: 'fraudulent',
      requested_by_customer: 'requested_by_customer'
    };

    return reason ? reasonMap[reason] : undefined;
  }

  private initializePayPal(): PayPalClient {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const environment = process.env.NODE_ENV === 'production'
      ? new PayPalClient.core.LiveEnvironment(clientId!, clientSecret!)
      : new PayPalClient.core.SandboxEnvironment(clientId!, clientSecret!);

    return new PayPalClient.core.PayPalHttpClient(environment);
  }
} 