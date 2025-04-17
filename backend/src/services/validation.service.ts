import { BaseService } from './base.service';
import { ValidationError } from '../utils/errors';
import { z } from 'zod';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { DateTime } from 'luxon';

interface ValidationRule {
  field: string;
  type: string;
  rules: Array<{
    type: string;
    params?: any;
    message?: string;
  }>;
  dependencies?: Array<{
    field: string;
    condition: string;
    value: any;
  }>;
}

interface ValidationSchema {
  name: string;
  description?: string;
  rules: ValidationRule[];
  customValidators?: Array<{
    name: string;
    validator: (value: any, context: any) => boolean | Promise<boolean>;
  }>;
}

export class ValidationService extends BaseService {
  private schemas: Map<string, ValidationSchema>;
  private ajv: Ajv;
  private zodSchemas: Map<string, z.ZodSchema>;

  constructor(deps: any) {
    super(deps);
    this.schemas = new Map();
    this.zodSchemas = new Map();
    
    this.ajv = new Ajv({
      allErrors: true,
      coerceTypes: true,
      removeAdditional: true
    });
    addFormats(this.ajv);

    this.initializeValidators();
  }

  async validate(
    schemaName: string,
    data: any,
    context?: any
  ): Promise<{
    isValid: boolean;
    errors: any[];
  }> {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      throw new ValidationError(`Schema ${schemaName} not found`);
    }

    const errors: any[] = [];

    // Validate each field according to its rules
    for (const rule of schema.rules) {
      const value = data[rule.field];

      // Check dependencies
      if (rule.dependencies) {
        for (const dep of rule.dependencies) {
          const depValue = data[dep.field];
          if (!this.evaluateDependency(depValue, dep.condition, dep.value)) {
            continue;
          }
        }
      }

      // Apply validation rules
      for (const validation of rule.rules) {
        try {
          await this.applyValidationRule(
            validation,
            value,
            rule.field,
            data,
            context
          );
        } catch (error) {
          errors.push({
            field: rule.field,
            type: validation.type,
            message: validation.message || error.message
          });
        }
      }
    }

    // Apply custom validators
    if (schema.customValidators) {
      for (const validator of schema.customValidators) {
        try {
          const isValid = await validator.validator(data, context);
          if (!isValid) {
            errors.push({
              type: 'custom',
              validator: validator.name,
              message: `Custom validation '${validator.name}' failed`
            });
          }
        } catch (error) {
          errors.push({
            type: 'custom',
            validator: validator.name,
            message: error.message
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async validateWithZod<T>(
    schemaName: string,
    data: any
  ): Promise<{
    isValid: boolean;
    data?: T;
    errors?: z.ZodError;
  }> {
    const schema = this.zodSchemas.get(schemaName);
    if (!schema) {
      throw new ValidationError(`Zod schema ${schemaName} not found`);
    }

    try {
      const validatedData = await schema.parseAsync(data);
      return {
        isValid: true,
        data: validatedData as T
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error
        };
      }
      throw error;
    }
  }

  async validateWithAjv(
    schemaName: string,
    data: any
  ): Promise<{
    isValid: boolean;
    errors?: any[];
  }> {
    const validate = this.ajv.getSchema(schemaName);
    if (!validate) {
      throw new ValidationError(`JSON Schema ${schemaName} not found`);
    }

    const isValid = validate(data);
    return {
      isValid,
      errors: validate.errors
    };
  }

  registerSchema(schema: ValidationSchema): void {
    this.validateSchema(schema);
    this.schemas.set(schema.name, schema);
  }

  registerZodSchema(name: string, schema: z.ZodSchema): void {
    this.zodSchemas.set(name, schema);
  }

  registerJsonSchema(name: string, schema: object): void {
    this.ajv.addSchema(schema, name);
  }

  private initializeValidators(): void {
    // Register common validation schemas
    this.registerSchema({
      name: 'user',
      rules: [
        {
          field: 'email',
          type: 'string',
          rules: [
            { type: 'required' },
            { type: 'email' },
            { type: 'unique', params: { table: 'user', field: 'email' } }
          ]
        },
        {
          field: 'password',
          type: 'string',
          rules: [
            { type: 'required' },
            { type: 'minLength', params: { length: 8 } },
            { type: 'password' }
          ]
        }
      ]
    });

    // Register common Zod schemas
    this.registerZodSchema(
      'product',
      z.object({
        name: z.string().min(1).max(100),
        price: z.number().positive(),
        description: z.string().optional(),
        category: z.string(),
        sku: z.string().regex(/^[A-Z0-9-]+$/),
        stock: z.number().int().min(0)
      })
    );

    // Register common JSON schemas
    this.registerJsonSchema('order', {
      type: 'object',
      required: ['customerId', 'items'],
      properties: {
        customerId: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            required: ['productId', 'quantity'],
            properties: {
              productId: { type: 'string' },
              quantity: { type: 'integer', minimum: 1 }
            }
          }
        }
      }
    });
  }

  private validateSchema(schema: ValidationSchema): void {
    if (!schema.name) {
      throw new ValidationError('Schema name is required');
    }

    if (!Array.isArray(schema.rules)) {
      throw new ValidationError('Schema rules must be an array');
    }

    for (const rule of schema.rules) {
      if (!rule.field || !rule.type || !Array.isArray(rule.rules)) {
        throw new ValidationError('Invalid rule configuration');
      }
    }
  }

  private async applyValidationRule(
    rule: { type: string; params?: any; message?: string },
    value: any,
    field: string,
    data: any,
    context: any
  ): Promise<void> {
    switch (rule.type) {
      case 'required':
        if (value === undefined || value === null || value === '') {
          throw new Error(`${field} is required`);
        }
        break;

      case 'email':
        if (!this.isValidEmail(value)) {
          throw new Error(`${field} must be a valid email`);
        }
        break;

      case 'minLength':
        if (value.length < rule.params.length) {
          throw new Error(
            `${field} must be at least ${rule.params.length} characters`
          );
        }
        break;

      case 'maxLength':
        if (value.length > rule.params.length) {
          throw new Error(
            `${field} must not exceed ${rule.params.length} characters`
          );
        }
        break;

      case 'pattern':
        if (!new RegExp(rule.params.pattern).test(value)) {
          throw new Error(`${field} has an invalid format`);
        }
        break;

      case 'unique':
        const exists = await this.checkUnique(
          rule.params.table,
          rule.params.field,
          value,
          context?.id
        );
        if (exists) {
          throw new Error(`${field} must be unique`);
        }
        break;

      case 'enum':
        if (!rule.params.values.includes(value)) {
          throw new Error(
            `${field} must be one of: ${rule.params.values.join(', ')}`
          );
        }
        break;

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          throw new Error(`${field} must be a number`);
        }
        break;

      case 'integer':
        if (!Number.isInteger(value)) {
          throw new Error(`${field} must be an integer`);
        }
        break;

      case 'min':
        if (value < rule.params.value) {
          throw new Error(`${field} must be at least ${rule.params.value}`);
        }
        break;

      case 'max':
        if (value > rule.params.value) {
          throw new Error(`${field} must not exceed ${rule.params.value}`);
        }
        break;

      case 'date':
        if (!DateTime.fromISO(value).isValid) {
          throw new Error(`${field} must be a valid date`);
        }
        break;

      case 'password':
        if (!this.isValidPassword(value)) {
          throw new Error(
            `${field} must contain at least one uppercase letter, one lowercase letter, one number, and one special character`
          );
        }
        break;

      case 'conditional':
        const condition = rule.params.condition;
        const targetField = rule.params.field;
        const targetValue = data[targetField];

        if (!this.evaluateCondition(condition, targetValue, rule.params.value)) {
          throw new Error(rule.params.message || `${field} validation failed`);
        }
        break;

      default:
        throw new Error(`Unknown validation type: ${rule.type}`);
    }
  }

  private async checkUnique(
    table: string,
    field: string,
    value: any,
    excludeId?: string
  ): Promise<boolean> {
    const where: any = {
      [field]: value
    };

    if (excludeId) {
      where.id = { not: excludeId };
    }

    const count = await this.prisma[table].count({ where });
    return count > 0;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private isValidPassword(password: string): boolean {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  }

  private evaluateCondition(
    condition: string,
    value1: any,
    value2: any
  ): boolean {
    switch (condition) {
      case 'equals':
        return value1 === value2;
      case 'notEquals':
        return value1 !== value2;
      case 'greaterThan':
        return value1 > value2;
      case 'lessThan':
        return value1 < value2;
      case 'contains':
        return value1.includes(value2);
      default:
        return false;
    }
  }

  private evaluateDependency(
    value: any,
    condition: string,
    targetValue: any
  ): boolean {
    return this.evaluateCondition(condition, value, targetValue);
  }
} 