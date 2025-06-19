import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '@/types/api';
import { ApiError } from './errors';

export function withErrorHandler<T = unknown>(
  handler: (request: NextRequest, ...args: unknown[]) => Promise<NextResponse<ApiResponse<T>>>
) {
  return async (request: NextRequest, ...args: unknown[]): Promise<NextResponse<ApiResponse<T>>> => {
    const requestId = crypto.randomUUID();
    
    try {
      return await handler(request, ...args);
    } catch (error) {
      console.error(`API Error [${requestId}]:`, error);

      if (error instanceof ApiError) {
        return NextResponse.json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: process.env.API_VERSION || '1.0',
            request_id: requestId,
          },
        } as ApiResponse<T>, { status: error.statusCode });
      }

      // Generic error response
      return NextResponse.json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
        meta: {
          timestamp: new Date().toISOString(),
          version: process.env.API_VERSION || '1.0',
          request_id: requestId,
        },
      } as ApiResponse<T>, { status: 500 });
    }
  };
}

export function withAuth<T = unknown>(
  handler: (request: NextRequest, user: any, ...args: unknown[]) => Promise<NextResponse<ApiResponse<T>>>,
  options: { requireRole?: string[] } = {}
) {
  return withErrorHandler(async (request: NextRequest, ...args: unknown[]) => {
    const { requireAuth, requireRole } = await import('./auth');
    const user = await requireAuth(request);
    
    if (options.requireRole) {
      requireRole(user, options.requireRole);
    }
    
    return handler(request, user, ...args);
  });
}

export function createSuccessResponse<T>(
  data: T,
  status = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      version: process.env.API_VERSION || '1.0',
      request_id: crypto.randomUUID(),
    },
  }, { status });
}

export function rateLimit() {
  // Simple in-memory rate limiting (replace with Redis in production)
  const requests = new Map<string, number[]>();
  const limit = parseInt(process.env.API_RATE_LIMIT || '100');
  const windowMs = 60 * 1000; // 1 minute

  return (request: NextRequest): boolean => {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    
    if (!requests.has(ip)) {
      requests.set(ip, []);
    }
    
    const userRequests = requests.get(ip)!;
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= limit) {
      return false; // Rate limit exceeded
    }
    
    validRequests.push(now);
    requests.set(ip, validRequests);
    
    return true; // Request allowed
  };
}