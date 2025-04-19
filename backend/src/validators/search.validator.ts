import { z } from 'zod';

export const SearchSchema = {
  search: z.object({
    query: z.string().min(1),
    filters: z.record(z.any()).optional(),
    facets: z.array(z.string()).optional(),
    page: z.number().min(1).optional(),
    limit: z.number().min(1).max(100).optional(),
    sort: z.object({
      field: z.string(),
      order: z.enum(['asc', 'desc'])
    }).optional()
  }),
  suggest: z.object({
    field: z.string(),
    prefix: z.string(),
    limit: z.number().min(1).max(20).optional(),
    minScore: z.number().min(0).max(1).optional()
  }),
  index: z.object({
    type: z.string(),
    id: z.string(),
    data: z.record(z.any()),
    boost: z.number().min(0).optional()
  }),
  bulkIndex: z.array(z.object({
    type: z.string(),
    id: z.string(),
    data: z.record(z.any()),
    boost: z.number().min(0).optional()
  }))
}; 