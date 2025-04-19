import { z } from 'zod';

export const ConfigurationSchema = {
  set: z.object({
    value: z.any(),
    options: z.object({
      ttl: z.number().optional(),
      scope: z.string().optional()
    }).optional()
  }),

  featureFlag: z.object({
    name: z.string(),
    enabled: z.boolean(),
    context: z.record(z.any()).optional()
  }),

  bulkUpdate: z.array(z.object({
    key: z.string(),
    value: z.any()
  }))
}; 