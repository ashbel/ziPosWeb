import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { Redis } from 'ioredis';
import { hash, compare } from 'bcrypt';
import { sign, verify } from 'jsonwebtoken';
import { authenticator } from 'otplib';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import UAParser from 'ua-parser-js';

interface SecuritySettings {
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    maxAge: number;
  };
  mfa: {
    enabled: boolean;
    methods: string[];
    gracePeriod: number;
  };
  session: {
    duration: number;
    maxConcurrent: number;
    refreshTokenExpiry: number;
  };
  rateLimit: {
    enabled: boolean;
    maxAttempts: number;
    windowMs: number;
  };
}

export class SecurityService extends BaseService {
  private readonly redis: Redis;
  private readonly encryptionKey: Buffer;

  constructor(deps: any) {
    super(deps);
    
    this.redis = deps.redis;
    this.encryptionKey = Buffer.from(
      process.env.ENCRYPTION_KEY || '',
      'hex'
    );
  }

  async validatePassword(
    password: string,
    userId?: string
  ): Promise<{
    valid: boolean;
    reasons?: string[];
  }> {
    const settings = await this.getSecuritySettings();
    const reasons: string[] = [];

    if (password.length < settings.passwordPolicy.minLength) {
      reasons.push(`Password must be at least ${settings.passwordPolicy.minLength} characters`);
    }

    if (settings.passwordPolicy.requireUppercase && !/[A-Z]/.test(password)) {
      reasons.push('Password must contain uppercase letters');
    }

    if (settings.passwordPolicy.requireLowercase && !/[a-z]/.test(password)) {
      reasons.push('Password must contain lowercase letters');
    }

    if (settings.passwordPolicy.requireNumbers && !/\d/.test(password)) {
      reasons.push('Password must contain numbers');
    }

    if (settings.passwordPolicy.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
      reasons.push('Password must contain special characters');
    }

    if (userId) {
      // Check password history
      const history = await this.prisma.passwordHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5
      });

      for (const entry of history) {
        if (await compare(password, entry.password)) {
          reasons.push('Password has been used recently');
          break;
        }
      }
    }

    return {
      valid: reasons.length === 0,
      reasons: reasons.length > 0 ? reasons : undefined
    };
  }

  async setupMFA(
    userId: string,
    method: 'authenticator' | 'sms' | 'email'
  ): Promise<{
    secret?: string;
    qrCode?: string;
    recoveryCodes?: string[];
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new ValidationError('User not found');
    }

    switch (method) {
      case 'authenticator':
        const secret = authenticator.generateSecret();
        const qrCode = authenticator.keyuri(
          user.email,
          'YourApp',
          secret
        );

        await this.prisma.mfaSettings.create({
          data: {
            userId,
            method,
            secret: await this.encrypt(secret),
            enabled: false
          }
        });

        const recoveryCodes = await this.generateRecoveryCodes(userId);

        return {
          secret,
          qrCode,
          recoveryCodes
        };

      case 'sms':
        if (!user.phone) {
          throw new ValidationError('Phone number required for SMS MFA');
        }

        await this.prisma.mfaSettings.create({
          data: {
            userId,
            method,
            enabled: false
          }
        });

        return {};

      case 'email':
        await this.prisma.mfaSettings.create({
          data: {
            userId,
            method,
            enabled: false
          }
        });

        return {};

      default:
        throw new ValidationError('Unsupported MFA method');
    }
  }

  async verifyMFA(
    userId: string,
    method: string,
    code: string
  ): Promise<boolean> {
    const mfaSettings = await this.prisma.mfaSettings.findFirst({
      where: {
        userId,
        method
      }
    });

    if (!mfaSettings) {
      throw new ValidationError('MFA not set up');
    }

    switch (method) {
      case 'authenticator':
        const secret = await this.decrypt(mfaSettings.secret!);
        return authenticator.verify({
          token: code,
          secret
        });

      case 'sms':
      case 'email':
        const storedCode = await this.redis.get(
          `mfa:${method}:${userId}`
        );
        return storedCode === code;

      default:
        return false;
    }
  }

  async createSession(
    userId: string,
    deviceInfo: {
      ip: string;
      userAgent: string;
    }
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const settings = await this.getSecuritySettings();

    // Check concurrent sessions
    const activeSessions = await this.prisma.session.count({
      where: {
        userId,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (activeSessions >= settings.session.maxConcurrent) {
      // Invalidate oldest session
      const oldestSession = await this.prisma.session.findFirst({
        where: {
          userId,
          expiresAt: {
            gt: new Date()
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      if (oldestSession) {
        await this.invalidateSession(oldestSession.id);
      }
    }

    // Parse user agent
    const parser = new UAParser(deviceInfo.userAgent);
    const device = parser.getDevice();
    const browser = parser.getBrowser();
    const os = parser.getOS();

    // Create session
    const session = await this.prisma.session.create({
      data: {
        userId,
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        deviceType: device.type || 'unknown',
        deviceVendor: device.vendor,
        deviceModel: device.model,
        browser: `${browser.name} ${browser.version}`,
        os: `${os.name} ${os.version}`,
        expiresAt: new Date(
          Date.now() + settings.session.duration * 1000
        )
      }
    });

    // Generate tokens
    const accessToken = sign(
      { userId, sessionId: session.id },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' }
    );

    const refreshToken = sign(
      { userId, sessionId: session.id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: `${settings.session.refreshTokenExpiry}s` }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900 // 15 minutes in seconds
    };
  }

  async invalidateSession(
    sessionId: string
  ): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        expiresAt: new Date(),
        invalidatedAt: new Date()
      }
    });
  }

  async trackSecurityEvent(
    data: {
      userId?: string;
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      details: Record<string, any>;
      ip?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    await this.prisma.securityEvent.create({
      data: {
        ...data,
        timestamp: new Date()
      }
    });

    if (data.severity === 'high' || data.severity === 'critical') {
      await this.notifySecurityTeam(data);
    }
  }

  private async getSecuritySettings(): Promise<SecuritySettings> {
    const cached = await this.redis.get('security:settings');
    if (cached) {
      return JSON.parse(cached);
    }

    const settings = await this.prisma.securitySettings.findFirst();
    if (!settings) {
      return this.getDefaultSecuritySettings();
    }

    await this.redis.setex(
      'security:settings',
      3600,
      JSON.stringify(settings)
    );

    return settings;
  }

  private getDefaultSecuritySettings(): SecuritySettings {
    return {
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        maxAge: 90 // days
      },
      mfa: {
        enabled: false,
        methods: ['authenticator', 'sms', 'email'],
        gracePeriod: 7 // days
      },
      session: {
        duration: 3600, // 1 hour
        maxConcurrent: 5,
        refreshTokenExpiry: 604800 // 1 week
      },
      rateLimit: {
        enabled: true,
        maxAttempts: 5,
        windowMs: 900000 // 15 minutes
      }
    };
  }

  private async generateRecoveryCodes(
    userId: string,
    count = 10
  ): Promise<string[]> {
    const codes = Array.from(
      { length: count },
      () => randomBytes(5).toString('hex')
    );

    await this.prisma.recoveryCode.createMany({
      data: codes.map(code => ({
        userId,
        code: hash(code, 10),
        used: false
      }))
    });

    return codes;
  }

  private async encrypt(text: string): Promise<string> {
    const iv = randomBytes(16);
    const cipher = createCipheriv(
      'aes-256-cbc',
      this.encryptionKey,
      iv
    );
    const encrypted = Buffer.concat([
      cipher.update(text),
      cipher.final()
    ]);

    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private async decrypt(text: string): Promise<string> {
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = createDecipheriv(
      'aes-256-cbc',
      this.encryptionKey,
      iv
    );
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    return decrypted.toString();
  }

  private async notifySecurityTeam(
    event: {
      type: string;
      severity: string;
      details: Record<string, any>;
    }
  ): Promise<void> {
    // Implement security team notification
    // This could send emails, Slack messages, etc.
    this.logger.warn('Security event:', event);
  }
} 