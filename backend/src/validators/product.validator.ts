import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

export const ProductSchema = {
  create: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    barcode: z.string().min(1),
    costPrice: z.number().min(0),
    margin: z.number().min(0),
    sellingPrice: z.number().min(0),
    categoryId: z.string().uuid(),
    reorderLevel: z.number().min(0),
    stockQuantity: z.number().min(0)
  }),
  update: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    barcode: z.string().min(1).optional(),
    costPrice: z.number().min(0).optional(),
    margin: z.number().min(0).optional(),
    sellingPrice: z.number().min(0).optional(),
    categoryId: z.string().uuid().optional(),
    reorderLevel: z.number().min(0).optional(),
    stockQuantity: z.number().min(0).optional()
  }),
  search: z.object({
    query: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    page: z.number().min(1).optional(),
    limit: z.number().min(1).max(100).optional()
  }),
  category: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    parentId: z.string().uuid().optional()
  })
};

export const validateProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await ProductSchema.create.parseAsync(req.body);
    next();
  } catch (error) {
    res.status(400).json({ error: 'Invalid product data' });
  }
}; 