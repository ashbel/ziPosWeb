import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { ValidationError } from '../utils/errors';
import { authenticator } from 'otplib';
import { AuthService } from '../services/auth.service';
import { prisma } from '../utils/prisma';

export class AuthController {
  private readonly authService: AuthService;

  constructor() {
    this.authService = new AuthService(prisma);
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password, twoFactorCode } = req.body;
      const user = await this.authService.validateUser(email, password);

      if (user.twoFactorEnabled && !twoFactorCode) {
        return res.status(200).json({
          message: '2FA required',
          twoFactorRequired: true,
        });
      }

      if (user.twoFactorEnabled) {
        const isValid = authenticator.verify({
          token: twoFactorCode,
          secret: user.twoFactorSecret!,
        });

        if (!isValid) {
          throw new ValidationError('Invalid 2FA code');
        }
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      res.json({ token });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  }

  async register(req: Request, res: Response) {
    try {
      const { email, password, name } = req.body;
      const user = await this.authService.createUser(email, password, name);

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      res.status(201).json({ token });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  }

  async logout(req: Request, res: Response) {
    res.json({ message: 'Logged out successfully' });
  }

  async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      const token = await this.authService.refreshToken(refreshToken);
      res.json({ token });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  }

  async setup2FA(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const secret = authenticator.generateSecret();
      const otpauth = authenticator.keyuri(userId.toString(), 'POS System', secret);

      await this.authService.updateUser(userId, { twoFactorSecret: secret });

      res.json({
        secret,
        otpauth,
      });
    } catch (error) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  async verify2FA(req: Request, res: Response) {
    try {
      const { code } = req.body;
      const userId = req.user!.id;
      const user = await this.authService.getUserById(userId);

      if (!user.twoFactorSecret) {
        throw new ValidationError('2FA not set up');
      }

      const isValid = authenticator.verify({
        token: code,
        secret: user.twoFactorSecret,
      });

      if (!isValid) {
        throw new ValidationError('Invalid 2FA code');
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
      );

      res.json({ token });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  }

  async enable2FA(req: Request, res: Response) {
    try {
      const { code } = req.body;
      const userId = req.user!.id;
      const user = await this.authService.getUserById(userId);

      if (!user.twoFactorSecret) {
        throw new ValidationError('2FA not set up');
      }

      const isValid = authenticator.verify({
        token: code,
        secret: user.twoFactorSecret,
      });

      if (!isValid) {
        throw new ValidationError('Invalid 2FA code');
      }

      await this.authService.updateUser(userId, { twoFactorEnabled: true });
      res.json({ message: '2FA enabled successfully' });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  }

  async disable2FA(req: Request, res: Response) {
    try {
      const { code } = req.body;
      const userId = req.user!.id;
      const user = await this.authService.getUserById(userId);

      if (!user.twoFactorSecret) {
        throw new ValidationError('2FA not set up');
      }

      const isValid = authenticator.verify({
        token: code,
        secret: user.twoFactorSecret,
      });

      if (!isValid) {
        throw new ValidationError('Invalid 2FA code');
      }

      await this.authService.updateUser(userId, {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      });

      res.json({ message: '2FA disabled successfully' });
    } catch (error) {
      if (error instanceof ValidationError) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Internal server error' });
      }
    }
  }

  // OAuth methods (to be implemented)
  async googleAuth(req: Request, res: Response) {
    res.status(501).json({ message: 'Not implemented' });
  }

  async googleCallback(req: Request, res: Response) {
    res.status(501).json({ message: 'Not implemented' });
  }

  async githubAuth(req: Request, res: Response) {
    res.status(501).json({ message: 'Not implemented' });
  }

  async githubCallback(req: Request, res: Response) {
    res.status(501).json({ message: 'Not implemented' });
  }

  async facebookAuth(req: Request, res: Response) {
    res.status(501).json({ message: 'Not implemented' });
  }

  async facebookCallback(req: Request, res: Response) {
    res.status(501).json({ message: 'Not implemented' });
  }
} 