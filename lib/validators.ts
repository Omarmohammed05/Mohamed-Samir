import { z } from 'zod';

export const entryDataSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  a: z.string().min(1, 'Field A is required').max(1000, 'Max 1000 characters'),
  b: z.string().min(1, 'Field B is required').max(1000, 'Max 1000 characters'),
  c: z.string().min(1, 'Field C is required').max(1000, 'Max 1000 characters'),
  d: z.string().min(1, 'Field D is required').max(1000, 'Max 1000 characters'),
});

export const entryInputSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  a: z.string().min(1).max(1000),
  b: z.string().min(1).max(1000),
  c: z.string().min(1).max(1000),
  d: z.string().min(1).max(1000),
});

export type EntryData = z.infer<typeof entryDataSchema>;

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─── Card entry schemas ─────────────────────────────────

export const cardEntryCreateSchema = z.object({
  card_id: z.string().min(1, 'Card ID is required'),
  rows: z.array(z.array(z.string())).min(1, 'At least one row is required'),
  duration_seconds: z.number().nullable().optional(),
  filter: z.string().optional(),
});

export const cardEntryUpdateSchema = z.object({
  rows: z.array(z.array(z.string())).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
}).refine((data) => data.newPassword !== data.currentPassword, {
  message: 'New password must differ from the current password',
  path: ['newPassword'],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ─── User schemas (updated for 4 roles) ─────────────────

export const userCreateSchema = z.object({
  email: z.string().email('Invalid email'),
  name: z.string().min(1, 'Name is required').max(100, 'Max 100 characters'),
  role: z.enum(['operator', 'supervisor', 'engineer', 'admin']),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100, 'Max 100 characters'),
});

export const userUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['operator', 'supervisor', 'engineer', 'admin']).optional(),
  password: z.string().min(6).max(100).optional(),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

// ─── Card config schema ─────────────────────────────────

export const cardConfigSchema = z.object({
  config: z.record(z.string(), z.object({
    min_seconds: z.number(),
    max_seconds: z.number(),
  })),
});
