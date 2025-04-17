import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { z } from 'zod';

interface SettingCategory {
  key: string;
  name: string;
  description: string;
  schema: z.ZodSchema;
}

export class SettingsService extends BaseService {
  private readonly categories: SettingCategory[] = [
    {
      key: 'general',
      name: 'General Settings',
      description: 'Basic system configuration',
      schema: z.object({
        businessName: z.string(),
        businessAddress: z.string(),
        timezone: z.string(),
        currency: z.string(),
        dateFormat: z.string(),
        timeFormat: z.string()
      })
    },
    {
      key: 'pos',
      name: 'POS Settings',
      description: 'Point of Sale configuration',
      schema: z.object({
        defaultTaxRate: z.number(),
        receiptHeader: z.string(),
        receiptFooter: z.string(),
        allowDiscounts: z.boolean(),
        requireCustomerForSale: z.boolean(),
        allowNegativeInventory: z.boolean()
      })
    },
    {
      key: 'inventory',
      name: 'Inventory Settings',
      description: 'Inventory management configuration',
      schema: z.object({
        lowStockThreshold: z.number(),
        enableAutoReorder: z.boolean(),
        defaultSupplier: z.string().optional(),
        trackExpiryDates: z.boolean(),
        barcodeFormat: z.string()
      })
    },
    {
      key: 'security',
      name: 'Security Settings',
      description: 'Security and access control settings',
      schema: z.object({
        passwordPolicy: z.object({
          minLength: z.number(),
          requireUppercase: z.boolean(),
          requireNumbers: z.boolean(),
          requireSpecialChars: z.boolean()
        }),
        sessionTimeout: z.number(),
        maxLoginAttempts: z.number(),
        twoFactorAuth: z.boolean()
      })
    }
  ];

  async getSettings(category?: string) {
    if (category) {
      const categoryConfig = this.categories.find(c => c.key === category);
      if (!categoryConfig) {
        throw new ValidationError(`Invalid category: ${category}`);
      }

      return this.prisma.settings.findFirst({
        where: { category }
      });
    }

    return this.prisma.settings.findMany();
  }

  async updateSettings(category: string, settings: Record<string, any>) {
    const categoryConfig = this.categories.find(c => c.key === category);
    if (!categoryConfig) {
      throw new ValidationError(`Invalid category: ${category}`);
    }

    // Validate settings against schema
    try {
      categoryConfig.schema.parse(settings);
    } catch (error) {
      throw new ValidationError(`Invalid settings: ${error.message}`);
    }

    // Update settings
    const updated = await this.prisma.settings.upsert({
      where: { category },
      update: { settings },
      create: {
        category,
        settings
      }
    });

    // Emit settings update event
    this.emitSocketEvent('settings:updated', {
      category,
      settings: updated.settings
    });

    // Clear settings cache
    await this.redis.del(`settings:${category}`);

    return updated;
  }

  async getSettingValue<T>(category: string, key: string): Promise<T> {
    // Try to get from cache first
    const cached = await this.redis.get(`settings:${category}`);
    if (cached) {
      const settings = JSON.parse(cached);
      return settings[key];
    }

    // Get from database
    const settings = await this.prisma.settings.findFirst({
      where: { category }
    });

    if (!settings) {
      throw new ValidationError(`Settings not found for category: ${category}`);
    }

    // Cache settings
    await this.redis.setex(
      `settings:${category}`,
      3600, // 1 hour
      JSON.stringify(settings.settings)
    );

    return settings.settings[key];
  }

  async getBulkSettings(categories: string[]) {
    const settings = await this.prisma.settings.findMany({
      where: {
        category: {
          in: categories
        }
      }
    });

    return settings.reduce((acc, setting) => {
      acc[setting.category] = setting.settings;
      return acc;
    }, {} as Record<string, any>);
  }

  async resetSettings(category: string) {
    const categoryConfig = this.categories.find(c => c.key === category);
    if (!categoryConfig) {
      throw new ValidationError(`Invalid category: ${category}`);
    }

    await this.prisma.settings.delete({
      where: { category }
    });

    // Clear settings cache
    await this.redis.del(`settings:${category}`);

    // Emit settings reset event
    this.emitSocketEvent('settings:reset', { category });
  }

  async exportSettings() {
    const settings = await this.prisma.settings.findMany();
    return {
      version: '1.0',
      timestamp: new Date().toISOString(),
      settings: settings.reduce((acc, setting) => {
        acc[setting.category] = setting.settings;
        return acc;
      }, {} as Record<string, any>)
    };
  }

  async importSettings(data: any) {
    // Validate import data
    if (!data.version || !data.settings) {
      throw new ValidationError('Invalid import data format');
    }

    // Validate and import each category
    for (const [category, settings] of Object.entries(data.settings)) {
      const categoryConfig = this.categories.find(c => c.key === category);
      if (!categoryConfig) {
        continue; // Skip invalid categories
      }

      try {
        categoryConfig.schema.parse(settings);
        await this.updateSettings(category, settings);
      } catch (error) {
        throw new ValidationError(
          `Invalid settings for category ${category}: ${error.message}`
        );
      }
    }
  }

  async validateSettings(category: string, settings: Record<string, any>) {
    const categoryConfig = this.categories.find(c => c.key === category);
    if (!categoryConfig) {
      throw new ValidationError(`Invalid category: ${category}`);
    }

    try {
      categoryConfig.schema.parse(settings);
      return true;
    } catch (error) {
      return {
        valid: false,
        errors: error.errors
      };
    }
  }

  getCategories() {
    return this.categories.map(({ key, name, description }) => ({
      key,
      name,
      description
    }));
  }

  getCategorySchema(category: string) {
    const categoryConfig = this.categories.find(c => c.key === category);
    if (!categoryConfig) {
      throw new ValidationError(`Invalid category: ${category}`);
    }

    return categoryConfig.schema;
  }

  async auditSettings() {
    const settings = await this.prisma.settings.findMany();
    const audit = [];

    for (const setting of settings) {
      const categoryConfig = this.categories.find(c => c.key === setting.category);
      if (!categoryConfig) {
        audit.push({
          category: setting.category,
          status: 'invalid_category',
          message: 'Category does not exist in configuration'
        });
        continue;
      }

      try {
        categoryConfig.schema.parse(setting.settings);
        audit.push({
          category: setting.category,
          status: 'valid',
          message: 'Settings are valid'
        });
      } catch (error) {
        audit.push({
          category: setting.category,
          status: 'invalid_settings',
          message: error.message
        });
      }
    }

    return audit;
  }
} 