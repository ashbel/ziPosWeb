import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  roleId: z.string().uuid(),
  branchId: z.string().uuid()
});

const roleSchema = z.object({
  name: z.string().min(1),
  permissions: z.array(z.string()),
  description: z.string().optional()
});

export const validateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await userSchema.parseAsync(req.body);
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

export const validateRole = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    await roleSchema.parseAsync(req.body);
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