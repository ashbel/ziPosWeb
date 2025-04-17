import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ValidationError } from '../utils/errors';

interface ValidationSchema {
  params?: Record<string, { type: string; required?: boolean }>;
  query?: Record<string, { type: string; required?: boolean }>;
  body?: Record<string, { type: string; required?: boolean }>;
}

export const validateRequest = (schema: ValidationSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.params) {
        const paramsSchema = z.object(
          Object.entries(schema.params).reduce((acc, [key, value]) => {
            acc[key] = value.required
              ? z[value.type]()
              : z[value.type]().optional();
            return acc;
          }, {} as Record<string, any>)
        );
        paramsSchema.parse(req.params);
      }

      if (schema.query) {
        const querySchema = z.object(
          Object.entries(schema.query).reduce((acc, [key, value]) => {
            acc[key] = value.required
              ? z[value.type]()
              : z[value.type]().optional();
            return acc;
          }, {} as Record<string, any>)
        );
        querySchema.parse(req.query);
      }

      if (schema.body) {
        const bodySchema = z.object(
          Object.entries(schema.body).reduce((acc, [key, value]) => {
            acc[key] = value.required
              ? z[value.type]()
              : z[value.type]().optional();
            return acc;
          }, {} as Record<string, any>)
        );
        bodySchema.parse(req.body);
      }

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors
        });
      } else {
        next(error);
      }
    }
  };
}; 