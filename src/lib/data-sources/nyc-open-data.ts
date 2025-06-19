import { prisma } from '@/lib/db';

interface NYCDataset {
  id: string;
  name: string;
  endpoint: string;
  primaryKey?: string[];
  dateField?: string;
  limit?: number;
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
  PROPERTY_VALUATION_FY2024: {
    id: 'rbx6-tga4',
    name: 'DOB Build Permits (rbx6-tga4)',
    endpoint: 'https://data.cityofnewyork.us/resource/rbx6-tga4.json',
    primaryKey: ['job_filing_number'],
    limit: 10000
  },
  PROPERTY_VALUATION_FY2023: {
    id: '6z8x-wfk4',
    name: 'Eviction Data (6z8x-wfk4)',
    endpoint: 'https://data.cityofnewyork.us/resource/6z8x-wfk4.json',
    primaryKey: ['court_index_number'],
    dateField: 'executed_date',
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

  constructor(appToken?: string) {
    this.appToken = appToken;
  }

  async fetchDataset(
    dataset: NYCDataset, 
    params: Record<string, any> = {}
  ): Promise<any[]> {
    const url = new URL(dataset.endpoint);
    
    // Add default parameters
    url.searchParams.append('$limit', String(params.$limit || dataset.limit || 1000));
    
    if (params.$offset) {
      url.searchParams.append('$offset', String(params.$offset));
    }
    
    if (params.$where) {
      url.searchParams.append('$where', params.$where);
    }
    
    if (params.$order) {
      url.searchParams.append('$order', params.$order);
    }
    
    // Add app token if available (increases rate limits)
    if (this.appToken) {
      url.searchParams.append('$$app_token', this.appToken);
    }

    console.log(`Fetching from: ${url.toString()}`);

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/json',
          'X-App-Token': this.appToken || ''
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching dataset ${dataset.name}:`, error);
      throw error;
    }
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
    } = {}
  ): Promise<any[]> {
    const {
      maxRecords,
      batchSize = 5000, // Increased from 1000 to 5000 for better performance
      retryAttempts = 3,
      streamMode = true // Don't accumulate all records in memory by default
    } = options;

    const allRecords: any[] = streamMode ? [] : [];
    let offset = 0;
    const limit = Math.min(batchSize, params.$limit || 50000); // Cap at Socrata's max limit
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

    console.log(`Starting large dataset fetch with batch size: ${limit.toLocaleString()}`);

    while (hasMore && (!maxRecords || totalProcessed < maxRecords)) {
      let batch: any[] = [];
      let attempt = 0;
      let success = false;

      // Retry logic for robust fetching
      while (attempt < retryAttempts && !success) {
        try {
          const batchParams = {
            ...sortParams,
            $limit: Math.min(limit, maxRecords ? maxRecords - totalProcessed : limit),
            $offset: offset
          };

          console.log(`Fetching batch: offset=${offset.toLocaleString()}, limit=${batchParams.$limit.toLocaleString()}`);
          batch = await this.fetchDataset(dataset, batchParams);
          success = true;

        } catch (error) {
          attempt++;
          console.error(`Attempt ${attempt}/${retryAttempts} failed for offset ${offset}:`, error);
          
          if (attempt < retryAttempts) {
            const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 10000); // Exponential backoff, max 10s
            console.log(`Retrying in ${backoffDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
          } else {
            throw new Error(`Failed to fetch batch after ${retryAttempts} attempts: ${error}`);
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
        
        totalProcessed += batch.length;
        
        // Call the batch processor
        if (onBatch) {
          const progress = {
            current: totalProcessed,
            estimated: estimatedTotal
          };
          await onBatch(batch, offset, progress);
        }
        
        const progressPct = estimatedTotal 
          ? `(${Math.round((totalProcessed / estimatedTotal) * 100)}%)`
          : '';
        console.log(`Processed ${batch.length.toLocaleString()} records, total: ${totalProcessed.toLocaleString()} ${progressPct}`);
        
        // Check if we've reached the end or hit our limit
        if (batch.length < batchParams.$limit || (maxRecords && totalProcessed >= maxRecords)) {
          console.log('Reached end of dataset or record limit');
          hasMore = false;
        } else {
          offset += batch.length;
          
          // Adaptive delay based on batch size to avoid rate limiting
          const delay = Math.max(50, Math.min(500, Math.floor(batch.length / 10)));
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.log(`Dataset fetch completed. Total records processed: ${totalProcessed.toLocaleString()}`);
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

  async getRecordCount(dataset: NYCDataset, where?: string): Promise<number> {
    const params: Record<string, any> = {
      $select: 'count(*) as count'
    };

    if (where) {
      params.$where = where;
    }

    const result = await this.fetchDataset(dataset, params);
    return result[0]?.count ? parseInt(result[0].count) : 0;
  }
}