import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';
import { handleApiError } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Admin access required' }
        },
        { status: 403 }
      );
    }

    const [users, properties, portfolios, marketMetrics, auditLogs] = await Promise.all([
      prisma.user.count(),
      prisma.property.count(),
      prisma.portfolio.count(),
      prisma.marketMetric.count(),
      prisma.auditLog.count(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        users,
        properties,
        portfolios,
        marketMetrics,
        auditLogs,
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1',
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}