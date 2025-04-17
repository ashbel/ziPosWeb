import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// Complex business rule validation
const businessHoursSchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  isOpen: z.boolean()
}).refine(
  data => {
    if (!data.isOpen) return true;
    const [startHour, startMinute] = data.startTime.split(':').map(Number);
    const [endHour, endMinute] = data.endTime.split(':').map(Number);
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    return end > start;
  },
  {
    message: 'End time must be after start time',
    path: ['endTime']
  }
);

const priceRuleSchema = z.object({
  productId: z.string().uuid(),
  customerGroupId: z.string().uuid().optional(),
  minimumQuantity: z.number().min(1),
  price: z.number().min(0),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  priority: z.number().min(1)
}).refine(
  data => new Date(data.startDate) <= new Date(data.endDate),
  {
    message: 'End date must be after start date',
    path: ['endDate']
  }
);

const inventoryAdjustmentSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number(),
  reason: z.string().min(1),
  reference: z.string().optional(),
  cost: z.number().optional(),
  notes: z.string().optional()
}).refine(
  data => {
    if (data.quantity === 0) {
      return false;
    }
    return true;
  },
  {
    message: 'Quantity cannot be zero',
    path: ['quantity']
  }
).refine(
  data => {
    if (data.quantity < 0 && !data.reason) {
      return false;
    }
    return true;
  },
  {
    message: 'Reason is required for negative adjustments',
    path: ['reason']
  }
);

const paymentSchema = z.object({
  amount: z.number().min(0.01),
  type: z.enum(['CASH', 'CARD', 'STORE_CREDIT']),
  reference: z.string().optional(),
  cardDetails: z.object({
    last4: z.string().length(4),
    brand: z.string(),
    expiryMonth: z.number().min(1).max(12),
    expiryYear: z.number().min(new Date().getFullYear()),
  }).optional()
}).refine(
  data => {
    if (data.type === 'CARD' && !data.cardDetails) {
      return false;
    }
    return true;
  },
  {
    message: 'Card details are required for card payments',
    path: ['cardDetails']
  }
);

export class ComplexValidator {
  static validateBusinessHours(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const businessHours = z.array(businessHoursSchema).parse(req.body);
      
      // Validate no overlapping hours
      const overlapping = businessHours.some((hour1, index1) =>
        businessHours.some((hour2, index2) =>
          index1 !== index2 &&
          hour1.dayOfWeek === hour2.dayOfWeek &&
          hour1.isOpen && hour2.isOpen &&
          this.timeRangesOverlap(
            hour1.startTime,
            hour1.endTime,
            hour2.startTime,
            hour2.endTime
          )
        )
      );

      if (overlapping) {
        return res.status(400).json({
          error: 'Business hours cannot overlap'
        });
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  }

  static validatePriceRules(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const priceRules = z.array(priceRuleSchema).parse(req.body);

      // Validate no conflicting rules
      const conflicting = priceRules.some((rule1, index1) =>
        priceRules.some((rule2, index2) =>
          index1 !== index2 &&
          rule1.productId === rule2.productId &&
          rule1.customerGroupId === rule2.customerGroupId &&
          rule1.minimumQuantity === rule2.minimumQuantity &&
          this.dateRangesOverlap(
            rule1.startDate,
            rule1.endDate,
            rule2.startDate,
            rule2.endDate
          )
        )
      );

      if (conflicting) {
        return res.status(400).json({
          error: 'Conflicting price rules detected'
        });
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  }

  private static timeRangesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    const [s1h, s1m] = start1.split(':').map(Number);
    const [e1h, e1m] = end1.split(':').map(Number);
    const [s2h, s2m] = start2.split(':').map(Number);
    const [e2h, e2m] = end2.split(':').map(Number);

    const start1Minutes = s1h * 60 + s1m;
    const end1Minutes = e1h * 60 + e1m;
    const start2Minutes = s2h * 60 + s2m;
    const end2Minutes = e2h * 60 + e2m;

    return start1Minutes < end2Minutes && start2Minutes < end1Minutes;
  }

  private static dateRangesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    const s1 = new Date(start1);
    const e1 = new Date(end1);
    const s2 = new Date(start2);
    const e2 = new Date(end2);

    return s1 <= e2 && s2 <= e1;
  }
} 