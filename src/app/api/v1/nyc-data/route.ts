import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { NYCDataIngestionService } from '@/lib/services/nyc-data-ingestion-service';
import { DynamicDatasetRepository } from '@/lib/repositories/dynamic-dataset-repository';
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
      // Map dataset to ID and name for progress tracking (only existing datasets)
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
          fromDate: fullSync ? undefined : (await ingestionService.getLastSyncDate('usep-8jbt')) || undefined,
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestPropertySales(payload.userId, salesOptions);
        break;

      case 'dob_permits':
        const permitsOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : (await ingestionService.getLastSyncDate('dq6g-a4sc')) || undefined,
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestDOBPermits(payload.userId, permitsOptions);
        break;


      case 'dob_violations':
        const violationsOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : (await ingestionService.getLastSyncDate('3h2n-5cm9')) || undefined,
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestDOBViolations(payload.userId, violationsOptions);
        break;

      case 'build_job_filings':
        const buildOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : (await ingestionService.getLastSyncDate('w9ak-ipjd')) || undefined,
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestBuildJobFilings(payload.userId, buildOptions);
        break;

      case 'housing_maintenance_violations':
        const housingOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : (await ingestionService.getLastSyncDate('wvxf-dwi5')) || undefined,
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestHousingMaintenanceViolations(payload.userId, housingOptions);
        break;

      case 'complaint_data':
        const complaintOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : (await ingestionService.getLastSyncDate('qgea-i56i')) || undefined,
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestComplaintData(payload.userId, complaintOptions);
        break;

      case 'tax_debt_data':
        const taxDebtOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : (await ingestionService.getLastSyncDate('9rz4-mjek')) || undefined,
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestTaxDebtData(payload.userId, taxDebtOptions);
        break;

      case 'business_licenses':
        const businessOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : (await ingestionService.getLastSyncDate('w7w3-xahh')) || undefined,
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestBusinessLicenses(payload.userId, businessOptions);
        break;

      case 'event_permits':
        const eventOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : (await ingestionService.getLastSyncDate('tg4x-b46p')) || undefined,
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestEventPermits(payload.userId, eventOptions);
        break;

      case 'restaurant_inspections':
        const restaurantOptions = {
          fullSync,
          limit: limit ? parseInt(limit) : undefined,
          fromDate: fullSync ? undefined : (await ingestionService.getLastSyncDate('43nn-pn8j')) || undefined,
          memoryOptimized,
          sessionId
        };
        
        result = await ingestionService.ingestRestaurantInspections(payload.userId, restaurantOptions);
        break;
        
      default:
        // Check if this is a discovered dataset that needs dynamic processing
        const discoveredDataset = await prisma.datasetConfiguration.findUnique({
          where: { datasetId: dataset },
          include: {
            fieldSchemas: true
          }
        });

        if (discoveredDataset && !discoveredDataset.isBuiltIn) {
          console.log(`🔍 Processing discovered dataset: ${discoveredDataset.datasetName}`);
          
          // Use DynamicDatasetRepository for discovered datasets
          const dynamicRepo = new DynamicDatasetRepository();
          
          try {
            // For now, just return a placeholder response
            // TODO: Implement actual data ingestion for discovered datasets
            result = {
              success: true,
              datasetId: discoveredDataset.datasetId,
              datasetName: discoveredDataset.datasetName,
              message: 'Dynamic dataset processing not yet implemented',
              tableName: discoveredDataset.tableName,
              recordsProcessed: 0,
              recordsInserted: 0,
              errors: ['Dynamic dataset ingestion coming soon']
            };
          } catch (error) {
            console.error(`Error processing discovered dataset ${dataset}:`, error);
            return NextResponse.json(
              { 
                success: false, 
                error: { 
                  code: 'PROCESSING_ERROR', 
                  message: `Failed to process discovered dataset: ${error instanceof Error ? error.message : 'Unknown error'}` 
                } 
              },
              { status: 500 }
            );
          }
        } else {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: `Unsupported dataset: ${dataset}` } },
            { status: 400 }
          );
        }
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

    // Define dataset to table mapping (only include tables that actually exist)
    const datasetTableMap: Record<string, { table: string; countQuery: string }> = {
      'usep-8jbt': { table: 'nyc_property_sales', countQuery: 'SELECT COUNT(*) as count FROM nyc_property_sales' },
      'dq6g-a4sc': { table: 'nyc_dob_permits', countQuery: 'SELECT COUNT(*) as count FROM nyc_dob_permits' },
      '3h2n-5cm9': { table: 'nyc_dob_violations', countQuery: 'SELECT COUNT(*) as count FROM nyc_dob_violations' },
      'w9ak-ipjd': { table: 'nyc_build_job_filings', countQuery: 'SELECT COUNT(*) as count FROM nyc_build_job_filings' },
      'wvxf-dwi5': { table: 'nyc_housing_violations', countQuery: 'SELECT COUNT(*) as count FROM nyc_housing_violations' },
      'qgea-i56i': { table: 'nyc_complaint_data', countQuery: 'SELECT COUNT(*) as count FROM nyc_complaint_data' },
      '9rz4-mjek': { table: 'nyc_tax_debt_data', countQuery: 'SELECT COUNT(*) as count FROM nyc_tax_debt_data' },
      'w7w3-xahh': { table: 'nyc_business_licenses', countQuery: 'SELECT COUNT(*) as count FROM nyc_business_licenses' },
      'tg4x-b46p': { table: 'nyc_event_permits', countQuery: 'SELECT COUNT(*) as count FROM nyc_event_permits' },
      '43nn-pn8j': { table: 'nyc_restaurant_inspections', countQuery: 'SELECT COUNT(*) as count FROM nyc_restaurant_inspections' }
    };

    // Fetch NYC Open Data counts
    const nycCounts: Record<string, number> = {};
    const fetchNYCCount = async (datasetId: string) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(`https://data.cityofnewyork.us/resource/${datasetId}.json?$select=count(*)`, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'RE-Platform/1.0 (+https://re-platform.com/api)'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        return parseInt(data[0]?.count || 0);
      } catch (error) {
        console.error(`Error fetching count for ${datasetId}:`, error instanceof Error ? error.message : error);
        return 0;
      }
    };

    // Get database counts with graceful error handling
    const dbCounts: Record<string, number> = {};
    for (const [datasetId, tableInfo] of Object.entries(datasetTableMap)) {
      try {
        const result: any[] = await prisma.$queryRawUnsafe(tableInfo.countQuery);
        dbCounts[datasetId] = parseInt(result[0]?.count || 0);
        console.log(`✅ ${tableInfo.table}: ${dbCounts[datasetId]} records`);
      } catch (error) {
        console.error(`❌ Error getting count for ${tableInfo.table}:`, error instanceof Error ? error.message : error);
        dbCounts[datasetId] = 0;
        // Don't crash the entire endpoint - just log and continue
      }
    }

    // Fetch NYC counts in parallel with better error handling
    const nycCountPromises = Object.keys(datasetTableMap).map(async (datasetId) => {
      try {
        nycCounts[datasetId] = await fetchNYCCount(datasetId);
      } catch (error) {
        console.error(`Failed to fetch count for dataset ${datasetId}:`, error);
        nycCounts[datasetId] = 0; // Set to 0 instead of failing the entire request
      }
    });
    await Promise.all(nycCountPromises);

    // Get built-in datasets (only include those with existing tables)
    const builtInDatasets = [
      { id: 'usep-8jbt', name: 'NYC Citywide Rolling Calendar Sales', key: 'property_sales', isBuiltIn: true },
      { id: 'w9ak-ipjd', name: 'DOB Job Application Filings', key: 'build_job_filings', isBuiltIn: true },
      { id: 'wvxf-dwi5', name: 'Housing Maintenance Code Violations', key: 'housing_maintenance_violations', isBuiltIn: true },
      { id: 'qgea-i56i', name: 'NYPD Complaint Data', key: 'complaint_data', isBuiltIn: true },
      { id: 'dq6g-a4sc', name: 'DOB NOW: All Approved Permits', key: 'dob_permits', isBuiltIn: true },
      { id: '9rz4-mjek', name: 'Tax Debt/Water Debt Data', key: 'tax_debt_data', isBuiltIn: true },
      { id: 'w7w3-xahh', name: 'Business Licenses', key: 'business_licenses', isBuiltIn: true },
      { id: '3h2n-5cm9', name: 'DOB Violations', key: 'dob_violations', isBuiltIn: true },
      { id: 'tg4x-b46p', name: 'Event Permits', key: 'event_permits', isBuiltIn: true },
      { id: '43nn-pn8j', name: 'Restaurant Inspections', key: 'restaurant_inspections', isBuiltIn: true }
    ];

    // Get discovered datasets from database
    const discoveredDatasets = await prisma.datasetConfiguration.findMany({
      where: { 
        isActive: true,
        isBuiltIn: false 
      },
      select: {
        datasetId: true,
        datasetName: true,
        tableName: true,
        approvalStatus: true,
        syncEnabled: true
      }
    });

    // Combine built-in and discovered datasets
    const allDiscoveredDatasets = discoveredDatasets.map(ds => ({
      id: ds.datasetId,
      name: ds.datasetName,
      key: ds.datasetId, // Use datasetId as key for discovered datasets
      isBuiltIn: false,
      tableName: ds.tableName,
      approvalStatus: ds.approvalStatus,
      syncEnabled: ds.syncEnabled
    }));

    // Combine datasets and deduplicate by ID (built-in datasets take precedence)
    const datasetsMap = new Map();
    
    // Add built-in datasets first (they take precedence)
    builtInDatasets.forEach(ds => datasetsMap.set(ds.id, ds));
    
    // Add discovered datasets only if they don't conflict with built-in ones
    allDiscoveredDatasets.forEach(ds => {
      if (!datasetsMap.has(ds.id)) {
        datasetsMap.set(ds.id, ds);
      }
    });
    
    const datasets = Array.from(datasetsMap.values());

    const datasetStatus = await Promise.all(
      datasets.map(async (ds) => {
        const dbCount = dbCounts[ds.id] || 0;
        const nycCount = nycCounts[ds.id] || 0;
        const percentageComplete = nycCount > 0 ? (dbCount / nycCount) * 100 : 0;
        
        // Built-in datasets have specific implementation logic
        const isImplemented = ds.isBuiltIn ? [
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
        ].includes(ds.key) : (ds as any).approvalStatus === 'APPROVED';

        return {
          ...ds,
          lastSync: await ingestionService.getLastSyncDate(ds.id),
          implemented: isImplemented,
          dbCount,
          nycCount,
          percentageComplete: Math.round(percentageComplete * 100) / 100,
          syncStatus: ds.isBuiltIn ? 
            (percentageComplete >= 99 ? 'complete' : (dbCount > 0 ? 'partial' : 'not_synced')) :
            (ds as any).approvalStatus === 'PENDING' ? 'pending_approval' : 
            (ds as any).syncEnabled ? 
              (percentageComplete >= 99 ? 'complete' : (dbCount > 0 ? 'partial' : 'not_synced')) : 
              'disabled',
          missingRecords: Math.max(0, nycCount - dbCount)
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        available_datasets: datasetStatus,
        total_count: datasets.length,
        implemented_count: datasetStatus.filter(ds => ds.implemented).length,
        built_in_count: datasetStatus.filter(ds => ds.isBuiltIn).length,
        discovered_count: datasetStatus.filter(ds => !ds.isBuiltIn).length,
        pending_approval_count: datasetStatus.filter(ds => !ds.isBuiltIn && (ds as any).approvalStatus === 'PENDING').length
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