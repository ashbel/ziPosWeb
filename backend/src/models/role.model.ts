import { z } from 'zod';

export const Permission = {
  VIEW_DASHBOARD: 'view_dashboard',
  MANAGE_PRODUCTS: 'manage_products',
  MANAGE_INVENTORY: 'manage_inventory',
  MANAGE_USERS: 'manage_users',
  MANAGE_ROLES: 'manage_roles',
  PROCESS_SALES: 'process_sales',
  PROCESS_RETURNS: 'process_returns',
  VIEW_REPORTS: 'view_reports',
  MANAGE_SUPPLIERS: 'manage_suppliers',
  MANAGE_DISCOUNTS: 'manage_discounts',
} as const;

export const RoleSchema = z.object({
  name: z.string().min(1),
  permissions: z.array(z.enum([
    'view_dashboard',
    'manage_products',
    'manage_inventory',
    'manage_users',
    'manage_roles',
    'process_sales',
    'process_returns',
    'view_reports',
    'manage_suppliers',
    'manage_discounts'
  ])),
  description: z.string().optional()
}); 