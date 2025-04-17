import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

const productSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  barcode: z.string().min(1),
  costPrice: z.number().min(0),
  margin: z.number().min(0),
  sellingPrice: z.number().min(0),
  categoryId: z.string().uuid(),
  reorderLevel: z.number().min(0),
  stockQuantity: z.number().min(0)
});

export const validateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await productSchema.parseAsync(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid product data' });
  }
}; 