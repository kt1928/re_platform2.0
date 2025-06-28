import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { prisma } from '@/lib/db';
import { NYCDataFreshnessService } from '@/lib/services/nyc-data-freshness-service';

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

    const { searchParams } = new URL(request.url);
    const dataset = searchParams.get('dataset');
    const action = searchParams.get('action') || 'status';

    const nycApiToken = process.env.NYC_OPENDATA_API_KEY;
    const freshnessService = new NYCDataFreshnessService(nycApiToken);

    switch (action) {
      case 'status':
        // Get current freshness status for all datasets
        const allStatuses = await freshnessService.getAllFreshnessStatuses();
        return NextResponse.json({
          success: true,
          data: {
            datasets: allStatuses,
            summary: {
              total: allStatuses.length,
              stale: allStatuses.filter(ds => ds.isStale).length,
              needSync: allStatuses.filter(ds => ds.recommendSync).length,
              avgFreshness: Math.round(allStatuses.reduce((sum, ds) => sum + ds.freshnessScore, 0) / allStatuses.length)
            }
          }
        });

      case 'check':
        // Run fresh freshness check
        if (dataset) {
          // Check specific dataset
          const result = await freshnessService.checkDatasetFreshness(dataset);
          await freshnessService.updateFreshnessStatus(dataset, result);
          
          return NextResponse.json({
            success: true,
            data: {
              dataset: result,
              message: `Freshness check completed for ${dataset}`
            }
          });
        } else {
          // Check all datasets with enhanced reporting
          const checkResult = await freshnessService.runFreshnessCheck();
          
          return NextResponse.json({
            success: true,
            data: {
              updated: checkResult.updated,
              errors: checkResult.errors,
              summary: checkResult.summary,
              message: `Freshness check completed: ${checkResult.updated} datasets updated, ${checkResult.summary.healthy} healthy, ${checkResult.summary.stale} stale, ${checkResult.summary.failed} failed`
            }
          });
        }

      case 'stale':
        // Get only stale datasets
        const staleDatasets = await freshnessService.getStaleDatasets();
        return NextResponse.json({
          success: true,
          data: {
            staleDatasets,
            count: staleDatasets.length,
            message: staleDatasets.length > 0 
              ? `Found ${staleDatasets.length} stale datasets` 
              : 'All datasets are fresh!'
          }
        });

      case 'health':
        // Get comprehensive health metrics
        const healthMetrics = await freshnessService.getDatasetHealthMetrics();
        return NextResponse.json({
          success: true,
          data: {
            health: healthMetrics,
            message: `Overall health: ${healthMetrics.overallHealth}%`
          }
        });

      case 'trends':
        // Get sync performance trends
        const trends = await freshnessService.getSyncPerformanceTrends();
        return NextResponse.json({
          success: true,
          data: {
            trends,
            message: `Performance data for last 30 days`
          }
        });

      default:
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Unknown action: ${action}` } },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('NYC data freshness error:', error);
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
    // Verify authentication (admin only for freshness management)
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
    const { action, dataset, settings } = body;

    const nycApiToken = process.env.NYC_OPENDATA_API_KEY;
    const freshnessService = new NYCDataFreshnessService(nycApiToken);

    switch (action) {
      case 'updateSettings':
        if (!dataset) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Dataset is required' } },
            { status: 400 }
          );
        }

        // Update freshness monitoring settings for a dataset
        await prisma.nYCDataFreshness.update({
          where: { datasetId: dataset },
          data: {
            autoSyncEnabled: settings?.autoSyncEnabled,
            checkInterval: settings?.checkInterval,
            priority: settings?.priority,
            updatedAt: new Date()
          }
        });

        return NextResponse.json({
          success: true,
          data: {
            message: `Settings updated for ${dataset}`,
            dataset,
            settings
          }
        });

      case 'runCheck':
        // Manually trigger freshness check
        if (dataset) {
          const result = await freshnessService.checkDatasetFreshness(dataset);
          await freshnessService.updateFreshnessStatus(dataset, result);
          
          return NextResponse.json({
            success: true,
            data: {
              result,
              message: `Freshness check completed for ${dataset}`
            }
          });
        } else {
          const checkResult = await freshnessService.runFreshnessCheck();
          
          return NextResponse.json({
            success: true,
            data: {
              updated: checkResult.updated,
              errors: checkResult.errors,
              message: `Freshness check completed for all datasets`
            }
          });
        }

      case 'initialize':
        // Initialize freshness tracking for all datasets
        await freshnessService.initializeFreshnessTracking();
        
        return NextResponse.json({
          success: true,
          data: {
            message: 'Freshness tracking initialized for all datasets'
          }
        });

      default:
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Unknown action: ${action}` } },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('NYC data freshness management error:', error);
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