import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { NYCSyncScheduler } from '@/lib/services/nyc-sync-scheduler';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    
    if (!payload) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Invalid token' } },
        { status: 403 }
      );
    }

    const nycApiToken = process.env.NYC_OPENDATA_API_KEY;
    const scheduler = new NYCSyncScheduler(nycApiToken);

    // Generate sync recommendations
    const schedule = await scheduler.generateSyncRecommendations();

    return NextResponse.json({
      success: true,
      data: {
        schedule,
        summary: {
          immediate: schedule.immediate.length,
          withinHour: schedule.withinHour.length,
          today: schedule.today.length,
          thisWeek: schedule.thisWeek.length,
          noAction: schedule.noAction.length,
          totalRecommendations: schedule.immediate.length + schedule.withinHour.length + schedule.today.length + schedule.thisWeek.length
        },
        message: schedule.immediate.length > 0 
          ? `${schedule.immediate.length} datasets need immediate sync`
          : 'No urgent sync operations needed'
      }
    });

  } catch (error) {
    console.error('Sync scheduler error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error instanceof Error ? error.message : 'Internal server error' 
        } 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication (admin only for auto-sync)
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, maxConcurrent = 2, maxDuration = 3600 } = body;

    const nycApiToken = process.env.NYC_OPENDATA_API_KEY;
    const scheduler = new NYCSyncScheduler(nycApiToken);

    switch (action) {
      case 'executeRecommended':
        // Execute recommended syncs
        const results = await scheduler.executeRecommendedSyncs(maxConcurrent, maxDuration);
        
        return NextResponse.json({
          success: true,
          data: {
            results,
            summary: {
              executed: results.executed,
              failed: results.failed,
              skipped: results.skipped,
              totalDuration: results.totalDuration,
              successRate: results.executed + results.failed > 0 
                ? Math.round((results.executed / (results.executed + results.failed)) * 100)
                : 0
            },
            message: `Auto-sync completed: ${results.executed} successful, ${results.failed} failed`
          }
        });

      default:
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Unknown action: ${action}` } },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Sync scheduler execution error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error instanceof Error ? error.message : 'Internal server error' 
        } 
      },
      { status: 500 }
    );
  }
}