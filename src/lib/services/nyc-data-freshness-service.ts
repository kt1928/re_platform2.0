import { prisma } from '@/lib/db';
import { NYCOpenDataClient, NYC_DATASETS } from '@/lib/data-sources/nyc-open-data';

export interface DatasetFreshnessInfo {
  datasetId: string;
  datasetName: string;
  nycLastModified: Date | null;
  nycRecordCount: number | null;
  ourLastSync: Date | null;
  ourRecordCount: number | null;
  freshnessScore: number;
  isStale: boolean;
  staleSince: Date | null;
  recommendSync: boolean;
  syncSuccessRate: number | null;
  priority: number;
}

export interface FreshnessCheckResult {
  datasetId: string;
  nycLastModified: Date | null;
  nycRecordCount: number | null;
  nycDataVersion: string | null;
  freshnessScore: number;
  isStale: boolean;
  recommendSync: boolean;
  staleDays: number;
}

export class NYCDataFreshnessService {
  private client: NYCOpenDataClient;

  constructor(appToken?: string) {
    this.client = new NYCOpenDataClient(appToken);
    
    // Log initialization with token status
    if (appToken) {
      console.log('NYC Data Freshness Service initialized with app token (higher rate limits)');
    } else {
      console.log('NYC Data Freshness Service initialized without app token (basic rate limits)');
      console.log('Consider setting NYC_OPEN_DATA_APP_TOKEN environment variable for better performance');
    }
  }

  /**
   * Check freshness of a specific dataset against NYC Open Data
   */
  async checkDatasetFreshness(datasetId: string): Promise<FreshnessCheckResult> {
    try {
      // Get NYC Open Data metadata
      const nycMetadata = await this.fetchNYCDatasetMetadata(datasetId);
      
      // Get our current sync status
      const ourStatus = await this.getOurDatasetStatus(datasetId);
      
      // Calculate freshness metrics
      const freshnessScore = this.calculateFreshnessScore(nycMetadata, ourStatus);
      const staleDays = this.calculateStaleDays(nycMetadata.lastModified, ourStatus.lastSync);
      const isStale = staleDays > 7; // Consider stale if >7 days behind
      const recommendSync = this.shouldRecommendSync(nycMetadata, ourStatus, staleDays, datasetId);

      return {
        datasetId,
        nycLastModified: nycMetadata.lastModified,
        nycRecordCount: nycMetadata.recordCount,
        nycDataVersion: nycMetadata.version,
        freshnessScore,
        isStale,
        recommendSync,
        staleDays
      };
    } catch (error) {
      console.error(`Error checking freshness for dataset ${datasetId}:`, error);
      return {
        datasetId,
        nycLastModified: null,
        nycRecordCount: null,
        nycDataVersion: null,
        freshnessScore: 0,
        isStale: true,
        recommendSync: true,
        staleDays: 999
      };
    }
  }

  /**
   * Check freshness for all datasets with proper error isolation
   */
  async checkAllDatasetsFreshness(): Promise<FreshnessCheckResult[]> {
    // Get dataset IDs from both static and dynamic configurations
    const staticDatasetIds = Object.values(NYC_DATASETS).map(dataset => dataset.id);
    
    // Also check configured datasets from database
    const configuredDatasets = await prisma.datasetConfiguration.findMany({
      where: { isActive: true },
      select: { datasetId: true }
    });
    
    const allDatasetIds = [
      ...staticDatasetIds,
      ...configuredDatasets.map(ds => ds.datasetId)
    ].filter((id, index, array) => array.indexOf(id) === index); // Remove duplicates
    
    console.log(`Checking freshness for ${allDatasetIds.length} datasets...`);
    
    // Process sequentially to avoid overwhelming the API
    const results: FreshnessCheckResult[] = [];
    
    for (const datasetId of allDatasetIds) {
      try {
        console.log(`Checking freshness for dataset: ${datasetId}`);
        const result = await this.checkDatasetFreshness(datasetId);
        results.push(result);
        
        // Add delay between checks to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to check freshness for ${datasetId}:`, error);
        // Add a failed result so we don't lose track of the dataset
        results.push({
          datasetId,
          nycLastModified: null,
          nycRecordCount: null,
          nycDataVersion: null,
          freshnessScore: 0,
          isStale: true,
          recommendSync: false, // Don't recommend sync if we can't check
          staleDays: 999
        });
      }
    }
    
    return results;
  }

  /**
   * Update freshness status in database
   */
  async updateFreshnessStatus(datasetId: string, result: FreshnessCheckResult): Promise<void> {
    const dataset = Object.values(NYC_DATASETS).find(ds => ds.id === datasetId);
    if (!dataset) {
      throw new Error(`Dataset not found: ${datasetId}`);
    }

    // Get our current data status
    const ourStatus = await this.getOurDatasetStatus(datasetId);

    await prisma.nYCDataFreshness.upsert({
      where: { datasetId },
      create: {
        datasetId,
        datasetName: dataset.name,
        nycLastModified: result.nycLastModified,
        nycRecordCount: result.nycRecordCount,
        nycDataVersion: result.nycDataVersion,
        ourLastSync: ourStatus.lastSync,
        ourRecordCount: ourStatus.recordCount,
        ourLastRecordDate: ourStatus.lastRecordDate,
        freshnessScore: result.freshnessScore,
        isStale: result.isStale,
        staleSince: result.isStale ? (ourStatus.staleSince || new Date()) : null,
        recommendSync: result.recommendSync,
        syncSuccessRate: ourStatus.successRate,
        avgSyncDuration: ourStatus.avgDuration,
        lastSyncStatus: ourStatus.lastStatus,
        priority: this.getDatasetPriority(datasetId)
      },
      update: {
        nycLastModified: result.nycLastModified,
        nycRecordCount: result.nycRecordCount,
        nycDataVersion: result.nycDataVersion,
        ourLastSync: ourStatus.lastSync,
        ourRecordCount: ourStatus.recordCount,
        ourLastRecordDate: ourStatus.lastRecordDate,
        freshnessScore: result.freshnessScore,
        isStale: result.isStale,
        staleSince: result.isStale ? (ourStatus.staleSince || new Date()) : null,
        recommendSync: result.recommendSync,
        syncSuccessRate: ourStatus.successRate,
        avgSyncDuration: ourStatus.avgDuration,
        lastSyncStatus: ourStatus.lastStatus,
        lastChecked: new Date()
      }
    });
  }

  /**
   * Get all freshness statuses from database
   */
  async getAllFreshnessStatuses(): Promise<DatasetFreshnessInfo[]> {
    const records = await prisma.nYCDataFreshness.findMany({
      orderBy: [
        { isStale: 'desc' },
        { priority: 'desc' },
        { datasetName: 'asc' }
      ]
    });

    return records.map(record => ({
      datasetId: record.datasetId,
      datasetName: record.datasetName,
      nycLastModified: record.nycLastModified,
      nycRecordCount: record.nycRecordCount,
      ourLastSync: record.ourLastSync,
      ourRecordCount: record.ourRecordCount,
      freshnessScore: record.freshnessScore,
      isStale: record.isStale,
      staleSince: record.staleSince,
      recommendSync: record.recommendSync,
      syncSuccessRate: record.syncSuccessRate ? Number(record.syncSuccessRate) : null,
      priority: record.priority
    }));
  }

  /**
   * Run freshness check for all datasets and update database with enhanced error handling
   */
  async runFreshnessCheck(): Promise<{ updated: number; errors: string[]; summary: { healthy: number; stale: number; failed: number } }> {
    console.log('🔍 Starting comprehensive freshness check for all NYC datasets...');
    
    // Check API health first
    const healthCheck = await this.client.healthCheck();
    if (!healthCheck.healthy) {
      console.warn(`⚠️ NYC Open Data API health check failed (${healthCheck.responseTime}ms): ${healthCheck.error}`);
      console.log('Proceeding with freshness check, but expect potential issues...');
    } else {
      console.log(`✅ NYC Open Data API is healthy (${healthCheck.responseTime}ms response time)`);
    }
    
    const startTime = Date.now();
    const results = await this.checkAllDatasetsFreshness();
    const errors: string[] = [];
    let updated = 0;
    let healthy = 0;
    let stale = 0;
    let failed = 0;

    console.log(`📊 Processing ${results.length} freshness check results...`);

    for (const result of results) {
      try {
        await this.updateFreshnessStatus(result.datasetId, result);
        updated++;
        
        // Track health statistics
        if (result.freshnessScore === 0) {
          failed++;
          console.log(`❌ Failed to check ${result.datasetId}`);
        } else if (result.isStale) {
          stale++;
          console.log(`⚠️ ${result.datasetId}: ${result.freshnessScore}% fresh (STALE)`);
        } else {
          healthy++;
          console.log(`✅ ${result.datasetId}: ${result.freshnessScore}% fresh`);
        }
      } catch (error) {
        const errorMsg = `Failed to update ${result.datasetId}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
        failed++;
      }
      
      // Add small delay between database updates
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`🔍 Freshness check complete in ${duration}s: ${updated} updated, ${errors.length} errors`);
    console.log(`📈 Health summary: ${healthy} healthy, ${stale} stale, ${failed} failed`);
    
    if (errors.length > 0) {
      console.log('🚨 Errors encountered:');
      errors.forEach(error => console.log(`   - ${error}`));
    }
    
    return { 
      updated, 
      errors, 
      summary: { healthy, stale, failed }
    };
  }

  /**
   * Get stale datasets that need syncing
   */
  async getStaleDatasets(): Promise<DatasetFreshnessInfo[]> {
    const records = await prisma.nYCDataFreshness.findMany({
      where: { isStale: true },
      orderBy: [
        { priority: 'desc' },
        { staleSince: 'asc' }
      ]
    });

    return records.map(record => ({
      datasetId: record.datasetId,
      datasetName: record.datasetName,
      nycLastModified: record.nycLastModified,
      nycRecordCount: record.nycRecordCount,
      ourLastSync: record.ourLastSync,
      ourRecordCount: record.ourRecordCount,
      freshnessScore: record.freshnessScore,
      isStale: record.isStale,
      staleSince: record.staleSince,
      recommendSync: record.recommendSync,
      syncSuccessRate: record.syncSuccessRate ? Number(record.syncSuccessRate) : null,
      priority: record.priority
    }));
  }

  /**
   * Fetch metadata from NYC Open Data API with enhanced error handling
   */
  private async fetchNYCDatasetMetadata(datasetId: string): Promise<{
    lastModified: Date | null;
    recordCount: number | null;
    version: string | null;
  }> {
    try {
      // Check NYC Open Data API health first
      const healthCheck = await this.client.healthCheck();
      if (!healthCheck.healthy) {
        console.warn(`NYC Open Data API health check failed: ${healthCheck.error}`);
        // Continue anyway, but log the issue
      }

      // Use the enhanced metadata method from the client
      const metadata = await this.client.getDatasetMetadata(datasetId);
      
      if (metadata.error) {
        console.warn(`Metadata fetch had issues for ${datasetId}: ${metadata.error}`);
      }

      return {
        lastModified: metadata.lastModified,
        recordCount: metadata.recordCount,
        version: metadata.updateFrequency
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching NYC metadata for ${datasetId}:`, errorMsg);
      
      // Provide more context for common errors
      if (errorMsg.includes('403') || errorMsg.includes('Access forbidden')) {
        console.error(`Dataset ${datasetId} may be private or require special permissions`);
      } else if (errorMsg.includes('404') || errorMsg.includes('not found')) {
        console.error(`Dataset ${datasetId} may have been removed or ID changed`);
      } else if (errorMsg.includes('429') || errorMsg.includes('Rate limit')) {
        console.error(`Rate limit exceeded for dataset ${datasetId} - consider using an app token`);
      }
      
      return {
        lastModified: null,
        recordCount: null,
        version: null
      };
    }
  }

  /**
   * Get our current dataset status from sync logs and record counts
   */
  private async getOurDatasetStatus(datasetId: string): Promise<{
    lastSync: Date | null;
    recordCount: number | null;
    lastRecordDate: Date | null;
    successRate: number | null;
    avgDuration: number | null;
    lastStatus: string | null;
    staleSince: Date | null;
  }> {
    // Get latest sync info
    const latestSync = await prisma.nYCDataSyncLog.findFirst({
      where: { datasetId },
      orderBy: { endTime: 'desc' }
    });

    // Get success rate from recent syncs (last 10)
    const recentSyncs = await prisma.nYCDataSyncLog.findMany({
      where: { datasetId },
      orderBy: { endTime: 'desc' },
      take: 10
    });

    const successCount = recentSyncs.filter(sync => sync.status === 'success').length;
    const successRate = recentSyncs.length > 0 ? (successCount / recentSyncs.length) * 100 : null;

    // Calculate average duration
    const durations = recentSyncs
      .filter(sync => sync.status === 'success')
      .map(sync => Math.round((sync.endTime.getTime() - sync.startTime.getTime()) / 1000));
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

    // Get record count from the appropriate table
    const recordCount = await this.getTableRecordCount(datasetId);

    // Check if currently stale
    const existing = await prisma.nYCDataFreshness.findUnique({
      where: { datasetId },
      select: { staleSince: true }
    });

    return {
      lastSync: latestSync?.endTime || null,
      recordCount,
      lastRecordDate: latestSync?.lastRecordDate || null,
      successRate,
      avgDuration,
      lastStatus: latestSync?.status || null,
      staleSince: existing?.staleSince || null
    };
  }

  /**
   * Get record count from the appropriate table
   */
  private async getTableRecordCount(datasetId: string): Promise<number | null> {
    const tableMap: Record<string, string> = {
      'usep-8jbt': 'nyc_property_sales',
      'dq6g-a4sc': 'nyc_dob_permits',
      '3h2n-5cm9': 'nyc_dob_violations',
      'w9ak-ipjd': 'nyc_build_job_filings',
      'wvxf-dwi5': 'nyc_housing_maintenance_violations',
      'qgea-i56i': 'nyc_complaint_data',
      '9rz4-mjek': 'nyc_tax_debt_data',
      'w7w3-xahh': 'nyc_business_licenses',
      'tg4x-b46p': 'nyc_event_permits',
      'w9ak-ipjd': 'nyc_build_job_filings',
      '43nn-pn8j': 'nyc_restaurant_inspections'
    };

    const tableName = tableMap[datasetId];
    if (!tableName) return null;

    try {
      const result: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${tableName}`);
      return parseInt(result[0]?.count || '0');
    } catch (error) {
      console.error(`Error getting count for ${tableName}:`, error);
      return null;
    }
  }

  /**
   * Calculate freshness score (0-100) - 100% time-based
   */
  private calculateFreshnessScore(
    nycMetadata: { lastModified: Date | null; recordCount: number | null },
    ourStatus: { lastSync: Date | null; recordCount: number | null }
  ): number {
    if (!nycMetadata.lastModified || !ourStatus.lastSync) {
      return 0; // No data to compare
    }

    const daysBehind = this.calculateStaleDays(nycMetadata.lastModified, ourStatus.lastSync);
    
    // Pure time-based freshness calculation with tiered penalties
    let score: number;
    
    if (daysBehind <= 0) {
      score = 100; // Perfect - we're up to date or ahead
    } else if (daysBehind <= 3) {
      score = 100 - (daysBehind * 3); // Light penalty: 97%, 94%, 91%
    } else if (daysBehind <= 7) {
      score = 91 - ((daysBehind - 3) * 5); // Medium penalty: 86%, 81%, 76%, 71%
    } else if (daysBehind <= 21) {
      score = 71 - ((daysBehind - 7) * 3); // Heavy penalty: 68%, 65%... down to 29%
    } else {
      score = Math.max(0, 29 - ((daysBehind - 21) * 2)); // Very heavy penalty
    }

    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Calculate days between NYC data update and our last sync
   */
  private calculateStaleDays(nycLastModified: Date | null, ourLastSync: Date | null): number {
    if (!nycLastModified || !ourLastSync) {
      return 999; // Assume very stale if we can't compare
    }

    // Calculate how many days behind we are
    // Positive number = we're behind, negative = we're ahead/up-to-date
    const diffMs = nycLastModified.getTime() - ourLastSync.getTime();
    const daysBehind = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    // Return 0 if we're up to date or ahead, otherwise return days behind
    return Math.max(0, daysBehind);
  }

  /**
   * Determine if we should recommend syncing - purely time-based
   */
  private shouldRecommendSync(
    nycMetadata: { lastModified: Date | null; recordCount: number | null },
    ourStatus: { lastSync: Date | null; recordCount: number | null; successRate: number | null },
    staleDays: number,
    datasetId?: string
  ): boolean {
    // Never recommend sync if we can't determine staleness
    if (!nycMetadata.lastModified || !ourStatus.lastSync) {
      return false;
    }
    
    // Get dataset priority to adjust thresholds
    const priority = datasetId ? this.getDatasetPriority(datasetId) : 50;
    
    // Priority-based staleness thresholds
    let staleThreshold: number;
    if (priority >= 90) {
      staleThreshold = 3; // High priority: recommend sync after 3 days
    } else if (priority >= 70) {
      staleThreshold = 7; // Medium priority: recommend sync after 7 days  
    } else {
      staleThreshold = 14; // Low priority: recommend sync after 14 days
    }
    
    // Always recommend if past threshold
    if (staleDays >= staleThreshold) return true;
    
    // Consider sync success rate for borderline cases
    const borderlineThreshold = Math.max(1, staleThreshold - 2);
    if (staleDays >= borderlineThreshold && (ourStatus.successRate || 0) > 85) {
      return true;
    }

    return false;
  }

  /**
   * Get priority score for dataset (1-100, higher = more important)
   */
  private getDatasetPriority(datasetId: string): number {
    const priorities: Record<string, number> = {
      'usep-8jbt': 95, // Property sales - critical for real estate
      'dq6g-a4sc': 85, // DOB permits - important for construction
      '3h2n-5cm9': 80, // DOB violations - important for safety
      'qgea-i56i': 70, // NYPD complaints - important for area analysis
      'w9ak-ipjd': 55, // Build job filings
      'wvxf-dwi5': 70, // Housing maintenance violations
      '9rz4-mjek': 60, // Tax debt
      'w7w3-xahh': 50, // Business licenses
      'tg4x-b46p': 40, // Event permits
      '43nn-pn8j': 45  // Restaurant inspections
    };

    return priorities[datasetId] || 50;
  }

  /**
   * Get comprehensive health metrics for all datasets
   */
  async getDatasetHealthMetrics(): Promise<{
    overallHealth: number;
    totalDatasets: number;
    healthyDatasets: number;
    staleDatasets: number;
    failingDatasets: number;
    avgSyncSuccess: number;
    totalRecords: number;
    lastSyncDuration: number;
    topConcerns: Array<{
      datasetId: string;
      datasetName: string;
      issue: string;
      severity: 'high' | 'medium' | 'low';
      priority: number;
    }>;
  }> {
    const freshness = await prisma.nYCDataFreshness.findMany();
    
    // Calculate overall metrics
    const totalDatasets = freshness.length;
    const healthyDatasets = freshness.filter(ds => ds.freshnessScore >= 70 && !ds.isStale).length;
    const staleDatasets = freshness.filter(ds => ds.isStale).length;
    const failingDatasets = freshness.filter(ds => (ds.syncSuccessRate || 0) < 50).length;
    
    const avgFreshness = freshness.length > 0 
      ? Math.round(freshness.reduce((sum, ds) => sum + ds.freshnessScore, 0) / freshness.length)
      : 0;
    
    const avgSyncSuccess = freshness.length > 0
      ? Math.round(freshness.reduce((sum, ds) => sum + Number(ds.syncSuccessRate || 0), 0) / freshness.length)
      : 0;

    const totalRecords = freshness.reduce((sum, ds) => sum + (ds.ourRecordCount || 0), 0);
    
    const lastSyncDuration = freshness.length > 0
      ? Math.round(freshness.reduce((sum, ds) => sum + (ds.avgSyncDuration || 0), 0) / freshness.length)
      : 0;

    // Calculate overall health score (0-100)
    const overallHealth = Math.round(
      (avgFreshness * 0.4) + 
      (avgSyncSuccess * 0.3) + 
      ((healthyDatasets / totalDatasets) * 100 * 0.3)
    );

    // Identify top concerns
    const topConcerns = [];
    
    for (const dataset of freshness) {
      if (dataset.isStale && dataset.priority > 80) {
        topConcerns.push({
          datasetId: dataset.datasetId,
          datasetName: dataset.datasetName,
          issue: `High priority dataset is stale (${dataset.freshnessScore}% fresh)`,
          severity: 'high' as const,
          priority: dataset.priority
        });
      } else if ((dataset.syncSuccessRate || 0) < 30) {
        topConcerns.push({
          datasetId: dataset.datasetId,
          datasetName: dataset.datasetName,
          issue: `Low sync success rate (${dataset.syncSuccessRate}%)`,
          severity: 'high' as const,
          priority: dataset.priority
        });
      } else if (dataset.isStale) {
        topConcerns.push({
          datasetId: dataset.datasetId,
          datasetName: dataset.datasetName,
          issue: `Dataset is stale (${dataset.freshnessScore}% fresh)`,
          severity: 'medium' as const,
          priority: dataset.priority
        });
      } else if (dataset.freshnessScore < 50) {
        topConcerns.push({
          datasetId: dataset.datasetId,
          datasetName: dataset.datasetName,
          issue: `Low freshness score (${dataset.freshnessScore}%)`,
          severity: 'medium' as const,
          priority: dataset.priority
        });
      }
    }

    // Sort concerns by severity and priority
    topConcerns.sort((a, b) => {
      const severityWeight = { high: 3, medium: 2, low: 1 };
      const severityDiff = severityWeight[b.severity] - severityWeight[a.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.priority - a.priority;
    });

    return {
      overallHealth,
      totalDatasets,
      healthyDatasets,
      staleDatasets,
      failingDatasets,
      avgSyncSuccess,
      totalRecords,
      lastSyncDuration,
      topConcerns: topConcerns.slice(0, 5) // Top 5 concerns
    };
  }

  /**
   * Get sync performance trends over time
   */
  async getSyncPerformanceTrends(): Promise<{
    last7Days: Array<{
      date: string;
      successfulSyncs: number;
      failedSyncs: number;
      avgDuration: number;
      recordsProcessed: number;
    }>;
    last30Days: {
      totalSyncs: number;
      successRate: number;
      avgDuration: number;
      totalRecordsProcessed: number;
      mostActiveDataset: string;
      problemDatasets: string[];
    };
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSyncs = await prisma.nYCDataSyncLog.findMany({
      where: {
        startTime: {
          gte: thirtyDaysAgo
        }
      },
      orderBy: { startTime: 'desc' }
    });

    // Group by day for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const last7DaysData = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const daysSyncs = recentSyncs.filter(sync => 
        sync.startTime.toISOString().split('T')[0] === dateStr
      );
      
      const successfulSyncs = daysSyncs.filter(sync => sync.status === 'success').length;
      const failedSyncs = daysSyncs.filter(sync => sync.status === 'failed').length;
      const avgDuration = daysSyncs.length > 0
        ? Math.round(daysSyncs.reduce((sum, sync) => 
            sum + (sync.endTime.getTime() - sync.startTime.getTime()), 0) / daysSyncs.length / 1000)
        : 0;
      const recordsProcessed = daysSyncs.reduce((sum, sync) => sum + sync.recordsProcessed, 0);
      
      last7DaysData.push({
        date: dateStr,
        successfulSyncs,
        failedSyncs,
        avgDuration,
        recordsProcessed
      });
    }

    // Calculate 30-day summary
    const totalSyncs = recentSyncs.length;
    const successfulSyncs = recentSyncs.filter(sync => sync.status === 'success').length;
    const successRate = totalSyncs > 0 ? Math.round((successfulSyncs / totalSyncs) * 100) : 0;
    const avgDuration = recentSyncs.length > 0
      ? Math.round(recentSyncs.reduce((sum, sync) => 
          sum + (sync.endTime.getTime() - sync.startTime.getTime()), 0) / recentSyncs.length / 1000)
      : 0;
    const totalRecordsProcessed = recentSyncs.reduce((sum, sync) => sum + sync.recordsProcessed, 0);

    // Find most active dataset
    const datasetCounts: Record<string, number> = {};
    recentSyncs.forEach(sync => {
      datasetCounts[sync.datasetId] = (datasetCounts[sync.datasetId] || 0) + 1;
    });
    const mostActiveDataset = Object.entries(datasetCounts).sort(([,a], [,b]) => b - a)[0]?.[0] || 'None';

    // Find problem datasets (high failure rate)
    const datasetStats: Record<string, { total: number; failed: number }> = {};
    recentSyncs.forEach(sync => {
      if (!datasetStats[sync.datasetId]) {
        datasetStats[sync.datasetId] = { total: 0, failed: 0 };
      }
      datasetStats[sync.datasetId].total++;
      if (sync.status === 'failed') {
        datasetStats[sync.datasetId].failed++;
      }
    });

    const problemDatasets = Object.entries(datasetStats)
      .filter(([, stats]) => stats.total >= 3 && (stats.failed / stats.total) > 0.5)
      .map(([datasetId]) => datasetId);

    return {
      last7Days: last7DaysData,
      last30Days: {
        totalSyncs,
        successRate,
        avgDuration,
        totalRecordsProcessed,
        mostActiveDataset,
        problemDatasets
      }
    };
  }

  /**
   * Initialize freshness tracking for all datasets
   */
  async initializeFreshnessTracking(): Promise<void> {
    console.log('🚀 Initializing freshness tracking for all NYC datasets...');
    
    const datasetIds = Object.values(NYC_DATASETS).map(dataset => dataset.id);
    
    for (const datasetId of datasetIds) {
      const dataset = Object.values(NYC_DATASETS).find(ds => ds.id === datasetId);
      if (!dataset) continue;

      // Check if already exists
      const existing = await prisma.nYCDataFreshness.findUnique({
        where: { datasetId }
      });

      if (!existing) {
        // Create initial record
        await prisma.nYCDataFreshness.create({
          data: {
            datasetId,
            datasetName: dataset.name,
            priority: this.getDatasetPriority(datasetId),
            freshnessScore: 0,
            isStale: true,
            recommendSync: true
          }
        });
        console.log(`✅ Initialized tracking for ${dataset.name}`);
      }
    }

    console.log('🎉 Freshness tracking initialization complete!');
  }
}