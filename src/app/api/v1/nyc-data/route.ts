import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { NYCDataIngestionService } from '@/lib/services/nyc-data-ingestion-service';
import { prisma } from '@/lib/db';
import { progressStore } from '@/app/api/v1/nyc-data/sync-progress/route';

// Helper function to get last sync time (currently unused but may be needed)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function getLastSyncTime(datasetId: string): Promise<string | null> {
  try {
    const lastSync = await prisma.nYCDataSyncLog.findFirst({
      where: { 
        datasetId,
        status: { in: ['success', 'partial'] }
      },
      orderBy: { endTime: 'desc' },
      select: { endTime: true }
    });
    return lastSync?.endTime?.toISOString() || null;
  } catch (error) {
    console.error(`Error getting last sync time for ${datasetId}:`, error);
    return null;
  }
}

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
    const payload = verifyToken(token);
    
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { dataset, fullSync = false, limit, memoryOptimized = false, sessionId } = body;

    if (!dataset) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Dataset is required' } },
        { status: 400 }
      );
    }

    // Initialize progress tracking if sessionId provided
    if (sessionId) {
      // Map dataset to ID and name for progress tracking (corrected mappings)
      const datasetMap: Record<string, { id: string; name: string }> = {
        'property_sales': { id: 'usep-8jbt', name: 'NYC Citywide Rolling Calendar Sales' },
        'dob_permits': { id: 'dq6g-a4sc', name: 'DOB NOW: All Approved Permits' },
        'dob_violations': { id: '3h2n-5cm9', name: 'DOB Violations' },
        'build_job_filings': { id: 'w9ak-ipjd', name: 'DOB Job Application Filings' },
        'housing_maintenance_violations': { id: 'wvxf-dwi5', name: 'Housing Maintenance Code Violations' },
        'complaint_data': { id: 'qgea-i56i', name: 'NYPD Complaint Data' },
        'tax_debt_data': { id: '9rz4-mjek', name: 'Tax Debt/Water Debt Data' },
        'business_licenses': { id: 'w7w3-xahh', name: 'Business Licenses' },
        'event_permits': { id: 'tg4x-b46p', name: 'Event Permits' },
        'build_job_filings': { id: 'w9ak-ipjd', name: 'DOB Job Filings' },
        'restaurant_inspections': { id: '43nn-pn8j', name: 'Restaurant Inspections' }
      };
      
      const datasetInfo = datasetMap[dataset];
      if (datasetInfo) {
        progressStore.createSession(sessionId, datasetInfo.id, datasetInfo.name);
      }
    }

    // Initialize the ingestion service with auth token for progress updates
    const nycApiToken = process.env.NYC_OPENDATA_API_KEY;
    const ingestionService = new NYCDataIngestionService(nycApiToken, token);

    let result;

    // Handle different dataset types
    switch (dataset) {
      case 'property_sales':
        const salesOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('usep-8jbt'),
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestPropertySales(payload.userId, salesOptions);
        break;

      case 'dob_permits':
        const permitsOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('dq6g-a4sc'),
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestDOBPermits(payload.userId, permitsOptions);
        break;

      case 'dob_violations':
        const violationsOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('3h2n-5cm9'),
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestDOBViolations(payload.userId, violationsOptions);
        break;

      case 'build_job_filings':
        const buildOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('w9ak-ipjd'),
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestBuildJobFilings(payload.userId, buildOptions);
        break;

      case 'housing_maintenance_violations':
        const housingOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('wvxf-dwi5'),
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestHousingMaintenanceViolations(payload.userId, housingOptions);
        break;

      case 'complaint_data':
        const complaintOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('qgea-i56i'),
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestComplaintData(payload.userId, complaintOptions);
        break;

      case 'tax_debt_data':
        const taxDebtOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('9rz4-mjek'),
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestTaxDebtData(payload.userId, taxDebtOptions);
        break;

      case 'business_licenses':
        const businessOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('w7w3-xahh'),
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestBusinessLicenses(payload.userId, businessOptions);
        break;

      case 'event_permits':
        const eventOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('tg4x-b46p'),
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestEventPermits(payload.userId, eventOptions);
        break;

      case 'restaurant_inspections':
        const restaurantOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('43nn-pn8j'),
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestRestaurantInspections(payload.userId, restaurantOptions);
        break;
        
      default:
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Unsupported dataset: ${dataset}` } },
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
    console.error('NYC data ingestion error:', error);
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
    const payload = verifyToken(token);
    
    if (!payload) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Invalid token' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dataset = searchParams.get('dataset');
    const limit = searchParams.get('limit');

    // Initialize the service
    const nycApiToken = process.env.NYC_OPENDATA_API_KEY;
    const ingestionService = new NYCDataIngestionService(nycApiToken, token);

    if (dataset) {
      // Get last sync info for specific dataset
      const lastSync = await ingestionService.getLastSyncDate(dataset);
      
      return NextResponse.json({
        success: true,
        data: {
          dataset,
          lastSync,
          status: lastSync ? 'previously_synced' : 'never_synced'
        }
      });
    }

    // Define dataset to table mapping (corrected dataset IDs)
    const datasetTableMap: Record<string, { table: string; countQuery: string }> = {
      'usep-8jbt': { table: 'nyc_property_sales', countQuery: 'SELECT COUNT(*) as count FROM nyc_property_sales' },
      'dq6g-a4sc': { table: 'nyc_dob_permits', countQuery: 'SELECT COUNT(*) as count FROM nyc_dob_permits' },
      '3h2n-5cm9': { table: 'nyc_dob_violations', countQuery: 'SELECT COUNT(*) as count FROM nyc_dob_violations' },
      'w9ak-ipjd': { table: 'nyc_build_job_filings', countQuery: 'SELECT COUNT(*) as count FROM nyc_build_job_filings' },
      'wvxf-dwi5': { table: 'nyc_housing_maintenance_violations', countQuery: 'SELECT COUNT(*) as count FROM nyc_housing_maintenance_violations' },
      'qgea-i56i': { table: 'nyc_complaint_data', countQuery: 'SELECT COUNT(*) as count FROM nyc_complaint_data' },
      '9rz4-mjek': { table: 'nyc_tax_debt_data', countQuery: 'SELECT COUNT(*) as count FROM nyc_tax_debt_data' },
      'w7w3-xahh': { table: 'nyc_business_licenses', countQuery: 'SELECT COUNT(*) as count FROM nyc_business_licenses' },
      'tg4x-b46p': { table: 'nyc_event_permits', countQuery: 'SELECT COUNT(*) as count FROM nyc_event_permits' },
      'w9ak-ipjd': { table: 'nyc_build_job_filings', countQuery: 'SELECT COUNT(*) as count FROM nyc_build_job_filings' },
      '43nn-pn8j': { table: 'nyc_restaurant_inspections', countQuery: 'SELECT COUNT(*) as count FROM nyc_restaurant_inspections' }
    };

    // Fetch NYC Open Data counts
    const nycCounts: Record<string, number> = {};
    const fetchNYCCount = async (datasetId: string) => {
      try {
        const response = await fetch(`https://data.cityofnewyork.us/resource/${datasetId}.json?$select=count(*)`);
        const data = await response.json();
        return parseInt(data[0]?.count || 0);
      } catch (error) {
        console.error(`Error fetching count for ${datasetId}:`, error);
        return 0;
      }
    };

    // Get database counts
    const dbCounts: Record<string, number> = {};
    for (const [datasetId, tableInfo] of Object.entries(datasetTableMap)) {
      try {
        const result: any[] = await prisma.$queryRawUnsafe(tableInfo.countQuery);
        dbCounts[datasetId] = parseInt(result[0]?.count || 0);
      } catch (error) {
        console.error(`Error getting count for ${tableInfo.table}:`, error);
        dbCounts[datasetId] = 0;
      }
    }

    // Fetch NYC counts in parallel
    const nycCountPromises = Object.keys(datasetTableMap).map(async (datasetId) => {
      nycCounts[datasetId] = await fetchNYCCount(datasetId);
    });
    await Promise.all(nycCountPromises);

    // Return available datasets and their status (corrected dataset IDs and names)
    const datasets = [
      { id: 'usep-8jbt', name: 'NYC Citywide Rolling Calendar Sales', key: 'property_sales' },
      { id: 'w9ak-ipjd', name: 'DOB Job Application Filings', key: 'build_job_filings' },
      { id: 'wvxf-dwi5', name: 'Housing Maintenance Code Violations', key: 'housing_maintenance_violations' },
      { id: 'qgea-i56i', name: 'NYPD Complaint Data', key: 'complaint_data' },
      { id: 'dq6g-a4sc', name: 'DOB NOW: All Approved Permits', key: 'dob_permits' },
      { id: '9rz4-mjek', name: 'Tax Debt/Water Debt Data', key: 'tax_debt_data' },
      { id: 'w7w3-xahh', name: 'Business Licenses', key: 'business_licenses' },
      { id: '3h2n-5cm9', name: 'DOB Violations', key: 'dob_violations' },
      { id: 'tg4x-b46p', name: 'Event Permits', key: 'event_permits' },
      { id: 'w9ak-ipjd', name: 'DOB Job Filings', key: 'build_job_filings' },
      { id: '43nn-pn8j', name: 'Restaurant Inspections', key: 'restaurant_inspections' }
    ];

    const datasetStatus = await Promise.all(
      datasets.map(async (ds) => {
        const dbCount = dbCounts[ds.id] || 0;
        const nycCount = nycCounts[ds.id] || 0;
        const percentageComplete = nycCount > 0 ? (dbCount / nycCount) * 100 : 0;
        
        return {
          ...ds,
          lastSync: await ingestionService.getLastSyncDate(ds.id),
          implemented: [
            'property_sales', 
            'dob_permits', 
            'dob_violations',
            'property_valuation_2024',
            'property_valuation_2023', 
            'complaint_data',
            'tax_debt_data',
            'business_licenses',
            'event_permits',
            'build_job_filings',
            'restaurant_inspections'
          ].includes(ds.key),
          dbCount,
          nycCount,
          percentageComplete: Math.round(percentageComplete * 100) / 100,
          syncStatus: percentageComplete >= 99 ? 'complete' : (dbCount > 0 ? 'partial' : 'not_synced'),
          missingRecords: Math.max(0, nycCount - dbCount)
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        available_datasets: datasetStatus,
        total_count: datasets.length,
        implemented_count: datasetStatus.filter(ds => ds.implemented).length
      }
    });

  } catch (error) {
    console.error('NYC data status error:', error);
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