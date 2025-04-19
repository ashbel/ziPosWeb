import { z } from 'zod';

export const AuditSchema = {
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    eventType: z.string().optional(),
    userId: z.string().optional(),
    page: z.number().min(1).optional(),
    limit: z.number().min(1).max(100).optional()
  }),

  anomalies: z.object({
    threshold: z.number().min(0).max(1).optional(),
    timeWindow: z.string().optional()
  }),

  alert: z.object({
    name: z.string(),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    conditions: z.record(z.any())
  }),

  compliance: z.object({
    startDate: z.string(),
    endDate: z.string()
  }),

  export: z.object({
    format: z.enum(['json', 'csv']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional()
  })
}; 