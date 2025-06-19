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

    const auditLogs = await prisma.auditLog.findMany({
      select: {
        id: true,
        userId: true,
        tableName: true,
        recordId: true,
        action: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        user: {
          select: {
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100 // Limit to last 100 entries
    });

    // Transform the data to include user email at the top level
    const transformedLogs = auditLogs.map(log => ({
      id: log.id,
      userId: log.userId,
      userEmail: log.user?.email,
      tableName: log.tableName,
      recordId: log.recordId,
      action: log.action,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt
    }));

    return NextResponse.json({
      success: true,
      data: transformedLogs,
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1',
        count: transformedLogs.length
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}