import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import crypto from 'crypto';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  hashedKey: string;
  userId: string;
  scopes: string[];
  expiresAt?: Date;
  lastUsedAt?: Date;
  createdAt: Date;
  revokedAt?: Date;
}

interface ApiKeyCreateOptions {
  name: string;
  scopes: string[];
  expiresAt?: Date;
  userId: string;
}

interface ApiKeyValidationResult {
  isValid: boolean;
  apiKey?: ApiKey;
  error?: string;
}

export class ApiKeyService extends BaseService {
  private readonly keyPrefix: string;
  private readonly defaultScopes: string[];
  private readonly availableScopes: Set<string>;

  constructor(deps: any) {
    super(deps);
    
    this.keyPrefix = 'ak_';
    this.defaultScopes = ['read'];
    this.availableScopes = new Set([
      'read',
      'write',
      'delete',
      'admin'
      // Add more scopes as needed
    ]);
  }

  async createApiKey(
    options: ApiKeyCreateOptions
  ): Promise<{ apiKey: ApiKey; plainTextKey: string }> {
    // Validate scopes
    this.validateScopes(options.scopes);

    // Generate API key
    const plainTextKey = this.generateApiKey();
    const hashedKey = this.hashApiKey(plainTextKey);

    // Create API key record
    const apiKey = await this.prisma.apiKey.create({
      data: {
        name: options.name,
        hashedKey,
        userId: options.userId,
        scopes: options.scopes,
        expiresAt: options.expiresAt,
        createdAt: new Date()
      }
    });

    // Cache API key for faster validation
    await this.cacheApiKey(hashedKey, apiKey);

    return {
      apiKey,
      plainTextKey: `${this.keyPrefix}${plainTextKey}`
    };
  }

  async validateApiKey(
    key: string
  ): Promise<ApiKeyValidationResult> {
    if (!key.startsWith(this.keyPrefix)) {
      return {
        isValid: false,
        error: 'Invalid API key format'
      };
    }

    const plainTextKey = key.slice(this.keyPrefix.length);
    const hashedKey = this.hashApiKey(plainTextKey);

    // Try cache first
    const cachedKey = await this.getCachedApiKey(hashedKey);
    if (cachedKey) {
      return this.validateApiKeyData(cachedKey);
    }

    // Check database
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { hashedKey }
    });

    if (!apiKey) {
      return {
        isValid: false,
        error: 'API key not found'
      };
    }

    // Cache the key for future validations
    await this.cacheApiKey(hashedKey, apiKey);

    return this.validateApiKeyData(apiKey);
  }

  async revokeApiKey(
    id: string,
    userId: string
  ): Promise<void> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id }
    });

    if (!apiKey) {
      throw new ValidationError('API key not found');
    }

    if (apiKey.userId !== userId) {
      throw new ValidationError('Unauthorized to revoke this API key');
    }

    // Revoke the key
    await this.prisma.apiKey.update({
      where: { id },
      data: {
        revokedAt: new Date()
      }
    });

    // Remove from cache
    await this.removeCachedApiKey(apiKey.hashedKey);
  }

  async rotateApiKey(
    id: string,
    userId: string
  ): Promise<{ apiKey: ApiKey; plainTextKey: string }> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id }
    });

    if (!apiKey) {
      throw new ValidationError('API key not found');
    }

    if (apiKey.userId !== userId) {
      throw new ValidationError('Unauthorized to rotate this API key');
    }

    // Generate new key
    const plainTextKey = this.generateApiKey();
    const hashedKey = this.hashApiKey(plainTextKey);

    // Update API key
    const updatedKey = await this.prisma.apiKey.update({
      where: { id },
      data: {
        hashedKey,
        updatedAt: new Date()
      }
    });

    // Update cache
    await this.cacheApiKey(hashedKey, updatedKey);
    await this.removeCachedApiKey(apiKey.hashedKey);

    return {
      apiKey: updatedKey,
      plainTextKey: `${this.keyPrefix}${plainTextKey}`
    };
  }

  async listApiKeys(
    userId: string,
    options: {
      includeRevoked?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<ApiKey[]> {
    return this.prisma.apiKey.findMany({
      where: {
        userId,
        revokedAt: options.includeRevoked ? undefined : null
      },
      take: options.limit,
      skip: options.offset,
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async updateApiKeyScopes(
    id: string,
    userId: string,
    scopes: string[]
  ): Promise<ApiKey> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id }
    });

    if (!apiKey) {
      throw new ValidationError('API key not found');
    }

    if (apiKey.userId !== userId) {
      throw new ValidationError('Unauthorized to update this API key');
    }

    // Validate new scopes
    this.validateScopes(scopes);

    // Update scopes
    const updatedKey = await this.prisma.apiKey.update({
      where: { id },
      data: {
        scopes,
        updatedAt: new Date()
      }
    });

    // Update cache
    await this.cacheApiKey(apiKey.hashedKey, updatedKey);

    return updatedKey;
  }

  private generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashApiKey(key: string): string {
    return crypto
      .createHash('sha256')
      .update(key)
      .digest('hex');
  }

  private validateScopes(scopes: string[]): void {
    if (!scopes.length) {
      throw new ValidationError('At least one scope is required');
    }

    for (const scope of scopes) {
      if (!this.availableScopes.has(scope)) {
        throw new ValidationError(`Invalid scope: ${scope}`);
      }
    }
  }

  private validateApiKeyData(
    apiKey: ApiKey
  ): ApiKeyValidationResult {
    if (apiKey.revokedAt) {
      return {
        isValid: false,
        error: 'API key has been revoked'
      };
    }

    if (apiKey.expiresAt && apiKey.expiresAt <= new Date()) {
      return {
        isValid: false,
        error: 'API key has expired'
      };
    }

    // Update last used timestamp
    this.updateLastUsed(apiKey.id).catch(error => {
      this.logger.error('Failed to update API key last used timestamp:', error);
    });

    return {
      isValid: true,
      apiKey
    };
  }

  private async updateLastUsed(id: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: {
        lastUsedAt: new Date()
      }
    });
  }

  private async cacheApiKey(
    hashedKey: string,
    apiKey: ApiKey
  ): Promise<void> {
    const key = `apikey:${hashedKey}`;
    await this.redis.set(
      key,
      JSON.stringify(apiKey),
      'EX',
      3600 // Cache for 1 hour
    );
  }

  private async getCachedApiKey(
    hashedKey: string
  ): Promise<ApiKey | null> {
    const key = `apikey:${hashedKey}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  private async removeCachedApiKey(
    hashedKey: string
  ): Promise<void> {
    const key = `apikey:${hashedKey}`;
    await this.redis.del(key);
  }
} 