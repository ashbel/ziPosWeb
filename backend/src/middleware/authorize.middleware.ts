import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';

interface User {
  id: string;
  email: string;
  permissions?: string[];
}

interface AuthRequest extends Request {
  user?: User;
}

export const authorize = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      
      if (!user) {
        throw new ValidationError('Unauthorized');
      }

      if (!user.permissions?.includes(permission)) {
        throw new ValidationError('Forbidden');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}; 