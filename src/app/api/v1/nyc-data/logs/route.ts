import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/jwt';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'Authentication required' 
          } 
        },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    let payload;
    
    try {
      payload = verifyToken(token);
    } catch (error) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'UNAUTHORIZED', 
            message: 'Invalid or expired token' 
          } 
        },
        { status: 401 }
      );
    }
    
    // Only admins can view sync logs
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'FORBIDDEN', 
            message: 'Admin access required' 
          } 
        },
        { status: 403 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const datasetId = searchParams.get('datasetId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Build where clause
    const where: any = {};
    if (datasetId) {
      where.datasetId = datasetId;
    }
    if (status) {
      where.status = status;
    }
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) {
        where.startTime.gte = new Date(startDate);
      }
      if (endDate) {
        where.startTime.lte = new Date(endDate);
      }
    }

    // Fetch sync logs with pagination
    const [logs, total] = await Promise.all([
      prisma.nYCDataSyncLog.findMany({
        where,
        orderBy: { startTime: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.nYCDataSyncLog.count({ where })
    ]);

    // Get aggregated statistics
    const stats = await prisma.nYCDataSyncLog.groupBy({
      by: ['datasetId', 'status'],
      _count: true,
      _sum: {
        recordsProcessed: true,
        recordsAdded: true,
        recordsUpdated: true,
        recordsFailed: true
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        logs,
        total,
        limit,
        offset,
        stats
      }
    });
  } catch (error) {
    console.error('Error fetching sync logs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error instanceof Error ? error.message : 'Failed to fetch sync logs' 
        } 
      },
      { status: 500 }
    );
  }
}