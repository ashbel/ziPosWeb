import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

const discountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
  value: z.number().min(0),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  minimumPurchase: z.number().min(0).optional(),
  maximumDiscount: z.number().min(0).optional(),
  applicableProducts: z.array(z.string().uuid()).optional(),
  applicableCategories: z.array(z.string().uuid()).optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  hoursOfDay: z.array(z.number().min(0).max(23)).optional(),
  usageLimit: z.number().min(1).optional(),
  customerGroupIds: z.array(z.string().uuid()).optional()
}).refine(
  data => {
    if (data.type === 'PERCENTAGE') {
      return data.value <= 100;
    }
    return true;
  },
  {
    message: 'Percentage discount cannot exceed 100%',
    path: ['value']
  }
).refine(
  data => new Date(data.startDate) <= new Date(data.endDate),
  {
    message: 'End date must be after start date',
    path: ['endDate']
  }
);

export const validateDiscount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await discountSchema.parseAsync(req.body);
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
}; 