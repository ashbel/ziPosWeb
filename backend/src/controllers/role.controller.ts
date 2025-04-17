import { Request, Response } from 'express';
import { RoleService } from '../services/role.service';
import { ValidationError } from '../utils/errors';

export class RoleController {
  constructor(private roleService: RoleService) {}

  async createRole(req: Request, res: Response) {
    try {
      const role = await this.roleService.createRole(req.body);
      res.status(201).json(role);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async updateRole(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const role = await this.roleService.updateRole(id, req.body);
      res.json(role);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async deleteRole(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await this.roleService.deleteRole(id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getRole(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const role = await this.roleService.getRole(id);
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }
      res.json(role);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async listRoles(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.roleService.listRoles(page, limit);
      res.json(result);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async getAvailablePermissions(req: Request, res: Response) {
    try {
      const permissions = await this.roleService.getAvailablePermissions();
      res.json(permissions);
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
} 