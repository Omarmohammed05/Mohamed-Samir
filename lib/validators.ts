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

export const userCreateSchema = z.object({
  email: z.string().email('Invalid email'),
  name: z.string().min(1, 'Name is required').max(100, 'Max 100 characters'),
  role: z.enum(['user', 'admin']),
  password: z.string().min(6, 'Password must be at least 6 characters').max(100, 'Max 100 characters'),
});

export const userUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['user', 'admin']).optional(),
  password: z.string().min(6).max(100).optional(),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
