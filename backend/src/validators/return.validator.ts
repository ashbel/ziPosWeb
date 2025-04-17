import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

const returnItemSchema = z.object({
  saleItemId: z.string().uuid(),
  quantity: z.number().min(1),
  reason: z.string().min(1),
  condition: z.enum(['GOOD', 'DAMAGED'])
});

const returnSchema = z.object({
  saleId: z.string().uuid(),
  items: z.array(returnItemSchema).min(1),
  refundType: z.enum(['CASH', 'STORE_CREDIT', 'ORIGINAL_PAYMENT']),
  notes: z.string().optional()
});

export const validateReturn = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await returnSchema.parseAsync(req.body);
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

const returnStatusSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED']),
  notes: z.string().optional()
});

export const validateReturnStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await returnStatusSchema.parseAsync(req.body);
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