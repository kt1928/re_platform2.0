import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .min(1, 'Email is required')
    .max(255, 'Email too long'),
  password: z.string()
    .min(1, 'Password is required')
    .max(128, 'Password too long'),
});

export const registerSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .min(1, 'Email is required')
    .max(255, 'Email too long'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
  fullName: z.string()
    .min(1, 'Full name is required')
    .max(255, 'Full name too long')
    .regex(/^[a-zA-Z\s'-]+$/, 'Full name contains invalid characters'),
  role: z.enum(['ADMIN', 'ANALYST', 'VIEWER']).optional().default('ANALYST'),
});

export type LoginRequest = z.infer<typeof loginSchema>;
export type RegisterRequest = z.infer<typeof registerSchema>;

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
  };
  token: string;
  expiresAt: string;
}

export interface RefreshRequest {
  token: string;
}

export interface RefreshResponse {
  token: string;
  expiresAt: string;
}