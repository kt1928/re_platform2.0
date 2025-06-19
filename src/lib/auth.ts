import { NextRequest } from 'next/server';
import { User } from '@prisma/client';
import { verifyToken, JwtPayload } from './jwt';
import { AuthenticationError, AuthorizationError } from './errors';
import { UserRepository } from './repositories/user-repository';

export interface AuthenticatedRequest extends NextRequest {
  user: User;
}

export async function authenticate(request: NextRequest): Promise<User | null> {
  try {
    const authorization = request.headers.get('authorization');
    if (!authorization) {
      return null;
    }

    const token = authorization.replace('Bearer ', '');
    if (!token) {
      return null;
    }

    // Verify JWT token
    const payload: JwtPayload = verifyToken(token);

    // Fetch user from database
    const userRepository = new UserRepository();
    const user = await userRepository.findById(payload.userId);

    if (!user || !user.isActive) {
      throw new AuthenticationError('User not found or inactive');
    }

    return user;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError('Authentication failed');
  }
}

export async function requireAuth(request: NextRequest): Promise<User> {
  const user = await authenticate(request);
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }
  return user;
}

export function requireRole(user: User, allowedRoles: string[]): void {
  if (!allowedRoles.includes(user.role)) {
    throw new AuthorizationError(
      `Access denied. Required roles: ${allowedRoles.join(', ')}`
    );
  }
}

export function requireAdmin(user: User): void {
  requireRole(user, ['ADMIN']);
}

export function requireAnalyst(user: User): void {
  requireRole(user, ['ADMIN', 'ANALYST']);
}

export function extractBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get('authorization');
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }
  return authorization.slice(7); // Remove 'Bearer ' prefix
}

export function getUserIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const connectionRemoteAddress = request.headers.get('x-vercel-forwarded-for');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP.trim();
  }
  
  if (connectionRemoteAddress) {
    return connectionRemoteAddress.trim();
  }
  
  return 'unknown';
}

export function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown';
}