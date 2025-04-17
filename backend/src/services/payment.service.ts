import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import Stripe from 'stripe';
import { PayPalClient } from '@paypal/checkout-server-sdk';
import { DateTime } from 'luxon';

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account' | 'paypal';
  provider: string;
  token: string;
  customerId: string;
  metadata?: Record<string, any>;
  isDefault?: boolean;
}

interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  customerId: string;
  paymentMethodId?: string;
  status: string;
  metadata?: Record<string, any>;
}

interface RefundOptions {
  amount?: number;
  reason?: string;
  metadata?: Record<string, any>;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: 'day' | 'week' | 'month' | 'year';
  intervalCount: number;
  metadata?: Record<string, any>;
}

interface Subscription {
  id: string;
  customerId: string;
  planId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  metadata?: Record<string, any>;
}

interface PaymentAnalytics {
  totalRevenue: number;
  successfulPayments: number;
  failedPayments: number;
  refundedAmount: number;
  averageTransactionValue: number;
  paymentMethodDistribution: Record<string, number>;
}

export class PaymentService extends BaseService {
  private stripe: Stripe;
  private paypal: PayPalClient;

  constructor(deps: any) {
    super(deps);
    
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2023-10-16'
    });

    this.initializePayPal();
  }

  async createPaymentMethod(
    customerId: string,
    data: {
      type: 'card' | 'bank_account' | 'paypal';
      token: string;
      isDefault?: boolean;
      metadata?: Record<string, any>;
    }
  ): Promise<PaymentMethod> {
    try {
      let providerPaymentMethod;

      switch (data.type) {
        case 'card':
        case 'bank_account':
          providerPaymentMethod = await this.stripe.paymentMethods.create({
            type: data.type,
            [data.type]: { token: data.token },
            metadata: data.metadata
          });
          
          await this.stripe.paymentMethods.attach(
            providerPaymentMethod.id,
            { customer: await this.getStripeCustomerId(customerId) }
          );
          break;

        case 'paypal':
          // Store PayPal billing agreement token
          providerPaymentMethod = {
            id: data.token,
            type: 'paypal'
          };
          break;
      }

      const paymentMethod = await this.prisma.paymentMethod.create({
        data: {
          type: data.type,
          provider: data.type === 'paypal' ? 'paypal' : 'stripe',
          token: providerPaymentMethod.id,
          customerId,
          isDefault: data.isDefault,
          metadata: data.metadata
        }
      });

      if (data.isDefault) {
        await this.setDefaultPaymentMethod(customerId, paymentMethod.id);
      }

      return paymentMethod;
    } catch (error) {
      this.logger.error('Create payment method error:', error);
      throw error;
    }
  }

  async createPaymentIntent(
    data: {
      amount: number;
      currency: string;
      customerId: string;
      paymentMethodId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<PaymentIntent> {
    try {
      const customer = await this.prisma.customer.findUnique({
        where: { id: data.customerId },
        include: {
          paymentMethods: {
            where: { isDefault: true }
          }
        }
      });

      if (!customer) {
        throw new ValidationError('Customer not found');
      }

      const paymentMethodId = data.paymentMethodId || 
        customer.paymentMethods[0]?.id;

      if (!paymentMethodId) {
        throw new ValidationError('No payment method available');
      }

      const paymentMethod = await this.prisma.paymentMethod.findUnique({
        where: { id: paymentMethodId }
      });

      if (!paymentMethod) {
        throw new ValidationError('Payment method not found');
      }

      let intent;

      switch (paymentMethod.provider) {
        case 'stripe':
          intent = await this.createStripePaymentIntent(
            data,
            paymentMethod.token
          );
          break;

        case 'paypal':
          intent = await this.createPayPalOrder(
            data,
            paymentMethod.token
          );
          break;

        default:
          throw new ValidationError(
            `Unsupported payment provider: ${paymentMethod.provider}`
          );
      }

      return this.prisma.paymentIntent.create({
        data: {
          amount: data.amount,
          currency: data.currency,
          customerId: data.customerId,
          paymentMethodId,
          provider: paymentMethod.provider,
          providerIntentId: intent.id,
          status: intent.status,
          metadata: data.metadata
        }
      });
    } catch (error) {
      this.logger.error('Create payment intent error:', error);
      throw error;
    }
  }

  async confirmPayment(
    paymentIntentId: string
  ): Promise<PaymentIntent> {
    try {
      const intent = await this.prisma.paymentIntent.findUnique({
        where: { id: paymentIntentId },
        include: {
          paymentMethod: true
        }
      });

      if (!intent) {
        throw new ValidationError('Payment intent not found');
      }

      let confirmedIntent;

      switch (intent.provider) {
        case 'stripe':
          confirmedIntent = await this.stripe.paymentIntents.confirm(
            intent.providerIntentId
          );
          break;

        case 'paypal':
          confirmedIntent = await this.capturePayPalOrder(
            intent.providerIntentId
          );
          break;
      }

      return this.prisma.paymentIntent.update({
        where: { id: paymentIntentId },
        data: {
          status: confirmedIntent.status,
          confirmedAt: new Date()
        }
      });
    } catch (error) {
      this.logger.error('Confirm payment error:', error);
      throw error;
    }
  }

  async refundPayment(
    paymentIntentId: string,
    options: RefundOptions = {}
  ): Promise<any> {
    try {
      const intent = await this.prisma.paymentIntent.findUnique({
        where: { id: paymentIntentId }
      });

      if (!intent) {
        throw new ValidationError('Payment intent not found');
      }

      let refund;

      switch (intent.provider) {
        case 'stripe':
          refund = await this.stripe.refunds.create({
            payment_intent: intent.providerIntentId,
            amount: options.amount,
            reason: options.reason as Stripe.RefundCreateParams.Reason,
            metadata: options.metadata
          });
          break;

        case 'paypal':
          refund = await this.refundPayPalOrder(
            intent.providerIntentId,
            options
          );
          break;
      }

      return this.prisma.refund.create({
        data: {
          paymentIntentId,
          amount: options.amount || intent.amount,
          reason: options.reason,
          status: refund.status,
          providerRefundId: refund.id,
          metadata: options.metadata
        }
      });
    } catch (error) {
      this.logger.error('Refund payment error:', error);
      throw error;
    }
  }

  async getPaymentMethods(
    customerId: string
  ): Promise<PaymentMethod[]> {
    return this.prisma.paymentMethod.findMany({
      where: { customerId }
    });
  }

  async deletePaymentMethod(
    paymentMethodId: string
  ): Promise<void> {
    const paymentMethod = await this.prisma.paymentMethod.findUnique({
      where: { id: paymentMethodId }
    });

    if (!paymentMethod) {
      throw new ValidationError('Payment method not found');
    }

    if (paymentMethod.provider === 'stripe') {
      await this.stripe.paymentMethods.detach(paymentMethod.token);
    }

    await this.prisma.paymentMethod.delete({
      where: { id: paymentMethodId }
    });
  }

  private async initializePayPal(): Promise<void> {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const environment = process.env.NODE_ENV === 'production'
      ? new PayPalClient.LiveEnvironment(clientId, clientSecret)
      : new PayPalClient.SandboxEnvironment(clientId, clientSecret);

    this.paypal = new PayPalClient(environment);
  }

  private async getStripeCustomerId(
    customerId: string
  ): Promise<string> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer?.stripeCustomerId) {
      const stripeCustomer = await this.stripe.customers.create({
        metadata: { customerId }
      });

      await this.prisma.customer.update({
        where: { id: customerId },
        data: { stripeCustomerId: stripeCustomer.id }
      });

      return stripeCustomer.id;
    }

    return customer.stripeCustomerId;
  }

  private async createStripePaymentIntent(
    data: {
      amount: number;
      currency: string;
      metadata?: Record<string, any>;
    },
    paymentMethodId: string
  ): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount: data.amount,
      currency: data.currency,
      payment_method: paymentMethodId,
      confirm: false,
      metadata: data.metadata
    });
  }

  private async createPayPalOrder(
    data: {
      amount: number;
      currency: string;
      metadata?: Record<string, any>;
    },
    billingAgreementId: string
  ): Promise<any> {
    const request = new PayPalClient.orders.OrdersCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: data.currency,
          value: (data.amount / 100).toFixed(2)
        }
      }],
      payment_source: {
        token: {
          id: billingAgreementId,
          type: 'BILLING_AGREEMENT'
        }
      }
    });

    const response = await this.paypal.execute(request);
    return response.result;
  }

  private async capturePayPalOrder(orderId: string): Promise<any> {
    const request = new PayPalClient.orders.OrdersCaptureRequest(orderId);
    const response = await this.paypal.execute(request);
    return response.result;
  }

  private async refundPayPalOrder(
    orderId: string,
    options: RefundOptions
  ): Promise<any> {
    const capture = await this.getPayPalCapture(orderId);
    const request = new PayPalClient.payments.CapturesRefundRequest(capture.id);
    
    request.requestBody({
      amount: options.amount && {
        currency_code: capture.amount.currency_code,
        value: (options.amount / 100).toFixed(2)
      },
      note_to_payer: options.reason
    });

    const response = await this.paypal.execute(request);
    return response.result;
  }

  private async getPayPalCapture(orderId: string): Promise<any> {
    const request = new PayPalClient.orders.OrdersGetRequest(orderId);
    const response = await this.paypal.execute(request);
    return response.result.purchase_units[0].payments.captures[0];
  }

  private async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<void> {
    await this.prisma.paymentMethod.updateMany({
      where: {
        customerId,
        isDefault: true
      },
      data: {
        isDefault: false
      }
    });

    await this.prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { isDefault: true }
    });
  }

  async createSubscriptionPlan(
    data: Omit<SubscriptionPlan, 'id'>
  ): Promise<SubscriptionPlan> {
    try {
      let providerPlan;

      // Create plan in payment provider
      switch (data.currency === 'USD' ? 'stripe' : 'paypal') {
        case 'stripe':
          providerPlan = await this.stripe.prices.create({
            unit_amount: data.amount,
            currency: data.currency,
            recurring: {
              interval: data.interval,
              interval_count: data.intervalCount
            },
            product_data: {
              name: data.name
            },
            metadata: data.metadata
          });
          break;

        case 'paypal':
          providerPlan = await this.createPayPalPlan(data);
          break;
      }

      // Store plan in database
      return this.prisma.subscriptionPlan.create({
        data: {
          ...data,
          providerPlanId: providerPlan.id
        }
      });
    } catch (error) {
      this.logger.error('Create subscription plan error:', error);
      throw error;
    }
  }

  async createSubscription(
    data: {
      customerId: string;
      planId: string;
      paymentMethodId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<Subscription> {
    try {
      const [customer, plan] = await Promise.all([
        this.prisma.customer.findUnique({
          where: { id: data.customerId },
          include: {
            paymentMethods: {
              where: {
                OR: [
                  { id: data.paymentMethodId },
                  { isDefault: true }
                ]
              }
            }
          }
        }),
        this.prisma.subscriptionPlan.findUnique({
          where: { id: data.planId }
        })
      ]);

      if (!customer) {
        throw new ValidationError('Customer not found');
      }

      if (!plan) {
        throw new ValidationError('Plan not found');
      }

      const paymentMethod = customer.paymentMethods[0];
      if (!paymentMethod) {
        throw new ValidationError('No payment method available');
      }

      let providerSubscription;

      switch (paymentMethod.provider) {
        case 'stripe':
          providerSubscription = await this.stripe.subscriptions.create({
            customer: await this.getStripeCustomerId(data.customerId),
            items: [{ price: plan.providerPlanId }],
            payment_behavior: 'error_if_incomplete',
            payment_settings: {
              payment_method_types: ['card'],
              save_default_payment_method: 'on_subscription'
            },
            metadata: data.metadata
          });
          break;

        case 'paypal':
          providerSubscription = await this.createPayPalSubscription(
            customer,
            plan,
            paymentMethod
          );
          break;
      }

      return this.prisma.subscription.create({
        data: {
          customerId: data.customerId,
          planId: data.planId,
          paymentMethodId: paymentMethod.id,
          provider: paymentMethod.provider,
          providerSubscriptionId: providerSubscription.id,
          status: providerSubscription.status,
          currentPeriodStart: new Date(providerSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(providerSubscription.current_period_end * 1000),
          metadata: data.metadata
        }
      });
    } catch (error) {
      this.logger.error('Create subscription error:', error);
      throw error;
    }
  }

  async cancelSubscription(
    subscriptionId: string,
    options: {
      cancelAtPeriodEnd?: boolean;
      reason?: string;
    } = {}
  ): Promise<Subscription> {
    try {
      const subscription = await this.prisma.subscription.findUnique({
        where: { id: subscriptionId }
      });

      if (!subscription) {
        throw new ValidationError('Subscription not found');
      }

      switch (subscription.provider) {
        case 'stripe':
          if (options.cancelAtPeriodEnd) {
            await this.stripe.subscriptions.update(
              subscription.providerSubscriptionId,
              { cancel_at_period_end: true }
            );
          } else {
            await this.stripe.subscriptions.cancel(
              subscription.providerSubscriptionId
            );
          }
          break;

        case 'paypal':
          await this.cancelPayPalSubscription(
            subscription.providerSubscriptionId,
            options
          );
          break;
      }

      return this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: options.cancelAtPeriodEnd ? 'active' : 'canceled',
          canceledAt: new Date(),
          cancelReason: options.reason,
          cancelAtPeriodEnd: options.cancelAtPeriodEnd
        }
      });
    } catch (error) {
      this.logger.error('Cancel subscription error:', error);
      throw error;
    }
  }

  async getPaymentAnalytics(
    options: {
      startDate?: Date;
      endDate?: Date;
      customerId?: string;
      groupBy?: 'day' | 'week' | 'month';
    } = {}
  ): Promise<PaymentAnalytics> {
    const where: any = {};

    if (options.startDate || options.endDate) {
      where.createdAt = {
        ...(options.startDate && { gte: options.startDate }),
        ...(options.endDate && { lte: options.endDate })
      };
    }

    if (options.customerId) {
      where.customerId = options.customerId;
    }

    const [
      payments,
      refunds,
      paymentMethods
    ] = await Promise.all([
      this.prisma.paymentIntent.findMany({
        where: {
          ...where,
          status: 'succeeded'
        },
        select: {
          amount: true,
          paymentMethod: {
            select: { type: true }
          }
        }
      }),
      this.prisma.refund.findMany({
        where,
        select: { amount: true }
      }),
      this.prisma.paymentIntent.groupBy({
        by: ['paymentMethodId'],
        where: {
          ...where,
          status: 'succeeded'
        },
        _count: true
      })
    ]);

    const totalRevenue = payments.reduce(
      (sum, payment) => sum + payment.amount,
      0
    );

    const refundedAmount = refunds.reduce(
      (sum, refund) => sum + refund.amount,
      0
    );

    const paymentMethodDistribution = Object.fromEntries(
      paymentMethods.map(({ paymentMethodId, _count }) => [
        paymentMethodId,
        (_count / payments.length) * 100
      ])
    );

    return {
      totalRevenue,
      successfulPayments: payments.length,
      failedPayments: await this.prisma.paymentIntent.count({
        where: {
          ...where,
          status: 'failed'
        }
      }),
      refundedAmount,
      averageTransactionValue: payments.length
        ? totalRevenue / payments.length
        : 0,
      paymentMethodDistribution
    };
  }

  async createPaymentLink(
    data: {
      amount: number;
      currency: string;
      description?: string;
      metadata?: Record<string, any>;
      expiresIn?: number;
    }
  ): Promise<string> {
    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: data.currency,
            product_data: {
              name: data.description || 'Payment',
            },
            unit_amount: data.amount,
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
        expires_at: data.expiresIn
          ? Math.floor(Date.now() / 1000) + data.expiresIn
          : undefined,
        metadata: data.metadata
      });

      return session.url!;
    } catch (error) {
      this.logger.error('Create payment link error:', error);
      throw error;
    }
  }

  private async createPayPalPlan(
    data: Omit<SubscriptionPlan, 'id'>
  ): Promise<any> {
    const request = new PayPalClient.subscriptions.PlansCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      name: data.name,
      billing_cycles: [{
        frequency: {
          interval_unit: data.interval.toUpperCase(),
          interval_count: data.intervalCount
        },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 0,
        pricing_scheme: {
          fixed_price: {
            currency_code: data.currency,
            value: (data.amount / 100).toFixed(2)
          }
        }
      }],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee: {
          currency_code: data.currency,
          value: '0'
        }
      }
    });

    const response = await this.paypal.execute(request);
    return response.result;
  }

  private async createPayPalSubscription(
    customer: any,
    plan: any,
    paymentMethod: any
  ): Promise<any> {
    const request = new PayPalClient.subscriptions.SubscriptionsCreateRequest();
    request.prefer('return=representation');
    request.requestBody({
      plan_id: plan.providerPlanId,
      subscriber: {
        name: {
          given_name: customer.firstName,
          surname: customer.lastName
        },
        email_address: customer.email
      },
      application_context: {
        brand_name: process.env.COMPANY_NAME,
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        payment_method: {
          payer_selected: 'PAYPAL',
          payee_preferred: 'IMMEDIATE_PAYMENT_REQUIRED'
        }
      }
    });

    const response = await this.paypal.execute(request);
    return response.result;
  }

  private async cancelPayPalSubscription(
    subscriptionId: string,
    options: {
      reason?: string;
    }
  ): Promise<void> {
    const request = new PayPalClient.subscriptions.SubscriptionsCancelRequest(
      subscriptionId
    );
    request.requestBody({ reason: options.reason });
    await this.paypal.execute(request);
  }
} 