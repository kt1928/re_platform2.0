import { prisma } from '@/lib/db';
import { NYCDataFreshnessService } from './nyc-data-freshness-service';
import { NYCDataIngestionService } from './nyc-data-ingestion-service';

export interface SyncRecommendation {
  datasetId: string;
  datasetName: string;
  syncType: 'incremental' | 'full';
  priority: number;
  reason: string;
  estimatedDuration: number; // seconds
  confidence: number; // 0-100
  shouldSync: boolean;
  staleDays: number;
}

export interface SyncSchedule {
  immediate: SyncRecommendation[];
  withinHour: SyncRecommendation[];
  today: SyncRecommendation[];
  thisWeek: SyncRecommendation[];
  noAction: SyncRecommendation[];
}

export class NYCSyncScheduler {
  private freshnessService: NYCDataFreshnessService;
  private ingestionService: NYCDataIngestionService;

  constructor(appToken?: string) {
    this.freshnessService = new NYCDataFreshnessService(appToken);
    this.ingestionService = new NYCDataIngestionService(appToken);
  }

  /**
   * Generate intelligent sync recommendations for all datasets
   */
  async generateSyncRecommendations(): Promise<SyncSchedule> {
    const freshnessData = await this.freshnessService.getAllFreshnessStatuses();
    const recommendations: SyncRecommendation[] = [];

    for (const dataset of freshnessData) {
      const recommendation = await this.analyzeSyncNeed(dataset);
      recommendations.push(recommendation);
    }

    // Sort by priority and urgency
    recommendations.sort((a, b) => {
      if (a.shouldSync !== b.shouldSync) {
        return a.shouldSync ? -1 : 1; // Sync needed first
      }
      if (a.priority !== b.priority) {
        return b.priority - a.priority; // Higher priority first
      }
      return a.staleDays - b.staleDays; // Less stale first (easier wins)
    });

    // Categorize recommendations
    const schedule: SyncSchedule = {
      immediate: [],
      withinHour: [],
      today: [],
      thisWeek: [],
      noAction: []
    };

    for (const rec of recommendations) {
      if (!rec.shouldSync) {
        schedule.noAction.push(rec);
      } else if (rec.priority > 80 && rec.staleDays > 7) {
        schedule.immediate.push(rec);
      } else if (rec.priority > 60 && rec.staleDays > 3) {
        schedule.withinHour.push(rec);
      } else if (rec.staleDays > 1) {
        schedule.today.push(rec);
      } else {
        schedule.thisWeek.push(rec);
      }
    }

    return schedule;
  }

  /**
   * Analyze sync need for a single dataset
   */
  private async analyzeSyncNeed(dataset: any): Promise<SyncRecommendation> {
    const now = new Date();
    const lastSync = dataset.ourLastSync ? new Date(dataset.ourLastSync) : null;
    const nycLastModified = dataset.nycLastModified ? new Date(dataset.nycLastModified) : null;
    
    // Calculate staleness
    const staleDays = lastSync && nycLastModified 
      ? Math.max(0, Math.ceil((nycLastModified.getTime() - lastSync.getTime()) / (1000 * 60 * 60 * 24)))
      : 999;

    // Determine sync type
    const needsFullSync = this.shouldUseFullSync(dataset, staleDays);
    const syncType: 'incremental' | 'full' = needsFullSync ? 'full' : 'incremental';

    // Estimate duration based on dataset size and sync type
    const estimatedDuration = this.estimateSyncDuration(dataset, syncType);

    // Calculate confidence based on success rate and freshness
    const confidence = this.calculateConfidence(dataset);

    // Determine if sync is needed and why
    const { shouldSync, reason } = this.determineSyncNeed(dataset, staleDays);

    return {
      datasetId: dataset.datasetId,
      datasetName: dataset.datasetName,
      syncType,
      priority: dataset.priority,
      reason,
      estimatedDuration,
      confidence,
      shouldSync,
      staleDays
    };
  }

  /**
   * Determine if full sync is needed
   */
  private shouldUseFullSync(dataset: any, staleDays: number): boolean {
    // Full sync if very stale
    if (staleDays > 30) return true;
    
    // Full sync if record count difference is significant
    if (dataset.nycRecordCount && dataset.ourRecordCount) {
      const countDiff = Math.abs(dataset.nycRecordCount - dataset.ourRecordCount);
      const diffPercentage = (countDiff / dataset.nycRecordCount) * 100;
      if (diffPercentage > 20) return true;
    }

    // Full sync if success rate is low (might be data issues)
    if ((dataset.syncSuccessRate || 100) < 60) return true;

    return false;
  }

  /**
   * Estimate sync duration in seconds
   */
  private estimateSyncDuration(dataset: any, syncType: 'incremental' | 'full'): number {
    const baseTime = dataset.avgSyncDuration || 300; // Default 5 minutes
    
    if (syncType === 'full') {
      // Full sync typically takes 3-5x longer
      return Math.round(baseTime * 4);
    }

    // Incremental sync - estimate based on staleness
    const recordsToProcess = Math.min(dataset.nycRecordCount || 1000, 5000); // Cap estimate
    const recordsPerSecond = 50; // Conservative estimate
    
    return Math.max(60, Math.round(recordsToProcess / recordsPerSecond));
  }

  /**
   * Calculate confidence score for sync success
   */
  private calculateConfidence(dataset: any): number {
    let confidence = 70; // Base confidence

    // Adjust based on success rate
    const successRate = dataset.syncSuccessRate || 0;
    confidence = confidence + (successRate - 70) * 0.3;

    // Adjust based on freshness score
    if (dataset.freshnessScore > 80) confidence += 10;
    else if (dataset.freshnessScore < 30) confidence -= 20;

    // Adjust based on recent activity
    if (dataset.ourLastSync) {
      const daysSinceSync = Math.floor((Date.now() - new Date(dataset.ourLastSync).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceSync < 7) confidence += 5;
      else if (daysSinceSync > 30) confidence -= 10;
    }

    return Math.max(0, Math.min(100, Math.round(confidence)));
  }

  /**
   * Determine if sync is needed and provide reason
   */
  private determineSyncNeed(dataset: any, staleDays: number): { shouldSync: boolean; reason: string } {
    // High priority datasets
    if (dataset.priority > 80 && staleDays > 7) {
      return {
        shouldSync: true,
        reason: `High priority dataset is ${staleDays} days stale`
      };
    }

    // Very stale data
    if (staleDays > 14) {
      return {
        shouldSync: true,
        reason: `Data is very stale (${staleDays} days behind NYC)`
      };
    }

    // Large record count differences
    if (dataset.nycRecordCount && dataset.ourRecordCount) {
      const missing = dataset.nycRecordCount - dataset.ourRecordCount;
      const missingPercentage = (missing / dataset.nycRecordCount) * 100;
      
      if (missing > 1000 && missingPercentage > 5) {
        return {
          shouldSync: true,
          reason: `Missing ${missing.toLocaleString()} records (${missingPercentage.toFixed(1)}%)`
        };
      }
    }

    // Low freshness score
    if (dataset.freshnessScore < 50) {
      return {
        shouldSync: true,
        reason: `Low freshness score (${dataset.freshnessScore}%)`
      };
    }

    // Explicitly marked as stale
    if (dataset.isStale) {
      return {
        shouldSync: true,
        reason: `Dataset marked as stale`
      };
    }

    // Recommended by freshness service
    if (dataset.recommendSync) {
      return {
        shouldSync: true,
        reason: `Recommended by freshness monitoring`
      };
    }

    // No sync needed
    return {
      shouldSync: false,
      reason: staleDays === 0 ? 'Data is current' : `Only ${staleDays} days behind, within acceptable range`
    };
  }

  /**
   * Execute recommended syncs automatically
   */
  async executeRecommendedSyncs(maxConcurrent: number = 2, maxDuration: number = 3600): Promise<{
    executed: number;
    failed: number;
    skipped: number;
    totalDuration: number;
    results: Array<{
      datasetId: string;
      success: boolean;
      duration: number;
      error?: string;
    }>;
  }> {
    const schedule = await this.generateSyncRecommendations();
    const toExecute = [
      ...schedule.immediate.slice(0, 3), // Max 3 immediate
      ...schedule.withinHour.slice(0, 2)  // Max 2 within hour
    ];

    if (toExecute.length === 0) {
      return {
        executed: 0,
        failed: 0,
        skipped: 0,
        totalDuration: 0,
        results: []
      };
    }

    console.log(`🤖 Auto-sync scheduler: Executing ${toExecute.length} recommended syncs...`);
    
    const results = [];
    let executed = 0;
    let failed = 0;
    let skipped = 0;
    const startTime = Date.now();

    // Execute syncs with concurrency control
    const chunks = this.chunkArray(toExecute, maxConcurrent);
    
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (recommendation) => {
        const syncStartTime = Date.now();
        
        try {
          // Check if we're approaching time limit
          if ((Date.now() - startTime) / 1000 > maxDuration * 0.8) {
            skipped++;
            return {
              datasetId: recommendation.datasetId,
              success: false,
              duration: 0,
              error: 'Skipped due to time limit'
            };
          }

          const datasetKey = this.getDatasetKey(recommendation.datasetId);
          const options = {
            fullSync: recommendation.syncType === 'full',
            memoryOptimized: true,
            limit: recommendation.syncType === 'full' ? undefined : 5000
          };

          // Execute sync (using placeholder user ID for automated syncs)
          const result = await this.ingestionService.ingestGenericDataset(
            this.getDatasetConstantKey(recommendation.datasetId),
            this.getTableName(recommendation.datasetId),
            'system-auto-sync',
            options,
            this.getProcessRecordMethod(recommendation.datasetId)
          );

          const duration = Math.round((Date.now() - syncStartTime) / 1000);
          
          if (result.status === 'success') {
            executed++;
            console.log(`✅ Auto-sync completed: ${recommendation.datasetName} (${duration}s)`);
          } else {
            failed++;
            console.log(`❌ Auto-sync failed: ${recommendation.datasetName} (${duration}s)`);
          }

          return {
            datasetId: recommendation.datasetId,
            success: result.status === 'success',
            duration,
            error: result.status === 'failed' ? result.errorMessage : undefined
          };

        } catch (error) {
          failed++;
          const duration = Math.round((Date.now() - syncStartTime) / 1000);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          
          console.error(`❌ Auto-sync error for ${recommendation.datasetName}:`, errorMsg);
          
          return {
            datasetId: recommendation.datasetId,
            success: false,
            duration,
            error: errorMsg
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);

      // Check time limit between chunks
      if ((Date.now() - startTime) / 1000 > maxDuration) {
        console.log(`⏰ Auto-sync time limit reached, stopping execution`);
        break;
      }
    }

    const totalDuration = Math.round((Date.now() - startTime) / 1000);
    
    console.log(`🎯 Auto-sync complete: ${executed} executed, ${failed} failed, ${skipped} skipped in ${totalDuration}s`);

    return {
      executed,
      failed,
      skipped,
      totalDuration,
      results
    };
  }

  /**
   * Helper method to chunk array for concurrent processing
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Get dataset key for API calls
   */
  private getDatasetKey(datasetId: string): string {
    const keyMap: Record<string, string> = {
      'usep-8jbt': 'property_sales',
      'w9ak-ipjd': 'build_job_filings',
      'wvxf-dwi5': 'housing_maintenance_violations',
      'qgea-i56i': 'complaint_data',
      'dq6g-a4sc': 'dob_permits',
      '9rz4-mjek': 'tax_debt_data',
      'w7w3-xahh': 'business_licenses',
      '3h2n-5cm9': 'dob_violations',
      'tg4x-b46p': 'event_permits',
      'w9ak-ipjd': 'build_job_filings',
      '43nn-pn8j': 'restaurant_inspections'
    };
    return keyMap[datasetId] || datasetId;
  }

  /**
   * Get dataset constant key (placeholder - would need actual implementation)
   */
  private getDatasetConstantKey(datasetId: string): any {
    // This would need to be implemented based on actual dataset constants
    return datasetId;
  }

  /**
   * Get table name for dataset
   */
  private getTableName(datasetId: string): string {
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
    return tableMap[datasetId] || 'unknown_table';
  }

  /**
   * Get process record method (placeholder - would need actual implementation)
   */
  private getProcessRecordMethod(datasetId: string): any {
    // This would return the appropriate processing method for each dataset
    return async () => {}; // Placeholder
  }
}