import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';

interface TwoFactorSecret {
  userId: string;
  secret: string;
  backupCodes: string[];
  createdAt: Date;
  lastUsedAt?: Date;
}

interface TwoFactorSetup {
  secret: string;
  qrCode: string;
  backupCodes: string[];
  uri: string;
}

interface VerificationResult {
  success: boolean;
  method: 'totp' | 'backup' | null;
  attemptsRemaining?: number;
}

export class TwoFactorService extends BaseService {
  private readonly issuer: string;
  private readonly window: number;
  private readonly maxAttempts: number;
  private readonly backupCodesCount: number;
  private readonly backupCodeLength: number;

  constructor(deps: any) {
    super(deps);
    
    this.issuer = process.env.APP_NAME || 'MyApp';
    this.window = parseInt(process.env.TOTP_WINDOW || '1'); // Time window in steps
    this.maxAttempts = parseInt(process.env.MAX_2FA_ATTEMPTS || '3');
    this.backupCodesCount = 10;
    this.backupCodeLength = 10;

    // Configure authenticator
    authenticator.options = {
      window: this.window,
      step: 30 // 30-second step
    };
  }

  async setupTwoFactor(
    userId: string,
    email: string
  ): Promise<TwoFactorSetup> {
    // Check if 2FA is already set up
    const existing = await this.prisma.twoFactorSecret.findUnique({
      where: { userId }
    });

    if (existing) {
      throw new ValidationError('Two-factor authentication is already set up');
    }

    // Generate secret
    const secret = authenticator.generateSecret();
    
    // Generate backup codes
    const backupCodes = this.generateBackupCodes();

    // Create TOTP URI
    const uri = authenticator.keyuri(email, this.issuer, secret);

    // Generate QR code
    const qrCode = await QRCode.toDataURL(uri);

    // Store secret and backup codes
    await this.prisma.twoFactorSecret.create({
      data: {
        userId,
        secret,
        backupCodes: this.hashBackupCodes(backupCodes),
        createdAt: new Date()
      }
    });

    // Return setup data
    return {
      secret,
      qrCode,
      backupCodes,
      uri
    };
  }

  async verifyTwoFactor(
    userId: string,
    token: string
  ): Promise<VerificationResult> {
    const secret = await this.prisma.twoFactorSecret.findUnique({
      where: { userId }
    });

    if (!secret) {
      throw new ValidationError('Two-factor authentication is not set up');
    }

    // Check rate limiting
    const attempts = await this.getRemainingAttempts(userId);
    if (attempts <= 0) {
      throw new ValidationError('Too many failed attempts. Please try again later.');
    }

    try {
      // Try TOTP verification
      if (authenticator.verify({ token, secret: secret.secret })) {
        await this.clearFailedAttempts(userId);
        await this.updateLastUsed(userId);
        return { success: true, method: 'totp' };
      }

      // Try backup code
      const isValidBackup = await this.verifyBackupCode(userId, token);
      if (isValidBackup) {
        await this.clearFailedAttempts(userId);
        await this.updateLastUsed(userId);
        return { success: true, method: 'backup' };
      }

      // Verification failed
      await this.incrementFailedAttempts(userId);
      const remainingAttempts = await this.getRemainingAttempts(userId);

      return {
        success: false,
        method: null,
        attemptsRemaining: remainingAttempts
      };
    } catch (error) {
      await this.incrementFailedAttempts(userId);
      throw error;
    }
  }

  async disableTwoFactor(
    userId: string,
    token: string
  ): Promise<boolean> {
    // Verify token before disabling
    const verification = await this.verifyTwoFactor(userId, token);
    if (!verification.success) {
      return false;
    }

    // Remove 2FA data
    await this.prisma.twoFactorSecret.delete({
      where: { userId }
    });

    // Clear any rate limiting data
    await this.clearFailedAttempts(userId);

    return true;
  }

  async generateNewBackupCodes(
    userId: string,
    token: string
  ): Promise<string[]> {
    // Verify token before generating new codes
    const verification = await this.verifyTwoFactor(userId, token);
    if (!verification.success) {
      throw new ValidationError('Invalid verification token');
    }

    // Generate new backup codes
    const newBackupCodes = this.generateBackupCodes();

    // Update stored backup codes
    await this.prisma.twoFactorSecret.update({
      where: { userId },
      data: {
        backupCodes: this.hashBackupCodes(newBackupCodes)
      }
    });

    return newBackupCodes;
  }

  async isTwoFactorEnabled(userId: string): Promise<boolean> {
    const secret = await this.prisma.twoFactorSecret.findUnique({
      where: { userId }
    });
    return !!secret;
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < this.backupCodesCount; i++) {
      codes.push(crypto.randomBytes(this.backupCodeLength / 2)
        .toString('hex')
        .toUpperCase());
    }
    return codes;
  }

  private hashBackupCodes(codes: string[]): string[] {
    return codes.map(code =>
      crypto.createHash('sha256')
        .update(code)
        .digest('hex')
    );
  }

  private async verifyBackupCode(
    userId: string,
    code: string
  ): Promise<boolean> {
    const secret = await this.prisma.twoFactorSecret.findUnique({
      where: { userId }
    });

    if (!secret) {
      return false;
    }

    const hashedCode = crypto.createHash('sha256')
      .update(code)
      .digest('hex');

    const index = secret.backupCodes.indexOf(hashedCode);
    if (index === -1) {
      return false;
    }

    // Remove used backup code
    const updatedCodes = [...secret.backupCodes];
    updatedCodes.splice(index, 1);

    await this.prisma.twoFactorSecret.update({
      where: { userId },
      data: {
        backupCodes: updatedCodes
      }
    });

    return true;
  }

  private async getRemainingAttempts(userId: string): Promise<number> {
    const key = `2fa:attempts:${userId}`;
    const attempts = await this.redis.get(key);
    return this.maxAttempts - (attempts ? parseInt(attempts) : 0);
  }

  private async incrementFailedAttempts(userId: string): Promise<void> {
    const key = `2fa:attempts:${userId}`;
    await this.redis.incr(key);
    await this.redis.expire(key, 3600); // Reset after 1 hour
  }

  private async clearFailedAttempts(userId: string): Promise<void> {
    const key = `2fa:attempts:${userId}`;
    await this.redis.del(key);
  }

  private async updateLastUsed(userId: string): Promise<void> {
    await this.prisma.twoFactorSecret.update({
      where: { userId },
      data: {
        lastUsedAt: new Date()
      }
    });
  }
} 