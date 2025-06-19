import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { CensusDataIngestionService } from '@/lib/services/census-data-ingestion-service';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
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
    let payload;
    
    try {
      payload = verifyToken(token);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
        { status: 401 }
      );
    }
    
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, year, state, options = {} } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Action is required' } },
        { status: 400 }
      );
    }

    // Initialize the ingestion service
    const censusApiKey = process.env.CENSUS_API_KEY;
    const ingestionService = new CensusDataIngestionService(censusApiKey);

    let result;

    switch (action) {
      case 'ingest_zip_code_data':
        if (!year) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Year is required for ingestion' } },
            { status: 400 }
          );
        }

        console.log(`Starting Census ZIP code data ingestion for year ${year}${state ? ` (state: ${state})` : ''}`);
        
        result = await ingestionService.ingestZipCodeData(
          parseInt(year),
          state,
          {
            batchSize: options.batchSize || 1000,
            maxRecords: options.maxRecords
          }
        );
        break;

      case 'test_connection':
        const isConnected = await ingestionService.testConnection();
        return NextResponse.json({
          success: true,
          data: {
            connected: isConnected,
            message: isConnected ? 'Census API connection successful' : 'Census API connection failed'
          }
        });

      default:
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Unsupported action: ${action}` } },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        timestamp: new Date().toISOString(),
        version: '1.0',
        request_id: crypto.randomUUID()
      }
    });

  } catch (error) {
    console.error('Census data API error:', error);
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
    let payload;
    
    try {
      payload = verifyToken(token);
    } catch (error) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
        { status: 401 }
      );
    }
    
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Initialize the ingestion service
    const censusApiKey = process.env.CENSUS_API_KEY;
    const ingestionService = new CensusDataIngestionService(censusApiKey);

    if (action === 'get_sync_logs') {
      const year = searchParams.get('year');
      const geography = searchParams.get('geography');
      const status = searchParams.get('status');
      const limit = parseInt(searchParams.get('limit') || '50');
      const offset = parseInt(searchParams.get('offset') || '0');

      const filters = {
        year: year ? parseInt(year) : undefined,
        geography: geography || undefined,
        status: status || undefined,
        limit,
        offset
      };

      const result = await ingestionService.getSyncLogs(filters);
      return NextResponse.json({
        success: true,
        data: result
      });
    }

    // Get available years and current data status
    const availableYears = ingestionService.getAvailableYears();
    const stateCodes = ingestionService.getStateFipsCodes();
    const dataCounts = await ingestionService.getDataCounts();

    // Get last sync info for each year
    const lastSyncs: Record<number, Date | null> = {};
    for (const year of availableYears.slice(-5)) { // Only check last 5 years
      lastSyncs[year] = await ingestionService.getLastSyncInfo(year);
    }

    // Get total ZIP codes count
    const totalZipCodes = await prisma.censusZipCodeData.count();

    return NextResponse.json({
      success: true,
      data: {
        available_years: availableYears,
        state_codes: stateCodes,
        data_counts: dataCounts,
        last_syncs: lastSyncs,
        total_zip_codes: totalZipCodes,
        api_connection_required: !process.env.CENSUS_API_KEY,
        status: 'ready'
      }
    });

  } catch (error) {
    console.error('Census data status error:', error);
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