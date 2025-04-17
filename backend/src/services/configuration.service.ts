import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';

interface ConfigurationSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  default?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
    custom?: (value: any) => boolean;
  };
}

interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  conditions?: Array<{
    type: 'user' | 'group' | 'percentage' | 'date' | 'custom';
    value: any;
  }>;
}

export class ConfigurationService extends BaseService {
  private readonly redis: Redis;
  private readonly eventEmitter: EventEmitter;
  private readonly configSchema: Record<string, ConfigurationSchema>;

  constructor(deps: any) {
    super(deps);
    
    this.redis = deps.redis;
    this.eventEmitter = deps.eventEmitter;
    this.configSchema = this.initializeSchema();
  }

  async setConfiguration(
    key: string,
    value: any,
    options: {
      environment?: string;
      temporary?: boolean;
      ttl?: number;
    } = {}
  ): Promise<void> {
    // Validate key exists in schema
    if (!this.configSchema[key]) {
      throw new ValidationError(`Invalid configuration key: ${key}`);
    }

    // Validate value against schema
    this.validateValue(key, value);

    const environment = options.environment || process.env.NODE_ENV || 'development';

    if (options.temporary) {
      // Store in Redis with TTL
      const redisKey = `config:${environment}:${key}`;
      await this.redis.set(
        redisKey,
        JSON.stringify(value),
        'EX',
        options.ttl || 3600
      );
    } else {
      // Store in database
      await this.prisma.configuration.upsert({
        where: {
          key_environment: {
            key,
            environment
          }
        },
        update: {
          value,
          updatedAt: new Date()
        },
        create: {
          key,
          environment,
          value
        }
      });

      // Invalidate cache
      await this.redis.del(`config:${environment}:${key}`);
    }

    // Emit configuration change event
    this.eventEmitter.emit('configuration:changed', {
      key,
      value,
      environment
    });
  }

  async getConfiguration<T>(
    key: string,
    options: {
      environment?: string;
      default?: T;
    } = {}
  ): Promise<T> {
    const environment = options.environment || process.env.NODE_ENV || 'development';

    // Try cache first
    const cached = await this.redis.get(`config:${environment}:${key}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get from database
    const config = await this.prisma.configuration.findUnique({
      where: {
        key_environment: {
          key,
          environment
        }
      }
    });

    if (!config) {
      if (options.default !== undefined) {
        return options.default;
      }
      if (this.configSchema[key]?.default !== undefined) {
        return this.configSchema[key].default;
      }
      throw new ValidationError(`Configuration not found: ${key}`);
    }

    // Cache the value
    await this.redis.set(
      `config:${environment}:${key}`,
      JSON.stringify(config.value),
      'EX',
      3600
    );

    return config.value;
  }

  async setFeatureFlag(
    data: FeatureFlag
  ): Promise<FeatureFlag> {
    return this.prisma.featureFlag.upsert({
      where: { name: data.name },
      update: {
        enabled: data.enabled,
        description: data.description,
        conditions: data.conditions
      },
      create: data
    });
  }

  async isFeatureEnabled(
    flagName: string,
    context?: {
      userId?: string;
      groupId?: string;
      [key: string]: any;
    }
  ): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { name: flagName }
    });

    if (!flag) {
      return false;
    }

    if (!flag.enabled) {
      return false;
    }

    if (!flag.conditions?.length) {
      return true;
    }

    return this.evaluateFeatureConditions(flag.conditions, context);
  }

  async bulkUpdateConfiguration(
    updates: Array<{
      key: string;
      value: any;
      environment?: string;
    }>
  ): Promise<void> {
    await this.prisma.$transaction(async (prisma) => {
      for (const update of updates) {
        this.validateValue(update.key, update.value);

        const environment = update.environment || process.env.NODE_ENV || 'development';

        await prisma.configuration.upsert({
          where: {
            key_environment: {
              key: update.key,
              environment
            }
          },
          update: {
            value: update.value,
            updatedAt: new Date()
          },
          create: {
            key: update.key,
            environment,
            value: update.value
          }
        });

        await this.redis.del(`config:${environment}:${update.key}`);
      }
    });

    this.eventEmitter.emit('configuration:bulkUpdated', updates);
  }

  async getConfigurationHistory(
    key: string,
    options: {
      environment?: string;
      limit?: number;
    } = {}
  ): Promise<Array<{
    value: any;
    updatedAt: Date;
    updatedBy?: string;
  }>> {
    return this.prisma.configurationHistory.findMany({
      where: {
        key,
        environment: options.environment || process.env.NODE_ENV
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: options.limit || 10
    });
  }

  private initializeSchema(): Record<string, ConfigurationSchema> {
    return {
      'app.name': {
        type: 'string',
        required: true,
        default: 'My App'
      },
      'app.url': {
        type: 'string',
        required: true,
        validation: {
          pattern: '^https?://.+'
        }
      },
      'email.from': {
        type: 'string',
        required: true,
        validation: {
          pattern: '^[^@]+@[^@]+\\.[^@]+$'
        }
      },
      'email.smtp': {
        type: 'object',
        required: true,
        default: {
          host: 'smtp.example.com',
          port: 587,
          secure: true
        }
      },
      'security.passwordPolicy': {
        type: 'object',
        required: true,
        default: {
          minLength: 8,
          requireNumbers: true,
          requireSpecialChars: true
        }
      },
      // Add more schema definitions as needed
    };
  }

  private validateValue(key: string, value: any): void {
    const schema = this.configSchema[key];
    if (!schema) {
      throw new ValidationError(`Invalid configuration key: ${key}`);
    }

    // Type validation
    if (typeof value !== schema.type && schema.type !== 'object') {
      throw new ValidationError(
        `Invalid type for ${key}. Expected ${schema.type}`
      );
    }

    // Required validation
    if (schema.required && value === undefined) {
      throw new ValidationError(`${key} is required`);
    }

    // Validation rules
    if (schema.validation) {
      if (schema.validation.min !== undefined && value < schema.validation.min) {
        throw new ValidationError(
          `${key} must be at least ${schema.validation.min}`
        );
      }

      if (schema.validation.max !== undefined && value > schema.validation.max) {
        throw new ValidationError(
          `${key} must be at most ${schema.validation.max}`
        );
      }

      if (schema.validation.pattern && !new RegExp(schema.validation.pattern).test(value)) {
        throw new ValidationError(
          `${key} must match pattern: ${schema.validation.pattern}`
        );
      }

      if (schema.validation.enum && !schema.validation.enum.includes(value)) {
        throw new ValidationError(
          `${key} must be one of: ${schema.validation.enum.join(', ')}`
        );
      }

      if (schema.validation.custom && !schema.validation.custom(value)) {
        throw new ValidationError(
          `${key} failed custom validation`
        );
      }
    }
  }

  private async evaluateFeatureConditions(
    conditions: FeatureFlag['conditions'],
    context?: Record<string, any>
  ): Promise<boolean> {
    if (!conditions || !context) {
      return true;
    }

    for (const condition of conditions) {
      switch (condition.type) {
        case 'user':
          if (!context.userId || context.userId !== condition.value) {
            return false;
          }
          break;

        case 'group':
          if (!context.groupId || context.groupId !== condition.value) {
            return false;
          }
          break;

        case 'percentage':
          const hash = this.hashString(context.userId || '');
          const percentage = hash % 100;
          if (percentage >= condition.value) {
            return false;
          }
          break;

        case 'date':
          const now = new Date();
          const date = new Date(condition.value);
          if (now < date) {
            return false;
          }
          break;

        case 'custom':
          try {
            const fn = new Function('context', condition.value);
            if (!fn(context)) {
              return false;
            }
          } catch (error) {
            this.logger.error('Custom condition evaluation error:', error);
            return false;
          }
          break;
      }
    }

    return true;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
} 