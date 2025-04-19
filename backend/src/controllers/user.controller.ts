import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { ValidationError } from '../utils/errors';
import { validateRequest } from '../middleware/validate-request';
import { UserSchema } from '../validators/user.validator';
import { autoBind } from '../utils/auto-bind';

@autoBind
export class UserController {
  constructor(private readonly userService: UserService) {}

  async getProfile(req: Request, res: Response) {
    try {
      if (!req.user?.id) {
        throw new ValidationError('User not authenticated');
      }
      const user = await this.userService.getProfile(req.user.id);
      res.json(user);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async updateProfile(req: Request, res: Response) {
    try {
      if (!req.user?.id) {
        throw new ValidationError('User not authenticated');
      }
      const { name, email } = req.body;
      const user = await this.userService.updateProfile(req.user.id, { name, email });
      res.json(user);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async changePassword(req: Request, res: Response) {
    try {
      if (!req.user?.id) {
        throw new ValidationError('User not authenticated');
      }
      const { currentPassword, newPassword } = req.body;
      await this.userService.changePassword(req.user.id, currentPassword, newPassword);
      res.status(204).send();
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async listUsers(req: Request, res: Response) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const result = await this.userService.listUsers(
        Number(page),
        Number(limit)
      );
      res.json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await this.userService.getUserById(id);
      res.json(user);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async updateUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, email, role } = req.body;
      const user = await this.userService.updateUser(id, { name, email, role });
      res.json(user);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await this.userService.deleteUser(id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
} 