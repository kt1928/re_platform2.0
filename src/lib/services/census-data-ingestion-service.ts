import { CensusApiClient, CensusData, CENSUS_VARIABLES } from './census-api-client';
import { prisma } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

interface CensusSyncLog {
  datasetType: string;
  year: number;
  geography: string;
  recordsProcessed: number;
  recordsAdded: number;
  recordsUpdated: number;
  recordsFailed: number;
  startTime: Date;
  endTime: Date;
  status: 'success' | 'partial' | 'failed';
  errorMessage: string | null;
}

export class CensusDataIngestionService {
  private client: CensusApiClient;

  constructor(apiKey?: string) {
    this.client = new CensusApiClient(apiKey);
  }

  /**
   * Ingest Census ZIP code data for a specific year
   */
  async ingestZipCodeData(
    year: number, 
    state?: string,
    options: { batchSize?: number; maxRecords?: number; testMode?: boolean } = {}
  ): Promise<CensusSyncLog> {
    const { batchSize = 1000, maxRecords, testMode = false } = options;
    const startTime = new Date();
    
    const syncLog: CensusSyncLog = {
      datasetType: 'zip_code_data',
      year,
      geography: state || 'all_states',
      recordsProcessed: 0,
      recordsAdded: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      startTime,
      endTime: new Date(),
      status: 'success',
      errorMessage: null
    };

    try {
      console.log(`Starting Census ZIP code data ingestion for year ${year}${state ? ` (state: ${state})` : ''}`);

      // Fetch data from Census API
      const censusData = await this.client.fetchZipCodeData(year, state, testMode);
      
      if (censusData.length === 0) {
        throw new Error('No data returned from Census API');
      }

      let dataToProcess = censusData;
      if (maxRecords && censusData.length > maxRecords) {
        dataToProcess = censusData.slice(0, maxRecords);
        console.log(`Limiting to ${maxRecords} records for testing`);
      }

      console.log(`Processing ${dataToProcess.length} ZIP code records in batches of ${batchSize}`);

      // Process records in batches
      for (let i = 0; i < dataToProcess.length; i += batchSize) {
        const batch = dataToProcess.slice(i, i + batchSize);
        
        for (const record of batch) {
          try {
            await this.processZipCodeRecord(record, year);
            syncLog.recordsAdded++;
          } catch (error) {
            console.error(`Error processing ZIP code ${record.zipCode}:`, error);
            syncLog.recordsFailed++;
          }
          syncLog.recordsProcessed++;
        }

        // Log progress
        console.log(`Processed ${Math.min(i + batchSize, dataToProcess.length)}/${dataToProcess.length} records`);
        
        // Small delay to avoid overwhelming the database
        if (i + batchSize < dataToProcess.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      syncLog.status = syncLog.recordsFailed === 0 ? 'success' : 'partial';
      syncLog.endTime = new Date();

      console.log(`Census data ingestion completed. Processed: ${syncLog.recordsProcessed}, Added: ${syncLog.recordsAdded}, Failed: ${syncLog.recordsFailed}`);

    } catch (error) {
      syncLog.status = 'failed';
      syncLog.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      syncLog.endTime = new Date();
      console.error('Census data ingestion failed:', error);
    }

    // Log the sync operation
    await this.logSync(syncLog);
    return syncLog;
  }

  /**
   * Process a single ZIP code record
   */
  private async processZipCodeRecord(record: CensusData, year: number): Promise<void> {
    if (!record.zipCode || !record.state) {
      throw new Error('Missing required ZIP code or state');
    }

    // Map Census API response to our database schema
    const data = {
      zipCode: record.zipCode,
      state: record.state,
      year,
      
      // Population
      totalPopulation: this.parseNumber(record['B01003_001E']),
      
      // Income
      medianHouseholdIncome: this.parseNumber(record['B19013_001E']),
      medianFamilyIncome: this.parseNumber(record['B19113_001E']),
      
      // Employment
      employedCivilian: this.parseNumber(record['B23025_002E']),
      unemployed: this.parseNumber(record['B23025_005E']),
      
      // Housing Tenure
      ownerOccupiedHousing: this.parseNumber(record['B25003_002E']),
      renterOccupiedHousing: this.parseNumber(record['B25003_003E']),
      
      // Housing Units by Structure
      housingUnitsTotal: this.parseNumber(record['B25024_001E']),
      singleDetached: this.parseNumber(record['B25024_002E']),
      singleAttached: this.parseNumber(record['B25024_003E']),
      units2: this.parseNumber(record['B25024_004E']),
      units3to4: this.parseNumber(record['B25024_005E']),
      units5to9: this.parseNumber(record['B25024_006E']),
      units10to19: this.parseNumber(record['B25024_007E']),
      units20to49: this.parseNumber(record['B25024_008E']),
      units50plus: this.parseNumber(record['B25024_009E']),
      mobileHome: this.parseNumber(record['B25024_010E']),
      
      // Income Distribution
      incomeLess10k: this.parseNumber(record['B19001_002E']),
      income10kTo14k: this.parseNumber(record['B19001_003E']),
      income15kTo19k: this.parseNumber(record['B19001_004E']),
      income20kTo24k: this.parseNumber(record['B19001_005E']),
      income25kTo29k: this.parseNumber(record['B19001_006E']),
      income30kTo34k: this.parseNumber(record['B19001_007E']),
      income35kTo39k: this.parseNumber(record['B19001_008E']),
      income40kTo44k: this.parseNumber(record['B19001_009E']),
      income45kTo49k: this.parseNumber(record['B19001_010E']),
      income50kTo59k: this.parseNumber(record['B19001_011E']),
      income60kTo74k: this.parseNumber(record['B19001_012E']),
      income75kTo99k: this.parseNumber(record['B19001_013E']),
      income100kTo124k: this.parseNumber(record['B19001_014E']),
      income125kTo149k: this.parseNumber(record['B19001_015E']),
      income150kTo199k: this.parseNumber(record['B19001_016E']),
      income200kPlus: this.parseNumber(record['B19001_017E']),
      
      // Demographics by Age and Sex
      totalPopulationBySex: this.parseNumber(record['B01001_001E']),
      maleUnder5: this.parseNumber(record['B01001_003E']),
      femaleUnder5: this.parseNumber(record['B01001_027E']),
      male5to9: this.parseNumber(record['B01001_004E']),
      female5to9: this.parseNumber(record['B01001_028E']),
      male10to14: this.parseNumber(record['B01001_005E']),
      female10to14: this.parseNumber(record['B01001_029E']),
      male15to17: this.parseNumber(record['B01001_006E']),
      female15to17: this.parseNumber(record['B01001_030E']),
      male18to19: this.parseNumber(record['B01001_007E']),
      female18to19: this.parseNumber(record['B01001_031E']),
      male20: this.parseNumber(record['B01001_008E']),
      female20: this.parseNumber(record['B01001_032E']),
      male21: this.parseNumber(record['B01001_009E']),
      female21: this.parseNumber(record['B01001_033E']),
      male22to24: this.parseNumber(record['B01001_010E']),
      female22to24: this.parseNumber(record['B01001_034E']),
      male25to29: this.parseNumber(record['B01001_011E']),
      female25to29: this.parseNumber(record['B01001_035E']),
      male30to34: this.parseNumber(record['B01001_012E']),
      female30to34: this.parseNumber(record['B01001_036E']),
      male35to39: this.parseNumber(record['B01001_013E']),
      female35to39: this.parseNumber(record['B01001_037E']),
      male60to61: this.parseNumber(record['B01001_017E']),
      female60to61: this.parseNumber(record['B01001_041E']),
      male65to66: this.parseNumber(record['B01001_020E']),
      female65to66: this.parseNumber(record['B01001_044E']),
      
      dataSourceId: 'census_acs5'
    };

    // Insert or update the record using upsert
    await prisma.censusZipCodeData.upsert({
      where: {
        zipCode_state_year: {
          zipCode: data.zipCode,
          state: data.state,
          year: data.year
        }
      },
      update: {
        ...data,
        updatedAt: new Date()
      },
      create: {
        id: uuidv4(),
        ...data
      }
    });
  }

  /**
   * Parse number values, handling Census API null values and error codes
   */
  private parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '' || value === -666666666) {
      return null;
    }
    const parsed = Number(value);
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Log sync operation to database
   */
  private async logSync(syncLog: CensusSyncLog): Promise<void> {
    await prisma.censusDataSyncLog.create({
      data: {
        id: uuidv4(),
        datasetType: syncLog.datasetType,
        year: syncLog.year,
        geography: syncLog.geography,
        recordsProcessed: syncLog.recordsProcessed,
        recordsAdded: syncLog.recordsAdded,
        recordsUpdated: syncLog.recordsUpdated,
        recordsFailed: syncLog.recordsFailed,
        startTime: syncLog.startTime,
        endTime: syncLog.endTime,
        status: syncLog.status,
        errorMessage: syncLog.errorMessage
      }
    });
  }

  /**
   * Get the last successful sync for a specific year and geography
   */
  async getLastSyncInfo(year: number, geography: string = 'all_states'): Promise<Date | null> {
    try {
      const lastSync = await prisma.censusDataSyncLog.findFirst({
        where: {
          year,
          geography,
          status: { in: ['success', 'partial'] }
        },
        orderBy: { endTime: 'desc' },
        select: { endTime: true }
      });
      return lastSync?.endTime || null;
    } catch (error) {
      console.error('Error getting last sync info:', error);
      return null;
    }
  }

  /**
   * Get sync logs with filtering
   */
  async getSyncLogs(
    filters: {
      year?: number;
      geography?: string;
      status?: string;
      limit?: number;
      offset?: number;
    } = {}
  ) {
    const { year, geography, status, limit = 50, offset = 0 } = filters;

    const where: any = {};
    if (year) where.year = year;
    if (geography) where.geography = geography;
    if (status) where.status = status;

    const [logs, total] = await Promise.all([
      prisma.censusDataSyncLog.findMany({
        where,
        orderBy: { startTime: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.censusDataSyncLog.count({ where })
    ]);

    return { logs, total, limit, offset };
  }

  /**
   * Get Census data counts by year
   */
  async getDataCounts(): Promise<Record<number, number>> {
    const counts = await prisma.censusZipCodeData.groupBy({
      by: ['year'],
      _count: true
    });

    return counts.reduce((acc, item) => {
      acc[item.year] = item._count;
      return acc;
    }, {} as Record<number, number>);
  }

  /**
   * Test Census API connection
   */
  async testConnection(): Promise<boolean> {
    return this.client.testConnection();
  }

  /**
   * Get available years from the Census API client
   */
  getAvailableYears(): number[] {
    return this.client.getAvailableYears();
  }

  /**
   * Get state FIPS codes
   */
  getStateFipsCodes(): Record<string, string> {
    return this.client.getStateFipsCodes();
  }
}