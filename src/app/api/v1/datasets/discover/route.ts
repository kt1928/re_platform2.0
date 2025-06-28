import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { NYCDatasetDiscoveryService } from '@/lib/services/nyc-dataset-discovery-service';

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
    const action = searchParams.get('action') || 'search';

    const discoveryService = new NYCDatasetDiscoveryService();

    switch (action) {
      case 'search': {
        // Search for datasets with filters
        const filters = {
          query: searchParams.get('query') || undefined,
          category: searchParams.get('category') || undefined,
          tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
          minRecords: searchParams.get('minRecords') ? parseInt(searchParams.get('minRecords')!) : undefined,
          maxRecords: searchParams.get('maxRecords') ? parseInt(searchParams.get('maxRecords')!) : undefined,
          limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20,
          offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0
        };

        const results = await discoveryService.searchDatasets(filters);
        
        return NextResponse.json({
          success: true,
          data: {
            ...results,
            filters: filters
          },
          meta: {
            timestamp: new Date().toISOString(),
            version: '1.0',
            request_id: crypto.randomUUID()
          }
        });
      }

      case 'recommended': {
        // Get recommended real estate datasets
        const recommended = await discoveryService.getRecommendedDatasets();
        
        return NextResponse.json({
          success: true,
          data: {
            datasets: recommended,
            count: recommended.length,
            message: 'Real estate relevant datasets'
          }
        });
      }

      case 'details': {
        // Get detailed information about a specific dataset
        const datasetId = searchParams.get('id');
        if (!datasetId) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Dataset ID is required' } },
            { status: 400 }
          );
        }

        const details = await discoveryService.getDatasetDetails(datasetId);
        if (!details) {
          return NextResponse.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Dataset not found' } },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          data: {
            dataset: details
          }
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Unknown action: ${action}` } },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Dataset discovery error:', error);
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