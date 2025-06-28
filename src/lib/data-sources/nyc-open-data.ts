// import { prisma } from '@/lib/db'; // Removed unused import

interface NYCDataset {
  id: string;
  name: string;
  endpoint: string;
  primaryKey?: string[];
  dateField?: string;
  limit?: number;
  validatedFields?: string[]; // Cache of validated field names
  lastValidated?: Date; // When fields were last validated
}

export const NYC_DATASETS: Record<string, NYCDataset> = {
  PROPERTY_SALES: {
    id: 'usep-8jbt',
    name: 'NYC Citywide Rolling Calendar Sales',
    endpoint: 'https://data.cityofnewyork.us/resource/usep-8jbt.json',
    primaryKey: ['borough', 'block', 'lot', 'sale_date'],
    dateField: 'sale_date',
    limit: 10000
  },
  DOB_JOB_APPLICATIONS: {
    id: 'w9ak-ipjd',
    name: 'DOB Job Application Filings',
    endpoint: 'https://data.cityofnewyork.us/resource/w9ak-ipjd.json',
    primaryKey: ['job_filing_number'],
    dateField: 'current_status_date',
    limit: 10000
  },
  HOUSING_MAINTENANCE: {
    id: 'wvxf-dwi5',
    name: 'Housing Maintenance Code Violations',
    endpoint: 'https://data.cityofnewyork.us/resource/wvxf-dwi5.json',
    primaryKey: ['violationid'],
    dateField: 'novdescription',
    limit: 10000
  },
  COMPLAINT_DATA: {
    id: 'qgea-i56i',
    name: 'NYPD Complaint Data (qgea-i56i)',
    endpoint: 'https://data.cityofnewyork.us/resource/qgea-i56i.json',
    primaryKey: ['cmplnt_num'],
    dateField: 'cmplnt_fr_dt',
    limit: 5000 // Smaller batches for large dataset
  },
  DOB_NOW_PERMITS: {
    id: 'dq6g-a4sc',
    name: 'DOB NOW: All Approved Permits',
    endpoint: 'https://data.cityofnewyork.us/resource/dq6g-a4sc.json',
    primaryKey: ['job_filing_number', 'work_permit'],
    dateField: 'approved_date',
    limit: 10000
  },
  TAX_DEBT_DATA: {
    id: '9rz4-mjek',
    name: 'Tax Debt/Water Debt Data (9rz4-mjek)',
    endpoint: 'https://data.cityofnewyork.us/resource/9rz4-mjek.json',
    primaryKey: ['borough', 'block', 'lot', 'month'],
    dateField: 'month',
    limit: 10000
  },
  BUSINESS_LICENSES: {
    id: 'w7w3-xahh',
    name: 'Business Licenses (w7w3-xahh)',
    endpoint: 'https://data.cityofnewyork.us/resource/w7w3-xahh.json',
    primaryKey: ['license_nbr'],
    dateField: 'license_creation_date',
    limit: 10000
  },
  DOB_VIOLATIONS: {
    id: '3h2n-5cm9',
    name: 'DOB Violations',
    endpoint: 'https://data.cityofnewyork.us/resource/3h2n-5cm9.json',
    primaryKey: ['violation_number'],
    dateField: 'issue_date',
    limit: 10000
  },
  EVENT_PERMITS: {
    id: 'tg4x-b46p',
    name: 'Event Permits (tg4x-b46p)',
    endpoint: 'https://data.cityofnewyork.us/resource/tg4x-b46p.json',
    primaryKey: ['eventid'],
    dateField: 'startdatetime',
    limit: 10000
  },
  BUILD_JOB_FILINGS: {
    id: 'w9ak-ipjd',
    name: 'DOB Job Filings (w9ak-ipjd)',
    endpoint: 'https://data.cityofnewyork.us/resource/w9ak-ipjd.json',
    primaryKey: ['job_filing_number'],
    dateField: 'current_status_date',
    limit: 10000
  },
  RESTAURANT_INSPECTIONS: {
    id: '43nn-pn8j',
    name: 'Restaurant Inspections (43nn-pn8j)',
    endpoint: 'https://data.cityofnewyork.us/resource/43nn-pn8j.json',
    primaryKey: ['camis', 'inspection_date'],
    dateField: 'inspection_date',
    limit: 10000
  }
};

export class NYCOpenDataClient {
  private appToken?: string;
  private rateLimitDelay: number = 100; // Base delay between requests
  private maxRetries: number = 5;
  private baseBackoffMs: number = 1000;

  constructor(appToken?: string) {
    this.appToken = appToken;
    // Use app token for higher rate limits if available
    if (this.appToken) {
      this.rateLimitDelay = 50; // Lower delay with app token
    }
  }

  async fetchDataset(
    dataset: NYCDataset, 
    params: Record<string, any> = {}
  ): Promise<any[]> {
    // Validate parameters against available fields first
    const validatedParams = await this.validateQueryParams(dataset, params);
    
    const url = new URL(dataset.endpoint);
    
    // Add default parameters with proper SoQL syntax
    const limit = validatedParams.$limit || dataset.limit || 1000;
    url.searchParams.append('$limit', String(Math.min(limit, 50000))); // Respect Socrata max
    
    if (validatedParams.$offset) {
      url.searchParams.append('$offset', String(validatedParams.$offset));
    }
    
    if (validatedParams.$select) {
      url.searchParams.append('$select', validatedParams.$select);
    }
    
    if (validatedParams.$where) {
      // Ensure proper SoQL date format for date fields
      let whereClause = validatedParams.$where;
      if (dataset.dateField && whereClause.includes(dataset.dateField)) {
        whereClause = this.optimizeDateFilter(whereClause, dataset.dateField);
      }
      url.searchParams.append('$where', whereClause);
    }
    
    if (validatedParams.$order) {
      url.searchParams.append('$order', validatedParams.$order);
    }
    
    // Add additional SoQL parameters if provided
    if (validatedParams.$group) {
      url.searchParams.append('$group', validatedParams.$group);
    }
    
    if (validatedParams.$having) {
      url.searchParams.append('$having', validatedParams.$having);
    }
    
    // Add app token if available (increases rate limits)
    if (this.appToken) {
      url.searchParams.append('$$app_token', this.appToken);
    }

    console.log(`Fetching from: ${url.toString()}`);

    // Rate limiting delay
    if (this.rateLimitDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
    }

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'RE-Platform/1.0 (+https://re-platform.com/api)',
          ...(this.appToken && { 'X-App-Token': this.appToken })
        },
        // Add timeout to prevent hanging requests
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      // Enhanced error handling with specific NYC Open Data API status codes
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new Error(`Rate limit exceeded. ${retryAfter ? `Retry after ${retryAfter} seconds.` : 'Please wait and try again.'}`);
      }
      
      if (response.status === 403) {
        throw new Error('Access forbidden. Check dataset permissions or app token.');
      }
      
      if (response.status === 400) {
        const errorText = await response.text().catch(() => 'Bad Request');
        throw new Error(`Bad Request: ${errorText}. Check query syntax.`);
      }
      
      if (response.status === 404) {
        throw new Error(`Dataset not found: ${dataset.id}. Check if dataset ID is correct.`);
      }
      
      if (response.status === 500) {
        throw new Error('NYC Open Data server error. Please try again later.');
      }
      
      if (response.status === 502 || response.status === 503) {
        throw new Error('NYC Open Data service unavailable. Please try again later.');
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      
      // Handle NYC Open Data error responses in JSON
      if (data.error === true || (Array.isArray(data) && data.length === 1 && data[0].error)) {
        const errorMsg = data.message || data[0]?.message || 'NYC Open Data API error';
        throw new Error(`NYC API Error: ${errorMsg}`);
      }
      
      // Log successful response for debugging
      console.log(`Successfully fetched ${Array.isArray(data) ? data.length : 'unknown'} records from ${dataset.id}`);
      
      return data;
    } catch (error) {
      if (error.name === 'TimeoutError') {
        throw new Error(`Request timeout for dataset ${dataset.name}. Try reducing batch size or adding filters.`);
      }
      
      console.error(`Error fetching dataset ${dataset.name}:`, {
        error: error instanceof Error ? error.message : String(error),
        url: url.toString(),
        params: validatedParams
      });
      throw error;
    }
  }

  /**
   * Optimize date filters for better performance
   */
  private optimizeDateFilter(whereClause: string, dateField: string): string {
    // Convert simple date comparisons to proper SoQL format
    // Example: "sale_date > '2023-01-01'" -> "sale_date > '2023-01-01T00:00:00.000'"
    
    const datePattern = new RegExp(`(${dateField})\\s*([><=]+)\\s*'([^']+)'`, 'g');
    
    return whereClause.replace(datePattern, (match, field, operator, dateValue) => {
      // If date is already in ISO format, leave it alone
      if (dateValue.includes('T')) {
        return match;
      }
      
      // Convert YYYY-MM-DD to ISO format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        const isoDate = operator.includes('<') 
          ? `${dateValue}T23:59:59.999`  // End of day for less-than comparisons
          : `${dateValue}T00:00:00.000`; // Start of day for greater-than comparisons
        
        return `${field} ${operator} '${isoDate}'`;
      }
      
      return match; // Return unchanged if format not recognized
    });
  }

  async fetchAllRecords(
    dataset: NYCDataset,
    params: Record<string, any> = {},
    onBatch?: (records: any[], offset: number, progress: { current: number; estimated?: number }) => Promise<void>,
    options: {
      maxRecords?: number;
      batchSize?: number;
      retryAttempts?: number;
      streamMode?: boolean;
      memoryOptimized?: boolean;
    } = {}
  ): Promise<any[]> {
    const {
      maxRecords,
      batchSize = options.memoryOptimized ? 200 : 1000, // Smaller batches for memory-constrained environments and API stability
      retryAttempts = 3,
      streamMode = true, // Don't accumulate all records in memory by default
      memoryOptimized = false
    } = options;

    const allRecords: any[] = streamMode ? [] : [];
    let offset = 0;
    // Use batchSize directly for pagination, don't limit by params.$limit here
    const batchLimit = batchSize;
    let hasMore = true;
    let totalProcessed = 0;
    let estimatedTotal: number | undefined;

    // Get estimated total count for better progress tracking
    try {
      if (!params.$where) {
        estimatedTotal = await this.getRecordCount(dataset);
        console.log(`Estimated total records: ${estimatedTotal?.toLocaleString()}`);
      }
    } catch (error) {
      console.warn('Could not get total count estimate:', error);
    }

    // Ensure we have a consistent sort order for pagination
    const sortParams = { ...params };
    if (!sortParams.$order && dataset.primaryKey && dataset.primaryKey.length > 0) {
      sortParams.$order = dataset.primaryKey[0] + ' ASC';
      console.log(`Using primary key '${dataset.primaryKey[0]}' for consistent pagination`);
    }

    console.log(`Starting dataset fetch with batch size: ${batchLimit.toLocaleString()}`);
    if (maxRecords) {
      console.log(`Target record limit: ${maxRecords.toLocaleString()}`);
    } else {
      console.log(`Target: Full sync (all available records)`);
    }
    
    // Safety counter to prevent infinite loops
    let batchCounter = 0;
    const maxBatches = maxRecords ? Math.ceil(maxRecords / batchLimit) + 10 : 50000; // Conservative limit
    console.log(`Maximum batches allowed: ${maxBatches.toLocaleString()}`);

    while (hasMore && (!maxRecords || totalProcessed < maxRecords) && batchCounter < maxBatches) {
      batchCounter++;
      let batch: any[] = [];
      let attempt = 0;
      let success = false;
      
      // Calculate how many records to fetch in this batch
      const remainingRecords = maxRecords ? maxRecords - totalProcessed : null;
      const currentBatchSize = remainingRecords !== null 
        ? Math.min(batchLimit, remainingRecords)
        : batchLimit;

      // Define batch parameters outside the retry loop so it's accessible later
      const batchParams = {
        ...sortParams,
        $limit: currentBatchSize,
        $offset: offset
      };

      // Retry logic for robust fetching with improved error handling
      while (attempt < retryAttempts && !success) {
        try {
          console.log(`Fetching batch: offset=${offset.toLocaleString()}, limit=${batchParams.$limit.toLocaleString()}`);
          batch = await this.fetchDatasetWithRetry(dataset, batchParams, attempt);
          success = true;

        } catch (error) {
          attempt++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`Attempt ${attempt}/${retryAttempts} failed for offset ${offset}:`, errorMsg);
          
          // Check if this is a permanent error that shouldn't be retried
          if (errorMsg.includes('403') || errorMsg.includes('Access forbidden') || 
              errorMsg.includes('Dataset not found') || errorMsg.includes('Invalid dataset')) {
            throw new Error(`Permanent error - not retrying: ${errorMsg}`);
          }
          
          if (attempt < retryAttempts) {
            // Progressive backoff with jitter
            const baseDelay = this.baseBackoffMs * Math.pow(2, attempt);
            const jitter = Math.random() * 1000; // Add randomness to avoid thundering herd
            const backoffDelay = Math.min(baseDelay + jitter, 30000); // Max 30s delay
            
            // Special handling for rate limit errors
            if (errorMsg.includes('429') || errorMsg.includes('Rate limit')) {
              const rateLimitDelay = Math.min(60000, baseDelay * 3); // Longer delay for rate limits
              console.log(`Rate limit hit, waiting ${Math.round(rateLimitDelay/1000)}s before retry...`);
              await new Promise(resolve => setTimeout(resolve, rateLimitDelay));
            } else {
              console.log(`Retrying in ${Math.round(backoffDelay/1000)}s...`);
              await new Promise(resolve => setTimeout(resolve, backoffDelay));
            }
          } else {
            throw new Error(`Failed to fetch batch after ${retryAttempts} attempts: ${errorMsg}`);
          }
        }
      }
      
      if (batch.length === 0) {
        console.log('No more records found, sync complete');
        hasMore = false;
      } else {
        if (!streamMode) {
          allRecords.push(...batch);
        }
        
        const batchSize = batch.length; // Store batch size before any modifications
        totalProcessed += batchSize;
        
        // Call the batch processor
        if (onBatch) {
          const progress = {
            current: totalProcessed,
            estimated: estimatedTotal
          };
          await onBatch(batch, offset, progress);
        }
        
        // Memory optimization: explicit cleanup after processing batch
        if (memoryOptimized) {
          batch.length = 0; // Clear the batch array
          if (global.gc) {
            global.gc(); // Force garbage collection if available
          }
        }
        
        const progressPct = estimatedTotal 
          ? ` - ${Math.round((totalProcessed / estimatedTotal) * 100)}% complete`
          : '';
        console.log(`✅ Batch completed: +${batchSize.toLocaleString()} records | Total: ${totalProcessed.toLocaleString()}${progressPct} | Next offset: ${offset + batchSize}`);
        
        // Enhanced memory monitoring and management
        if (memoryOptimized && process.memoryUsage) {
          const memUsage = process.memoryUsage();
          const memMB = Math.round(memUsage.heapUsed / 1024 / 1024);
          const rss = Math.round(memUsage.rss / 1024 / 1024);
          console.log(`Memory usage: ${memMB}MB heap, ${rss}MB RSS`);
          
          // Aggressive memory management for large datasets
          if (memUsage.heapUsed > 500 * 1024 * 1024) {
            console.log('⚠️ High memory usage detected (>500MB), implementing throttling');
            
            // Force garbage collection if available
            if (global.gc) {
              global.gc();
              console.log('🗑️ Forced garbage collection');
            }
            
            // Increase processing delay significantly
            const memoryDelay = Math.min(5000, Math.floor(memUsage.heapUsed / (100 * 1024 * 1024)) * 1000);
            await new Promise(resolve => setTimeout(resolve, memoryDelay));
          }
          
          // Emergency brake for extreme memory usage
          if (memUsage.heapUsed > 1024 * 1024 * 1024) { // 1GB
            console.error('🚨 CRITICAL: Memory usage >1GB, stopping to prevent system crash');
            throw new Error('Memory usage too high - stopping sync to prevent system instability');
          }
        }
        
        // Check if we've reached our specified limit
        if (maxRecords && totalProcessed >= maxRecords) {
          console.log(`Reached specified record limit: ${maxRecords.toLocaleString()}`);
          hasMore = false;
        } else {
          offset += batchSize;
          
          // Only stop if we get significantly fewer records than requested
          // (NYC Open Data may return exactly batchSize until the very end)
          // Use a threshold of 10% of batch size or minimum 50 records
          const endThreshold = Math.min(50, Math.floor(batchParams.$limit * 0.1));
          if (batchSize < endThreshold) {
            console.log(`Reached end of dataset - received only ${batchSize} records (threshold: ${endThreshold})`);
            hasMore = false;
          }
          
          // Enhanced adaptive delay with system resource awareness
          let delay = Math.max(50, Math.min(500, Math.floor(batchSize / 10)));
          
          // Respect NYC Open Data rate limits (1000 requests per rolling hour without token, 10000 with token)
          const baseRateLimit = this.appToken ? 10000 : 1000;
          const rateLimitDelay = Math.max(this.rateLimitDelay, 3600000 / baseRateLimit); // Spread requests over hour
          delay = Math.max(delay, rateLimitDelay);
          
          if (memoryOptimized) {
            // Longer delays for memory-constrained environments
            delay = Math.max(delay * 2, 200);
            
            // Dynamic delay based on current memory usage
            if (process.memoryUsage) {
              const currentMemMB = process.memoryUsage().heapUsed / (1024 * 1024);
              if (currentMemMB > 500) {
                delay *= Math.min(5, Math.floor(currentMemMB / 200)); // Scale delay with memory usage
              }
            }
          }
          
          // Add jitter to avoid synchronized requests from multiple instances
          const jitter = Math.random() * Math.min(delay * 0.1, 100);
          delay += jitter;
          
          console.log(`Waiting ${Math.round(delay)}ms before next batch...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (batchCounter >= maxBatches) {
      console.warn(`⚠️ Stopped fetching due to batch limit safety (${maxBatches} batches). Total records processed: ${totalProcessed.toLocaleString()}`);
    } else {
      console.log(`Dataset fetch completed. Total records processed: ${totalProcessed.toLocaleString()}`);
    }
    
    return streamMode ? [] : allRecords;
  }

  async getLatestRecordDate(dataset: NYCDataset): Promise<Date | null> {
    if (!dataset.dateField) {
      return null;
    }

    const params = {
      $select: dataset.dateField,
      $order: `${dataset.dateField} DESC`,
      $limit: 1
    };

    const records = await this.fetchDataset(dataset, params);
    
    if (records.length > 0 && records[0][dataset.dateField]) {
      return new Date(records[0][dataset.dateField]);
    }

    return null;
  }

  async getRecordCount(dataset: NYCDataset, where?: string): Promise<{ count: number; estimated: boolean; method: string }> {
    // Try multiple methods to get record count, with fallbacks
    
    // Method 1: Try metadata rowCount from views API (most reliable first)
    try {
      const metadataUrl = `https://data.cityofnewyork.us/api/views/${dataset.id}.json`;
      const response = await fetch(metadataUrl, {
        headers: {
          'Accept': 'application/json',
          ...(this.appToken && { 'X-App-Token': this.appToken })
        },
        signal: AbortSignal.timeout(15000)
      });
      
      if (response.ok) {
        const metadata = await response.json();
        console.log(`Metadata for ${dataset.id}:`, {
          rowCount: metadata.rowCount,
          totalRows: metadata.totalRows,
          rowsUpdatedAt: metadata.rowsUpdatedAt,
          name: metadata.name,
          id: metadata.id
        });
        
        // Try multiple fields for row count
        const rowCount = parseInt(
          metadata.rowCount || 
          metadata.totalRows || 
          metadata.rows || 
          metadata.recordCount ||
          '0'
        );
        
        if (rowCount > 0) {
          // If we have a where clause, we can't use total count - need to estimate
          if (where) {
            console.log(`Metadata count (${rowCount}) available but filtering required, falling back to sampling`);
          } else {
            console.log(`Metadata count successful for ${dataset.id}: ${rowCount} records`);
            return { count: rowCount, estimated: false, method: 'metadata' };
          }
        } else {
          console.warn(`Metadata returned invalid row count for ${dataset.id}: ${rowCount}`);
        }
      } else {
        console.warn(`Metadata API returned ${response.status} for ${dataset.id}`);
      }
    } catch (error) {
      console.warn(`Metadata count failed for ${dataset.id}:`, error);
    }

    // Method 2: Try Socrata's built-in count query with timeout and enhanced error handling
    try {
      const countParams: Record<string, any> = {
        $select: 'count(*) as count'
      };
      if (where) countParams.$where = where;
      
      console.log(`Attempting count query for ${dataset.id} with params:`, countParams);
      
      // Add shorter timeout for count queries to prevent hanging
      const countPromise = this.fetchDatasetWithTimeout(dataset, countParams, 10000); // 10 second timeout
      const result = await countPromise;
      const count = result[0]?.count ? parseInt(result[0].count) : null;
      
      if (count && count > 0) {
        console.log(`Count query successful for ${dataset.id}: ${count} records`);
        return { count, estimated: false, method: 'count_query' };
      } else {
        console.warn(`Count query returned invalid result for ${dataset.id}:`, result);
      }
    } catch (error) {
      console.warn(`Count query failed for ${dataset.id}:`, {
        error: error instanceof Error ? error.message : String(error),
        where,
        timeout: error instanceof Error && error.message.includes('timeout')
      });
      
      // If it's a timeout, immediately skip to faster methods
      if (error instanceof Error && (error.message.includes('timeout') || error.message.includes('abort'))) {
        console.log(`Count query timed out for ${dataset.id}, skipping to faster estimation methods`);
      }
    }

    // Method 3: Fast sample-based estimation (simplified approach)
    try {
      const sampleSize = 1000;
      const sampleParams: Record<string, any> = { $limit: sampleSize };
      if (where) sampleParams.$where = where;
      
      console.log(`Using fast sample estimation for ${dataset.id} with params:`, sampleParams);
      
      // Use shorter timeout for sample queries
      const sampleResult = await this.fetchDatasetWithTimeout(dataset, sampleParams, 8000);
      
      if (sampleResult.length < sampleSize) {
        // Got fewer than sample size, this is likely the total
        console.log(`Sample estimation complete: ${sampleResult.length} total records`);
        return { count: sampleResult.length, estimated: false, method: 'sample_complete' };
      }
      
      // Quick estimation: if we got exactly the sample size, estimate based on dataset type
      let multiplier = 10; // Default conservative estimate
      
      // Use dataset-specific multipliers based on known patterns
      if (dataset.id === 'usep-8jbt') multiplier = 26; // Property sales ~26k
      else if (dataset.id === 'qgea-i56i') multiplier = 500; // Complaint data ~500k+
      else if (dataset.id === 'dq6g-a4sc') multiplier = 100; // DOB permits ~100k+
      else if (dataset.id === '3h2n-5cm9') multiplier = 200; // DOB violations ~200k+
      else if (dataset.id === 'w9ak-ipjd') multiplier = 150; // Build job filings ~150k
      else if (dataset.id === 'wvxf-dwi5') multiplier = 800; // Housing maintenance ~800k
      else if (dataset.id.includes('restaurant')) multiplier = 50; // Restaurant inspections ~50k
      
      const estimatedCount = sampleSize * multiplier;
      console.log(`Quick estimation for ${dataset.id}: ~${estimatedCount} records (${multiplier}x multiplier)`);
      return { count: estimatedCount, estimated: true, method: 'quick_estimate' };
      
    } catch (error) {
      console.warn(`Sample estimation failed for ${dataset.id}:`, {
        error: error instanceof Error ? error.message : String(error),
        timeout: error instanceof Error && error.message.includes('timeout')
      });
    }

    // Method 4: Simplified fallback - return reasonable estimate
    console.log(`Using fallback estimation for ${dataset.id}`);
    
    // Return dataset-specific fallback estimates based on known data sizes
    const fallbackEstimates: Record<string, number> = {
      'usep-8jbt': 26000,        // Property sales
      'qgea-i56i': 500000,       // NYPD complaints  
      'dq6g-a4sc': 100000,       // DOB permits
      '3h2n-5cm9': 200000,       // DOB violations
      'w9ak-ipjd': 150000,       // Build job filings
      'wvxf-dwi5': 800000,       // Housing maintenance violations
      '9rz4-mjek': 50000,        // Tax debt
      'w7w3-xahh': 200000,       // Business licenses
      'tg4x-b46p': 10000,        // Event permits
      '43nn-pn8j': 50000         // Restaurant inspections
    };
    
    const fallbackCount = fallbackEstimates[dataset.id] || 10000;
    console.log(`Using fallback estimate for ${dataset.id}: ${fallbackCount} records`);
    return { count: fallbackCount, estimated: true, method: 'fallback_estimate' };
  }

  /**
   * Fetch dataset with custom timeout
   */
  private async fetchDatasetWithTimeout(
    dataset: NYCDataset, 
    params: Record<string, any>,
    timeoutMs: number = 30000
  ): Promise<any[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
      // Custom timeout handling with AbortController
      
      const url = new URL(dataset.endpoint);
      
      // Build URL with validated params (skip validation for count queries to avoid recursion)
      const isCountQuery = params.$select === 'count(*) as count';
      const finalParams = isCountQuery ? params : await this.validateQueryParams(dataset, params);
      
      // Add parameters to URL
      const limit = finalParams.$limit || dataset.limit || 1000;
      url.searchParams.append('$limit', String(Math.min(limit, 50000)));
      
      if (finalParams.$offset) {
        url.searchParams.append('$offset', String(finalParams.$offset));
      }
      
      if (finalParams.$select) {
        url.searchParams.append('$select', finalParams.$select);
      }
      
      if (finalParams.$where) {
        url.searchParams.append('$where', finalParams.$where);
      }
      
      if (finalParams.$order) {
        url.searchParams.append('$order', finalParams.$order);
      }
      
      if (this.appToken) {
        url.searchParams.append('$$app_token', this.appToken);
      }

      console.log(`Fetching with ${timeoutMs}ms timeout: ${url.toString()}`);

      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'RE-Platform/1.0 (+https://re-platform.com/api)',
          ...(this.appToken && { 'X-App-Token': this.appToken })
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
      
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeoutMs}ms for dataset ${dataset.name}`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Enhanced fetch with proper error handling and circuit breaker pattern
   */
  private async fetchDatasetWithRetry(
    dataset: NYCDataset, 
    params: Record<string, any>,
    attemptNumber: number = 0
  ): Promise<any[]> {
    // Implement circuit breaker for repeated failures
    if (attemptNumber > 0) {
      // Reduce batch size on retries to avoid overwhelming the API
      if (params.$limit && params.$limit > 500) {
        params = { ...params, $limit: Math.max(500, Math.floor(params.$limit / 2)) };
        console.log(`Reducing batch size to ${params.$limit} for retry attempt ${attemptNumber}`);
      }
    }
    
    try {
      return await this.fetchDataset(dataset, params);
    } catch (error) {
      // Enhanced error context
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`${errorMsg} (attempt ${attemptNumber + 1}, params: ${JSON.stringify(params)})`);
    }
  }

  /**
   * Check if NYC Open Data API is healthy
   */
  async healthCheck(): Promise<{ healthy: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      // Test with a simple, fast endpoint
      const testUrl = 'https://data.cityofnewyork.us/api/views.json?limit=1';
      const response = await fetch(testUrl, {
        headers: {
          'Accept': 'application/json',
          ...(this.appToken && { 'X-App-Token': this.appToken })
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout for health check
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        return { healthy: true, responseTime };
      } else {
        return { 
          healthy: false, 
          responseTime, 
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return { 
        healthy: false, 
        responseTime, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Validate and cache field names for a dataset
   */
  async validateDatasetFields(dataset: NYCDataset): Promise<string[]> {
    // Check if we have cached validation that's still fresh (24 hours)
    if (dataset.validatedFields && dataset.lastValidated) {
      const cacheAge = Date.now() - dataset.lastValidated.getTime();
      if (cacheAge < 24 * 60 * 60 * 1000) { // 24 hours
        console.log(`Using cached field validation for ${dataset.id}`);
        return dataset.validatedFields;
      }
    }

    console.log(`Validating fields for dataset ${dataset.id}...`);
    
    try {
      // Get metadata to find available fields
      const metadata = await this.getDatasetMetadata(dataset.id);
      const availableFields = metadata.columns.map(col => col.fieldName).filter(Boolean);
      
      if (availableFields.length === 0) {
        console.warn(`No fields found in metadata for ${dataset.id}, trying sample query`);
        
        // Fallback: fetch a small sample to see field names
        const sampleResult = await this.fetchDataset(dataset, { $limit: 1 });
        if (sampleResult.length > 0) {
          const sampleFields = Object.keys(sampleResult[0]);
          console.log(`Found fields from sample for ${dataset.id}:`, sampleFields);
          
          // Cache the results
          dataset.validatedFields = sampleFields;
          dataset.lastValidated = new Date();
          
          return sampleFields;
        }
      }
      
      console.log(`Validated fields for ${dataset.id}:`, availableFields);
      
      // Cache the results
      dataset.validatedFields = availableFields;
      dataset.lastValidated = new Date();
      
      return availableFields;
      
    } catch (error) {
      console.error(`Field validation failed for ${dataset.id}:`, error);
      
      // Return fallback fields based on dataset type
      const fallbackFields = this.getFallbackFields(dataset);
      console.log(`Using fallback fields for ${dataset.id}:`, fallbackFields);
      return fallbackFields;
    }
  }

  /**
   * Get fallback field names for common dataset types
   */
  private getFallbackFields(dataset: NYCDataset): string[] {
    const fallbackMap: Record<string, string[]> = {
      'usep-8jbt': ['borough', 'neighborhood', 'building_class_category', 'address', 'sale_price', 'sale_date', 'year_built'],
      'qgea-i56i': ['cmplnt_num', 'cmplnt_fr_dt', 'boro_nm', 'loc_of_occur_desc', 'ofns_desc'],
      'dq6g-a4sc': ['job_filing_number', 'borough', 'house_no', 'street_name', 'work_type', 'approved_date'],
      '3h2n-5cm9': ['violation_number', 'boro', 'house_number', 'street', 'violation_type', 'issue_date']
    };
    
    return fallbackMap[dataset.id] || ['id', 'created_date', 'updated_date'];
  }

  /**
   * Validate query parameters against available fields
   */
  async validateQueryParams(dataset: NYCDataset, params: Record<string, any>): Promise<Record<string, any>> {
    const validatedParams = { ...params };
    const availableFields = await this.validateDatasetFields(dataset);
    
    // Check $select parameter
    if (params.$select && params.$select !== 'count(*) as count') {
      const selectedFields = params.$select.split(',').map((f: string) => f.trim());
      const invalidFields = selectedFields.filter((field: string) => 
        !availableFields.includes(field) && !field.includes('(') // Allow functions like count(*)
      );
      
      if (invalidFields.length > 0) {
        console.warn(`Invalid fields in $select for ${dataset.id}:`, invalidFields);
        console.warn(`Available fields:`, availableFields);
        
        // Remove invalid fields
        const validFields = selectedFields.filter((field: string) => 
          availableFields.includes(field) || field.includes('(')
        );
        
        if (validFields.length > 0) {
          validatedParams.$select = validFields.join(',');
        } else {
          delete validatedParams.$select; // Let API return all fields
        }
      }
    }
    
    // Check $where parameter for field references
    if (params.$where) {
      const whereClause = params.$where;
      const fieldReferences = this.extractFieldReferences(whereClause);
      const invalidRefs = fieldReferences.filter(field => !availableFields.includes(field));
      
      if (invalidRefs.length > 0) {
        console.warn(`Invalid field references in $where for ${dataset.id}:`, invalidRefs);
        console.warn(`Where clause:`, whereClause);
        console.warn(`Available fields:`, availableFields);
        
        // For now, just warn - don't modify the where clause as it's complex to parse
        // TODO: Implement smarter where clause validation
      }
    }
    
    // Check $order parameter
    if (params.$order) {
      const orderFields = params.$order.split(',').map((f: string) => 
        f.trim().replace(/\s+(ASC|DESC)$/i, '')
      );
      const invalidOrderFields = orderFields.filter(field => !availableFields.includes(field));
      
      if (invalidOrderFields.length > 0) {
        console.warn(`Invalid fields in $order for ${dataset.id}:`, invalidOrderFields);
        
        // Use primary key or first available field as fallback
        const fallbackField = dataset.primaryKey?.[0] || availableFields[0];
        if (fallbackField) {
          validatedParams.$order = `${fallbackField} ASC`;
          console.log(`Using fallback order: ${validatedParams.$order}`);
        } else {
          delete validatedParams.$order;
        }
      }
    }
    
    return validatedParams;
  }

  /**
   * Extract field references from a where clause (basic implementation)
   */
  private extractFieldReferences(whereClause: string): string[] {
    // Basic regex to find field names (this could be improved)
    const fieldPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*[><=!]/g;
    const matches = [];
    let match;
    
    while ((match = fieldPattern.exec(whereClause)) !== null) {
      matches.push(match[1]);
    }
    
    return [...new Set(matches)]; // Remove duplicates
  }

  /**
   * Get dataset metadata with enhanced error handling
   */
  async getDatasetMetadata(datasetId: string): Promise<{
    name: string;
    description: string;
    lastModified: Date | null;
    recordCount: number | null;
    recordCountEstimated: boolean;
    countMethod: string;
    columns: Array<{fieldName: string; dataType: string; description: string}>;
    updateFrequency: string;
    error?: string;
  }> {
    try {
      const metadataUrl = `https://data.cityofnewyork.us/api/views/${datasetId}.json`;
      const response = await fetch(metadataUrl, {
        headers: {
          'Accept': 'application/json',
          ...(this.appToken && { 'X-App-Token': this.appToken })
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch metadata: HTTP ${response.status}`);
      }

      const metadata = await response.json();
      
      // Extract relevant information
      const columns = (metadata.columns || []).map((col: any) => ({
        fieldName: col.fieldName || col.name,
        dataType: col.dataTypeName || col.type,
        description: col.description || ''
      }));

      const lastModified = metadata.rowsUpdatedAt 
        ? new Date(metadata.rowsUpdatedAt * 1000) 
        : null;

      // Try to get record count with enhanced methods
      let recordCount: number | null = null;
      let recordCountEstimated = false;
      let countMethod = 'unknown';
      
      try {
        const countResult = await this.getRecordCount({ 
          id: datasetId, 
          name: metadata.name,
          endpoint: `https://data.cityofnewyork.us/resource/${datasetId}.json`
        });
        recordCount = countResult.count > 0 ? countResult.count : null;
        recordCountEstimated = countResult.estimated;
        countMethod = countResult.method;
        
        if (countResult.method === 'failed') {
          console.warn(`All count methods failed for ${datasetId}`);
        } else {
          console.log(`Record count for ${datasetId}: ${recordCount?.toLocaleString()} (${countResult.method}${countResult.estimated ? ', estimated' : ''})`);
        }
      } catch (countError) {
        console.warn(`Could not get record count for ${datasetId}:`, countError);
      }

      return {
        name: metadata.name || 'Unknown Dataset',
        description: metadata.description || '',
        lastModified,
        recordCount,
        recordCountEstimated,
        countMethod,
        columns,
        updateFrequency: metadata.publicationStage || 'Unknown'
      };
    } catch (error) {
      console.error(`Error fetching metadata for dataset ${datasetId}:`, error);
      return {
        name: `Dataset ${datasetId}`,
        description: '',
        lastModified: null,
        recordCount: null,
        recordCountEstimated: true,
        countMethod: 'error',
        columns: [],
        updateFrequency: 'Unknown',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}