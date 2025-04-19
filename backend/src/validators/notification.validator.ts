import { z } from 'zod';

export const NotificationSchema = {
  send: z.object({
    userId: z.string().uuid(),
    type: z.string(),
    title: z.string(),
    message: z.string(),
    data: z.record(z.any()).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    channels: z.array(z.enum(['email', 'push', 'sms'])).optional()
  }),
  createTemplate: z.object({
    name: z.string(),
    type: z.string(),
    subject: z.string(),
    content: z.string(),
    variables: z.array(z.string()).optional(),
    isActive: z.boolean().optional()
  }),
  updatePreferences: z.object({
    userId: z.string().uuid(),
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    sms: z.boolean().optional(),
    frequency: z.enum(['immediate', 'daily', 'weekly']).optional()
  }),
  getHistory: z.object({
    userId: z.string().uuid(),
    page: z.number().min(1).optional(),
    limit: z.number().min(1).max(100).optional(),
    type: z.string().optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  })
}; 