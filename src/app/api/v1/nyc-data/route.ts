import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { NYCDataIngestionService } from '@/lib/services/nyc-data-ingestion-service';
import { prisma } from '@/lib/db';

// Helper function to get last sync time
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
    const { dataset, fullSync = false, limit } = body;

    if (!dataset) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Dataset is required' } },
        { status: 400 }
      );
    }

    // Initialize the ingestion service
    const nycApiToken = process.env.NYC_OPENDATA_API_KEY;
    const ingestionService = new NYCDataIngestionService(nycApiToken);

    let result;

    // Handle different dataset types
    switch (dataset) {
      case 'property_sales':
        const salesOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('usep-8jbt')
        };
        
        result = await ingestionService.ingestPropertySales(payload.userId, salesOptions);
        break;

      case 'dob_permits':
        const permitsOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('dq6g-a4sc')
        };
        
        result = await ingestionService.ingestDOBPermits(payload.userId, permitsOptions);
        break;

      case 'dob_violations':
        const violationsOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('3h2n-5cm9')
        };
        
        result = await ingestionService.ingestDOBViolations(payload.userId, violationsOptions);
        break;

      case 'property_valuation_2024':
        const val2024Options = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('rbx6-tga4')
        };
        
        result = await ingestionService.ingestPropertyValuation2024(payload.userId, val2024Options);
        break;

      case 'property_valuation_2023':
        const val2023Options = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('6z8x-wfk4')
        };
        
        result = await ingestionService.ingestPropertyValuation2023(payload.userId, val2023Options);
        break;

      case 'complaint_data':
        const complaintOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('qgea-i56i')
        };
        
        result = await ingestionService.ingestComplaintData(payload.userId, complaintOptions);
        break;

      case 'tax_debt_data':
        const taxDebtOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('9rz4-mjek')
        };
        
        result = await ingestionService.ingestTaxDebtData(payload.userId, taxDebtOptions);
        break;

      case 'business_licenses':
        const businessOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('w7w3-xahh')
        };
        
        result = await ingestionService.ingestBusinessLicenses(payload.userId, businessOptions);
        break;

      case 'event_permits':
        const eventOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('tg4x-b46p')
        };
        
        result = await ingestionService.ingestEventPermits(payload.userId, eventOptions);
        break;

      case 'build_job_filings':
        const buildOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('w9ak-ipjd')
        };
        
        result = await ingestionService.ingestBuildJobFilings(payload.userId, buildOptions);
        break;

      case 'restaurant_inspections':
        const restaurantOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : await ingestionService.getLastSyncDate('43nn-pn8j')
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
    const ingestionService = new NYCDataIngestionService(nycApiToken);

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

    // Define dataset to table mapping
    const datasetTableMap: Record<string, { table: string; countQuery: string }> = {
      'usep-8jbt': { table: 'nyc_property_sales', countQuery: 'SELECT COUNT(*) as count FROM nyc_property_sales' },
      'dq6g-a4sc': { table: 'nyc_dob_permits', countQuery: 'SELECT COUNT(*) as count FROM "NYCDOBPermit"' },
      '3h2n-5cm9': { table: 'nyc_dob_violations', countQuery: 'SELECT COUNT(*) as count FROM "NYCDOBViolation"' },
      'rbx6-tga4': { table: 'nyc_property_valuation_2024', countQuery: 'SELECT COUNT(*) as count FROM nyc_property_valuation_2024' },
      '6z8x-wfk4': { table: 'nyc_property_valuation_2023', countQuery: 'SELECT COUNT(*) as count FROM nyc_property_valuation_2023' },
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

    // Return available datasets and their status
    const datasets = [
      { id: 'usep-8jbt', name: 'NYC Property Sales', key: 'property_sales' },
      { id: 'rbx6-tga4', name: 'DOB NOW: Build – Approved Permits', key: 'property_valuation_2024' },
      { id: '6z8x-wfk4', name: 'Evictions', key: 'property_valuation_2023' },
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