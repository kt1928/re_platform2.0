import { prisma } from '@/lib/db';
import { NYCOpenDataClient, NYC_DATASETS } from '@/lib/data-sources/nyc-open-data';
import { v4 as uuidv4 } from 'uuid';

export class NYCDataIngestionService {
  private client: NYCOpenDataClient;

  constructor(appToken?: string) {
    this.client = new NYCOpenDataClient(appToken);
  }

  async ingestPropertySales(
    userId: string,
    options: {
      fullSync?: boolean;
      fromDate?: Date;
      limit?: number;
    } = {}
  ) {
    const startTime = new Date();
    const syncLog = {
      datasetId: NYC_DATASETS.PROPERTY_SALES.id,
      datasetName: NYC_DATASETS.PROPERTY_SALES.name,
      syncType: options.fullSync ? 'full' : 'incremental',
      recordsProcessed: 0,
      recordsAdded: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      startTime,
      endTime: new Date(),
      status: 'in_progress' as const,
      errorMessage: null,
      lastRecordDate: null as Date | null
    };

    try {
      console.log(`Starting ${syncLog.syncType} sync for NYC Property Sales...`);

      // Build query parameters
      const params: Record<string, any> = {
        $order: 'sale_date DESC'
      };

      if (!options.fullSync && options.fromDate) {
        params.$where = `sale_date > '${options.fromDate.toISOString().split('T')[0]}'`;
      }

      if (options.limit) {
        params.$limit = options.limit;
      }

      // Process in batches with improved pagination and error handling
      await this.client.fetchAllRecords(
        NYC_DATASETS.PROPERTY_SALES,
        params,
        async (batch, offset, progress) => {
          console.log(`Processing batch of ${batch.length} records (progress: ${progress.current}/${progress.estimated || '?'})`);
          
          for (const record of batch) {
            try {
              await this.processPropertySaleRecord(record, userId);
              syncLog.recordsAdded++;
            } catch (error) {
              console.error('Error processing record:', error);
              syncLog.recordsFailed++;
            }
            syncLog.recordsProcessed++;
          }

          // Update last record date
          if (batch.length > 0) {
            const lastRecord = batch[batch.length - 1];
            if (lastRecord.sale_date) {
              const recordDate = new Date(lastRecord.sale_date);
              if (!syncLog.lastRecordDate || recordDate > syncLog.lastRecordDate) {
                syncLog.lastRecordDate = recordDate;
              }
            }
          }
        },
        {
          maxRecords: options.limit,
          batchSize: options.fullSync ? 10000 : 5000,
          retryAttempts: 3,
          streamMode: true
        }
      );

      syncLog.status = syncLog.recordsFailed === 0 ? 'success' : 'partial';
      syncLog.endTime = new Date();

      console.log(`Sync completed. Processed: ${syncLog.recordsProcessed}, Added: ${syncLog.recordsAdded}, Failed: ${syncLog.recordsFailed}`);

    } catch (error) {
      syncLog.status = 'failed';
      syncLog.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      syncLog.endTime = new Date();
      console.error('Sync failed:', error);
    }

    // Log the sync operation
    await this.logSync(syncLog);

    return syncLog;
  }

  private async processPropertySaleRecord(record: any, userId: string) {
    // Clean and validate the data
    const salePrice = this.parseNumber(record.sale_price);
    const saleDate = record.sale_date ? new Date(record.sale_date) : null;
    
    if (!saleDate || !record.borough || !record.block || !record.lot) {
      throw new Error('Missing required fields');
    }

    // Skip invalid sales (e.g., $0 sales)
    if (!salePrice || salePrice <= 0) {
      return;
    }

    const data = {
      borough: parseInt(record.borough),
      neighborhood: record.neighborhood?.trim() || null,
      buildingClassName: record.building_class_category?.trim() || null,
      taxClassAtSale: record.tax_class_at_present?.trim() || null,
      block: parseInt(record.block),
      lot: parseInt(record.lot),
      easement: record.ease_ment?.trim() || null,
      buildingClassAtSale: record.building_class_at_present?.trim() || null,
      address: record.address?.trim() || null,
      apartmentNumber: record.apartment_number?.trim() || null,
      zipCode: record.zip_code?.trim() || null,
      residentialUnits: this.parseNumber(record.residential_units?.replace(/,/g, '')),
      commercialUnits: this.parseNumber(record.commercial_units?.replace(/,/g, '')),
      totalUnits: this.parseNumber(record.total_units?.replace(/,/g, '')),
      landSquareFeet: this.parseNumber(record.land_square_feet?.replace(/,/g, '')),
      grossSquareFeet: this.parseNumber(record.gross_square_feet?.replace(/,/g, '')),
      yearBuilt: this.parseNumber(record.year_built),
      taxClassAtTime: record.tax_class_at_time_of_sale?.trim() || null,
      buildingClassAtTime: record.building_class_at_time_of?.trim() || null,
      salePrice,
      saleDate,
      dataSourceId: NYC_DATASETS.PROPERTY_SALES.id
    };

    // Insert or update the record
    await prisma.$executeRaw`
      INSERT INTO nyc_property_sales (
        id, borough, neighborhood, building_class_name, tax_class_at_sale,
        block, lot, easement, building_class_at_sale, address,
        apartment_number, zip_code, residential_units, commercial_units,
        total_units, land_square_feet, gross_square_feet, year_built,
        tax_class_at_time, building_class_at_time, sale_price, sale_date,
        data_source_id, created_at, updated_at
      ) VALUES (
        ${uuidv4()}::uuid, ${data.borough}, ${data.neighborhood}, ${data.buildingClassName}, 
        ${data.taxClassAtSale}, ${data.block}, ${data.lot}, ${data.easement}, 
        ${data.buildingClassAtSale}, ${data.address}, ${data.apartmentNumber}, 
        ${data.zipCode}, ${data.residentialUnits}, ${data.commercialUnits}, 
        ${data.totalUnits}, ${data.landSquareFeet}, ${data.grossSquareFeet}, 
        ${data.yearBuilt}, ${data.taxClassAtTime}, ${data.buildingClassAtTime}, 
        ${data.salePrice}, ${data.saleDate}, ${data.dataSourceId}, NOW(), NOW()
      )
      ON CONFLICT (borough, block, lot, sale_date) 
      DO UPDATE SET
        neighborhood = EXCLUDED.neighborhood,
        building_class_name = EXCLUDED.building_class_name,
        tax_class_at_sale = EXCLUDED.tax_class_at_sale,
        address = EXCLUDED.address,
        apartment_number = EXCLUDED.apartment_number,
        zip_code = EXCLUDED.zip_code,
        residential_units = EXCLUDED.residential_units,
        commercial_units = EXCLUDED.commercial_units,
        total_units = EXCLUDED.total_units,
        land_square_feet = EXCLUDED.land_square_feet,
        gross_square_feet = EXCLUDED.gross_square_feet,
        year_built = EXCLUDED.year_built,
        sale_price = EXCLUDED.sale_price,
        updated_at = NOW()
    `;

    // Also create/update a property record if we have enough data
    if (data.address && data.zipCode) {
      await this.createOrUpdateProperty(data, userId);
    }
  }

  private async createOrUpdateProperty(nycData: any, userId: string) {
    const propertyType = this.determinePropertyType(
      nycData.buildingClassAtSale,
      nycData.residentialUnits,
      nycData.commercialUnits
    );

    const propertyData = {
      addressLine1: nycData.address,
      city: 'New York',
      state: 'NY',
      zipCode: nycData.zipCode,
      propertyType,
      bedrooms: null, // NYC data doesn't include bedroom count
      bathrooms: null,
      squareFeet: nycData.grossSquareFeet,
      lotSize: nycData.landSquareFeet,
      yearBuilt: nycData.yearBuilt,
      listPrice: null, // This is sale price, not list price
      soldPrice: nycData.salePrice,
      rentEstimate: null,
      taxAssessedValue: null,
      latitude: null, // Would need geocoding
      longitude: null,
      dataSource: 'nyc_open_data',
      externalId: `NYC-${nycData.borough}-${nycData.block}-${nycData.lot}`
    };

    // Check if property exists
    const existing = await prisma.property.findFirst({
      where: {
        OR: [
          { externalId: propertyData.externalId },
          {
            addressLine1: propertyData.addressLine1,
            zipCode: propertyData.zipCode
          }
        ]
      }
    });

    if (existing) {
      // Update with NYC data if more recent
      await prisma.property.update({
        where: { id: existing.id },
        data: {
          soldPrice: propertyData.soldPrice,
          squareFeet: propertyData.squareFeet || existing.squareFeet,
          lotSize: propertyData.lotSize || existing.lotSize,
          yearBuilt: propertyData.yearBuilt || existing.yearBuilt,
          updatedAt: new Date()
        }
      });
    } else {
      // Create new property
      await prisma.property.create({
        data: {
          ...propertyData,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }
  }

  private determinePropertyType(
    buildingClass: string | null,
    residentialUnits: number | null,
    commercialUnits: number | null
  ): string {
    if (!buildingClass) {
      return 'SINGLE_FAMILY';
    }

    const code = buildingClass.toUpperCase();
    
    // Based on NYC building class codes
    if (code.startsWith('A') || code.startsWith('B')) {
      return 'SINGLE_FAMILY';
    } else if (code.startsWith('C')) {
      return 'MULTI_FAMILY';
    } else if (code.startsWith('R')) {
      return 'CONDO';
    } else if (code.startsWith('K') || code.startsWith('D')) {
      return 'COMMERCIAL';
    }

    // Fallback based on unit count
    if (commercialUnits && commercialUnits > 0) {
      return 'COMMERCIAL';
    } else if (residentialUnits && residentialUnits > 1) {
      return 'MULTI_FAMILY';
    }

    return 'SINGLE_FAMILY';
  }

  private parseNumber(value: any): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }

  // Helper method to get a meaningful identifier for a record for logging
  private getRecordIdentifier(record: any, dataset: NYCDataset): string {
    if (dataset.primaryKey && dataset.primaryKey.length > 0) {
      const ids = dataset.primaryKey.map(key => record[key]).filter(Boolean);
      if (ids.length > 0) {
        return `(${ids.join(', ')})`;
      }
    }
    
    // Fallback identifiers for different datasets
    if (record.camis) return `CAMIS: ${record.camis}`;
    if (record.job_filing_number) return `Job: ${record.job_filing_number}`;
    if (record.violation_number) return `Violation: ${record.violation_number}`;
    if (record.cmplnt_num) return `Complaint: ${record.cmplnt_num}`;
    if (record.license_nbr) return `License: ${record.license_nbr}`;
    if (record.eventid) return `Event: ${record.eventid}`;
    
    return '(unknown ID)';
  }

  // Helper method to sanitize record data for safe logging (remove sensitive/large fields)
  private sanitizeRecordForLogging(record: any): any {
    const sanitized = { ...record };
    
    // Remove potentially large or sensitive fields
    const fieldsToRemove = ['job_description', 'nov_description', 'disposition_comments', 'description'];
    fieldsToRemove.forEach(field => {
      if (sanitized[field] && typeof sanitized[field] === 'string' && sanitized[field].length > 100) {
        sanitized[field] = sanitized[field].substring(0, 100) + '...';
      }
    });
    
    // Only show first few fields to avoid overwhelming logs
    const keys = Object.keys(sanitized);
    if (keys.length > 10) {
      const limitedRecord: any = {};
      keys.slice(0, 10).forEach(key => {
        limitedRecord[key] = sanitized[key];
      });
      limitedRecord['...'] = `(${keys.length - 10} more fields)`;
      return limitedRecord;
    }
    
    return sanitized;
  }

  private async logSync(syncLog: any) {
    await prisma.$executeRaw`
      INSERT INTO nyc_data_sync_logs (
        id, dataset_id, dataset_name, sync_type, records_processed,
        records_added, records_updated, records_failed, start_time,
        end_time, status, error_message, last_record_date, created_at
      ) VALUES (
        ${uuidv4()}::uuid, ${syncLog.datasetId}, ${syncLog.datasetName}, 
        ${syncLog.syncType}, ${syncLog.recordsProcessed}, ${syncLog.recordsAdded}, 
        ${syncLog.recordsUpdated}, ${syncLog.recordsFailed}, ${syncLog.startTime}, 
        ${syncLog.endTime}, ${syncLog.status}, ${syncLog.errorMessage}, 
        ${syncLog.lastRecordDate}, NOW()
      )
    `;
  }

  // Get the last successful sync date for incremental updates
  /**
   * Test processing a single record to diagnose potential issues
   */
  async testRecordProcessing(datasetKey: keyof typeof NYC_DATASETS, sampleRecord: any, userId: string): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      const dataset = NYC_DATASETS[datasetKey];
      console.log(`🧪 Testing record processing for ${dataset.name}...`);
      
      // Get the appropriate processing method
      let processMethod: (record: any, userId: string) => Promise<void>;
      
      switch (datasetKey) {
        case 'RESTAURANT_INSPECTIONS':
          processMethod = this.processRestaurantInspectionRecord.bind(this);
          break;
        case 'PROPERTY_SALES':
          processMethod = this.processPropertySaleRecord.bind(this);
          break;
        case 'DOB_NOW_PERMITS':
          processMethod = this.processDOBPermitRecord.bind(this);
          break;
        case 'DOB_VIOLATIONS':
          processMethod = this.processDOBViolationRecord.bind(this);
          break;
        default:
          throw new Error(`Test not implemented for dataset: ${datasetKey}`);
      }
      
      // Test the record processing
      await processMethod(sampleRecord, userId);
      
      console.log('✅ Record processed successfully');
      return { success: true };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Record processing failed:', {
        error: errorMessage,
        record: this.sanitizeRecordForLogging(sampleRecord)
      });
      
      return { 
        success: false, 
        error: errorMessage,
        details: {
          record: this.sanitizeRecordForLogging(sampleRecord),
          stack: error instanceof Error ? error.stack : undefined
        }
      };
    }
  }

  async getLastSyncDate(datasetId: string): Promise<Date | null> {
    const result = await prisma.$queryRaw<Array<{ last_record_date: Date | null }>>`
      SELECT last_record_date 
      FROM nyc_data_sync_logs 
      WHERE dataset_id = ${datasetId} 
        AND status IN ('success', 'partial')
      ORDER BY end_time DESC 
      LIMIT 1
    `;

    return result[0]?.last_record_date || null;
  }

  async ingestDOBPermits(
    userId: string,
    options: {
      fullSync?: boolean;
      fromDate?: Date;
      limit?: number;
    } = {}
  ) {
    const startTime = new Date();
    const syncLog = {
      datasetId: NYC_DATASETS.DOB_NOW_PERMITS.id,
      datasetName: NYC_DATASETS.DOB_NOW_PERMITS.name,
      syncType: options.fullSync ? 'full' : 'incremental',
      recordsProcessed: 0,
      recordsAdded: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      startTime,
      endTime: new Date(),
      status: 'in_progress' as const,
      errorMessage: null,
      lastRecordDate: null as Date | null
    };

    try {
      console.log(`Starting ${syncLog.syncType} sync for DOB Permits...`);

      const params: Record<string, any> = {
        $order: 'approved_date DESC'
      };

      if (!options.fullSync && options.fromDate) {
        params.$where = `approved_date > '${options.fromDate.toISOString().split('T')[0]}'`;
      }

      if (options.limit) {
        params.$limit = options.limit;
      }

      await this.client.fetchAllRecords(
        NYC_DATASETS.DOB_NOW_PERMITS,
        params,
        async (batch, offset) => {
          for (const record of batch) {
            try {
              await this.processDOBPermitRecord(record, userId);
              syncLog.recordsAdded++;
            } catch (error) {
              console.error('Error processing DOB permit record:', error);
              syncLog.recordsFailed++;
            }
            syncLog.recordsProcessed++;
          }

          if (batch.length > 0) {
            const lastRecord = batch[batch.length - 1];
            if (lastRecord.approved_date) {
              const recordDate = new Date(lastRecord.approved_date);
              if (!syncLog.lastRecordDate || recordDate > syncLog.lastRecordDate) {
                syncLog.lastRecordDate = recordDate;
              }
            }
          }
        }
      );

      syncLog.status = syncLog.recordsFailed === 0 ? 'success' : 'partial';
      syncLog.endTime = new Date();

      console.log(`DOB Permits sync completed. Processed: ${syncLog.recordsProcessed}, Added: ${syncLog.recordsAdded}, Failed: ${syncLog.recordsFailed}`);

    } catch (error) {
      syncLog.status = 'failed';
      syncLog.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      syncLog.endTime = new Date();
      console.error('DOB Permits sync failed:', error);
    }

    await this.logSync(syncLog);
    return syncLog;
  }

  async ingestDOBViolations(
    userId: string,
    options: {
      fullSync?: boolean;
      fromDate?: Date;
      limit?: number;
    } = {}
  ) {
    const startTime = new Date();
    const syncLog = {
      datasetId: NYC_DATASETS.DOB_VIOLATIONS.id,
      datasetName: NYC_DATASETS.DOB_VIOLATIONS.name,
      syncType: options.fullSync ? 'full' : 'incremental',
      recordsProcessed: 0,
      recordsAdded: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      startTime,
      endTime: new Date(),
      status: 'in_progress' as const,
      errorMessage: null,
      lastRecordDate: null as Date | null
    };

    try {
      console.log(`Starting ${syncLog.syncType} sync for DOB Violations...`);

      const params: Record<string, any> = {
        $order: 'issue_date DESC'
      };

      if (!options.fullSync && options.fromDate) {
        // DOB Violations use YYYYMMDD format
        const dateStr = options.fromDate.toISOString().slice(0, 10).replace(/-/g, '');
        params.$where = `issue_date > '${dateStr}'`;
      }

      if (options.limit) {
        params.$limit = options.limit;
      }

      await this.client.fetchAllRecords(
        NYC_DATASETS.DOB_VIOLATIONS,
        params,
        async (batch, offset) => {
          for (const record of batch) {
            try {
              await this.processDOBViolationRecord(record, userId);
              syncLog.recordsAdded++;
            } catch (error) {
              console.error('Error processing DOB violation record:', error);
              syncLog.recordsFailed++;
            }
            syncLog.recordsProcessed++;
          }

          if (batch.length > 0) {
            const lastRecord = batch[batch.length - 1];
            if (lastRecord.issue_date) {
              // Convert YYYYMMDD to Date
              const dateStr = lastRecord.issue_date;
              if (dateStr && dateStr.length === 8) {
                const year = parseInt(dateStr.substring(0, 4));
                const month = parseInt(dateStr.substring(4, 6)) - 1; // Month is 0-indexed
                const day = parseInt(dateStr.substring(6, 8));
                const recordDate = new Date(year, month, day);
                if (!syncLog.lastRecordDate || recordDate > syncLog.lastRecordDate) {
                  syncLog.lastRecordDate = recordDate;
                }
              }
            }
          }
        }
      );

      syncLog.status = syncLog.recordsFailed === 0 ? 'success' : 'partial';
      syncLog.endTime = new Date();

      console.log(`DOB Violations sync completed. Processed: ${syncLog.recordsProcessed}, Added: ${syncLog.recordsAdded}, Failed: ${syncLog.recordsFailed}`);

    } catch (error) {
      syncLog.status = 'failed';
      syncLog.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      syncLog.endTime = new Date();
      console.error('DOB Violations sync failed:', error);
    }

    await this.logSync(syncLog);
    return syncLog;
  }

  private async processDOBPermitRecord(record: any, userId: string) {
    if (!record.work_permit) {
      throw new Error('Missing work permit number');
    }

    const data = {
      jobFilingNumber: record.job_filing_number?.trim() || '',
      filingReason: record.filing_reason?.trim() || null,
      borough: record.borough?.trim() || null,
      block: record.block?.trim() || null,
      lot: record.lot?.trim() || null,
      houseNumber: record.house_no?.trim() || null,
      streetName: record.street_name?.trim() || null,
      bin: record.bin?.trim() || null,
      workOnFloor: record.work_on_floor?.trim() || null,
      workType: record.work_type?.trim() || null,
      workPermit: record.work_permit.trim(),
      approvedDate: record.approved_date ? new Date(record.approved_date) : null,
      issuedDate: record.issued_date ? new Date(record.issued_date) : null,
      estimatedJobCosts: this.parseNumber(record.estimated_job_costs),
      jobDescription: record.job_description?.trim() || null,
      dataSourceId: NYC_DATASETS.DOB_NOW_PERMITS.id
    };

    await prisma.$executeRaw`
      INSERT INTO nyc_dob_permits (
        id, job_filing_number, filing_reason, borough, block, lot,
        house_number, street_name, bin, work_on_floor, work_type,
        work_permit, approved_date, issued_date, estimated_job_costs,
        job_description, data_source_id, created_at, updated_at
      ) VALUES (
        ${uuidv4()}::uuid, ${data.jobFilingNumber}, ${data.filingReason}, 
        ${data.borough}, ${data.block}, ${data.lot}, ${data.houseNumber}, 
        ${data.streetName}, ${data.bin}, ${data.workOnFloor}, ${data.workType}, 
        ${data.workPermit}, ${data.approvedDate}, ${data.issuedDate}, 
        ${data.estimatedJobCosts}, ${data.jobDescription}, ${data.dataSourceId}, 
        NOW(), NOW()
      )
      ON CONFLICT (work_permit) 
      DO UPDATE SET
        filing_reason = EXCLUDED.filing_reason,
        approved_date = EXCLUDED.approved_date,
        issued_date = EXCLUDED.issued_date,
        estimated_job_costs = EXCLUDED.estimated_job_costs,
        job_description = EXCLUDED.job_description,
        updated_at = NOW()
    `;
  }

  private async processDOBViolationRecord(record: any, userId: string) {
    if (!record.violation_number) {
      throw new Error('Missing violation number');
    }

    const data = {
      isnDobBisViol: record.isn_dob_bis_viol?.trim() || null,
      borough: record.boro?.trim() || null,
      block: record.block?.trim() || null,
      lot: record.lot?.trim() || null,
      issueDate: record.issue_date?.trim() || null,
      violationTypeCode: record.violation_type_code?.trim() || null,
      violationNumber: record.violation_number.trim(),
      houseNumber: record.house_number?.trim() || null,
      street: record.street?.trim() || null,
      dispositionComments: record.disposition_comments?.trim() || null,
      deviceNumber: record.device_number?.trim() || null,
      description: record.description?.trim() || null,
      number: record.number?.trim() || null,
      violationCategory: record.violation_category?.trim() || null,
      violationType: record.violation_type?.trim() || null,
      dataSourceId: NYC_DATASETS.DOB_VIOLATIONS.id
    };

    await prisma.$executeRaw`
      INSERT INTO nyc_dob_violations (
        id, isn_dob_bis_viol, boro, block, lot, issue_date,
        violation_type_code, violation_number, house_number, street,
        disposition_comments, device_number, description, number,
        violation_category, violation_type, data_source_id, created_at, updated_at
      ) VALUES (
        ${uuidv4()}::uuid, ${data.isnDobBisViol}, ${data.borough}, ${data.block}, 
        ${data.lot}, ${data.issueDate}, ${data.violationTypeCode}, ${data.violationNumber}, 
        ${data.houseNumber}, ${data.street}, ${data.dispositionComments}, ${data.deviceNumber}, 
        ${data.description}, ${data.number}, ${data.violationCategory}, ${data.violationType}, 
        ${data.dataSourceId}, NOW(), NOW()
      )
      ON CONFLICT (violation_number) 
      DO UPDATE SET
        disposition_comments = EXCLUDED.disposition_comments,
        description = EXCLUDED.description,
        violation_category = EXCLUDED.violation_category,
        updated_at = NOW()
    `;
  }

  // Additional dataset ingestion methods
  async ingestPropertyValuation2024(userId: string, options: { fullSync?: boolean; fromDate?: Date; limit?: number; } = {}) {
    return this.ingestGenericDataset('PROPERTY_VALUATION_FY2024', 'nyc_property_valuation_2024', userId, options, this.processPropertyValuation2024Record.bind(this));
  }

  async ingestPropertyValuation2023(userId: string, options: { fullSync?: boolean; fromDate?: Date; limit?: number; } = {}) {
    return this.ingestGenericDataset('PROPERTY_VALUATION_FY2023', 'nyc_property_valuation_2023', userId, options, this.processPropertyValuation2023Record.bind(this));
  }

  async ingestComplaintData(userId: string, options: { fullSync?: boolean; fromDate?: Date; limit?: number; } = {}) {
    return this.ingestGenericDataset('COMPLAINT_DATA', 'nyc_complaint_data', userId, options, this.processComplaintDataRecord.bind(this));
  }

  async ingestTaxDebtData(userId: string, options: { fullSync?: boolean; fromDate?: Date; limit?: number; } = {}) {
    return this.ingestGenericDataset('TAX_DEBT_DATA', 'nyc_tax_debt_data', userId, options, this.processTaxDebtDataRecord.bind(this));
  }

  async ingestBusinessLicenses(userId: string, options: { fullSync?: boolean; fromDate?: Date; limit?: number; } = {}) {
    return this.ingestGenericDataset('BUSINESS_LICENSES', 'nyc_business_licenses', userId, options, this.processBusinessLicenseRecord.bind(this));
  }

  async ingestEventPermits(userId: string, options: { fullSync?: boolean; fromDate?: Date; limit?: number; } = {}) {
    return this.ingestGenericDataset('EVENT_PERMITS', 'nyc_event_permits', userId, options, this.processEventPermitRecord.bind(this));
  }

  async ingestBuildJobFilings(userId: string, options: { fullSync?: boolean; fromDate?: Date; limit?: number; } = {}) {
    return this.ingestGenericDataset('BUILD_JOB_FILINGS', 'nyc_build_job_filings', userId, options, this.processBuildJobFilingRecord.bind(this));
  }

  async ingestRestaurantInspections(userId: string, options: { fullSync?: boolean; fromDate?: Date; limit?: number; } = {}) {
    return this.ingestGenericDataset('RESTAURANT_INSPECTIONS', 'nyc_restaurant_inspections', userId, options, this.processRestaurantInspectionRecord.bind(this));
  }

  // Generic ingestion method to reduce code duplication
  private async ingestGenericDataset(
    datasetKey: keyof typeof NYC_DATASETS,
    tableName: string,
    userId: string,
    options: { fullSync?: boolean; fromDate?: Date; limit?: number; },
    processRecord: (record: any, userId: string) => Promise<void>
  ) {
    const dataset = NYC_DATASETS[datasetKey];
    const startTime = new Date();
    const syncLog = {
      datasetId: dataset.id,
      datasetName: dataset.name,
      syncType: options.fullSync ? 'full' : 'incremental',
      recordsProcessed: 0,
      recordsAdded: 0,
      recordsUpdated: 0,
      recordsFailed: 0,
      startTime,
      endTime: new Date(),
      status: 'in_progress' as const,
      errorMessage: null,
      lastRecordDate: null as Date | null
    };

    try {
      console.log(`Starting ${syncLog.syncType} sync for ${dataset.name}...`);

      const params: Record<string, any> = {};

      if (dataset.dateField) {
        params.$order = `${dataset.dateField} DESC`;
        
        if (!options.fullSync && options.fromDate) {
          if (dataset.dateField === 'issue_date') {
            // DOB Violations use YYYYMMDD format
            const dateStr = options.fromDate.toISOString().slice(0, 10).replace(/-/g, '');
            params.$where = `${dataset.dateField} > '${dateStr}'`;
          } else {
            params.$where = `${dataset.dateField} > '${options.fromDate.toISOString().split('T')[0]}'`;
          }
        }
      }

      if (options.limit) {
        params.$limit = options.limit;
      }

      await this.client.fetchAllRecords(
        dataset,
        params,
        async (batch, offset, progress) => {
          const progressStr = progress.estimated 
            ? `${progress.current.toLocaleString()}/${progress.estimated.toLocaleString()} (${Math.round((progress.current / progress.estimated) * 100)}%)`
            : `${progress.current.toLocaleString()}`;
          console.log(`Processing ${dataset.name} batch: ${batch.length} records, total progress: ${progressStr}`);
          
          for (const record of batch) {
            try {
              await processRecord(record, userId);
              syncLog.recordsAdded++;
            } catch (error) {
              // Enhanced error logging with record details
              const recordId = this.getRecordIdentifier(record, dataset);
              console.error(`❌ Error processing ${dataset.name} record ${recordId}:`, {
                error: error instanceof Error ? error.message : String(error),
                record: this.sanitizeRecordForLogging(record),
                stack: error instanceof Error ? error.stack : undefined
              });
              syncLog.recordsFailed++;
            }
            syncLog.recordsProcessed++;
          }

          if (batch.length > 0 && dataset.dateField) {
            const lastRecord = batch[batch.length - 1];
            if (lastRecord[dataset.dateField]) {
              let recordDate: Date;
              
              if (dataset.dateField === 'issue_date' && typeof lastRecord[dataset.dateField] === 'string') {
                // Handle YYYYMMDD format
                const dateStr = lastRecord[dataset.dateField];
                if (dateStr.length === 8) {
                  const year = parseInt(dateStr.substring(0, 4));
                  const month = parseInt(dateStr.substring(4, 6)) - 1;
                  const day = parseInt(dateStr.substring(6, 8));
                  recordDate = new Date(year, month, day);
                } else {
                  recordDate = new Date(lastRecord[dataset.dateField]);
                }
              } else {
                recordDate = new Date(lastRecord[dataset.dateField]);
              }
              
              if (!syncLog.lastRecordDate || recordDate > syncLog.lastRecordDate) {
                syncLog.lastRecordDate = recordDate;
              }
            }
          }
        },
        {
          maxRecords: options.limit,
          batchSize: options.fullSync ? 10000 : 5000,
          retryAttempts: 3,
          streamMode: true
        }
      );

      syncLog.status = syncLog.recordsFailed === 0 ? 'success' : 'partial';
      syncLog.endTime = new Date();

      const duration = Math.round((syncLog.endTime.getTime() - syncLog.startTime.getTime()) / 1000);
      const successRate = syncLog.recordsProcessed > 0 ? Math.round((syncLog.recordsAdded / syncLog.recordsProcessed) * 100) : 0;
      
      console.log(`✅ ${dataset.name} sync completed:
        📊 Processed: ${syncLog.recordsProcessed.toLocaleString()} records
        ✅ Added: ${syncLog.recordsAdded.toLocaleString()} records
        ❌ Failed: ${syncLog.recordsFailed.toLocaleString()} records
        📈 Success Rate: ${successRate}%
        ⏱️ Duration: ${duration}s`);

      if (syncLog.recordsFailed > 0) {
        console.warn(`⚠️ ${syncLog.recordsFailed} records failed during ${dataset.name} sync. Check the detailed error logs above for specific failure reasons.`);
      }

    } catch (error) {
      syncLog.status = 'failed';
      syncLog.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      syncLog.endTime = new Date();
      console.error(`${dataset.name} sync failed:`, error);
    }

    await this.logSync(syncLog);
    return syncLog;
  }

  // Record processing methods for each dataset
  private async processPropertyValuation2024Record(record: any, userId: string) {
    if (!record.job_filing_number) {
      throw new Error('Missing job filing number');
    }

    const data = {
      jobFilingNumber: record.job_filing_number?.trim() || null,
      filingReason: record.filing_reason?.trim() || null,
      houseNumber: record.house_no?.trim() || null,
      streetName: record.street_name?.trim() || null,
      borough: record.borough?.trim() || null,
      lot: record.lot?.trim() || null,
      bin: record.bin?.trim() || null,
      block: record.block?.trim() || null,
      communityBoard: record.c_b_no?.trim() || null,
      workOnFloor: record.work_on_floor?.trim() || null,
      workType: record.work_type?.trim() || null,
      permitteeType: record.permittee_s_license_type?.trim() || null,
      applicantLicense: record.applicant_license?.trim() || null,
      applicantFirstName: record.applicant_first_name?.trim() || null,
      applicantLastName: record.applicant_last_name?.trim() || null,
      applicantBusinessName: record.applicant_business_name?.trim() || null,
      applicantBusinessAddress: record.applicant_business_address?.trim() || null,
      workPermit: record.work_permit?.trim() || null,
      jobDescription: record.job_description?.trim() || null,
      estimatedJobCosts: this.parseNumber(record.estimated_job_costs),
      ownerBusinessName: record.owner_business_name?.trim() || null,
      ownerName: record.owner_name?.trim() || null,
      dataSourceId: NYC_DATASETS.PROPERTY_VALUATION_FY2024.id
    };

    await prisma.$executeRaw`
      INSERT INTO nyc_property_valuation_2024 (
        id, job_filing_number, filing_reason, house_no, street_name, borough,
        lot, bin, block, c_b_no, work_on_floor, work_type, permittee_s_license_type,
        applicant_license, applicant_first_name, applicant_last_name, applicant_business_name,
        applicant_business_address, work_permit, job_description, estimated_job_costs,
        owner_business_name, owner_name, data_source_id, created_at, updated_at
      ) VALUES (
        ${uuidv4()}::uuid, ${data.jobFilingNumber}, ${data.filingReason}, ${data.houseNumber},
        ${data.streetName}, ${data.borough}, ${data.lot}, ${data.bin}, ${data.block},
        ${data.communityBoard}, ${data.workOnFloor}, ${data.workType}, ${data.permitteeType},
        ${data.applicantLicense}, ${data.applicantFirstName}, ${data.applicantLastName},
        ${data.applicantBusinessName}, ${data.applicantBusinessAddress}, ${data.workPermit},
        ${data.jobDescription}, ${data.estimatedJobCosts}, ${data.ownerBusinessName},
        ${data.ownerName}, ${data.dataSourceId}, NOW(), NOW()
      )
      ON CONFLICT (job_filing_number) 
      DO UPDATE SET
        filing_reason = EXCLUDED.filing_reason,
        work_permit = EXCLUDED.work_permit,
        job_description = EXCLUDED.job_description,
        estimated_job_costs = EXCLUDED.estimated_job_costs,
        updated_at = NOW()
    `;
  }

  private async processPropertyValuation2023Record(record: any, userId: string) {
    if (!record.court_index_number) {
      throw new Error('Missing court index number');
    }

    const data = {
      courtIndexNumber: record.court_index_number?.trim(),
      docketNumber: record.docket_number?.trim() || null,
      evictionAddress: record.eviction_address?.trim() || null,
      evictionAptNum: record.eviction_apt_num?.trim() || null,
      executedDate: record.executed_date ? new Date(record.executed_date) : null,
      marshalFirstName: record.marshal_first_name?.trim() || null,
      marshalLastName: record.marshal_last_name?.trim() || null,
      residentialCommercial: record.residential_commercial_ind?.trim() || null,
      borough: record.borough?.trim() || null,
      evictionZip: record.eviction_zip?.trim() || null,
      ejectment: record.ejectment?.trim() || null,
      evictionPossession: record.eviction_possession?.trim() || null,
      latitude: this.parseNumber(record.latitude),
      longitude: this.parseNumber(record.longitude),
      communityBoard: record.community_board?.trim() || null,
      councilDistrict: record.council_district?.trim() || null,
      censusTract: record.census_tract?.trim() || null,
      bin: record.bin?.trim() || null,
      bbl: record.bbl?.trim() || null,
      nta: record.nta?.trim() || null,
      dataSourceId: NYC_DATASETS.PROPERTY_VALUATION_FY2023.id
    };

    await prisma.$executeRaw`
      INSERT INTO nyc_property_valuation_2023 (
        id, court_index_number, docket_number, eviction_address, eviction_apt_num,
        executed_date, marshal_first_name, marshal_last_name, residential_commercial_ind,
        borough, eviction_zip, ejectment, eviction_possession, latitude, longitude,
        community_board, council_district, census_tract, bin, bbl, nta,
        data_source_id, created_at, updated_at
      ) VALUES (
        ${uuidv4()}::uuid, ${data.courtIndexNumber}, ${data.docketNumber}, ${data.evictionAddress},
        ${data.evictionAptNum}, ${data.executedDate}, ${data.marshalFirstName}, ${data.marshalLastName},
        ${data.residentialCommercial}, ${data.borough}, ${data.evictionZip}, ${data.ejectment},
        ${data.evictionPossession}, ${data.latitude}, ${data.longitude}, ${data.communityBoard},
        ${data.councilDistrict}, ${data.censusTract}, ${data.bin}, ${data.bbl}, ${data.nta},
        ${data.dataSourceId}, NOW(), NOW()
      )
      ON CONFLICT (court_index_number) 
      DO UPDATE SET
        eviction_address = EXCLUDED.eviction_address,
        executed_date = EXCLUDED.executed_date,
        updated_at = NOW()
    `;
  }

  private async processComplaintDataRecord(record: any, userId: string) {
    if (!record.cmplnt_num) {
      throw new Error('Missing complaint number');
    }

    const data = {
      complaintNumber: record.cmplnt_num.trim(),
      complaintFromDate: record.cmplnt_fr_dt ? new Date(record.cmplnt_fr_dt) : null,
      complaintFromTime: record.cmplnt_fr_tm?.trim() || null,
      complaintToDate: record.cmplnt_to_dt ? new Date(record.cmplnt_to_dt) : null,
      complaintToTime: record.cmplnt_to_tm?.trim() || null,
      precinctCode: record.addr_pct_cd?.trim() || null,
      reportDate: record.rpt_dt ? new Date(record.rpt_dt) : null,
      keyCode: record.ky_cd?.trim() || null,
      offenseDescription: record.ofns_desc?.trim() || null,
      pdCode: record.pd_cd?.trim() || null,
      pdDescription: record.pd_desc?.trim() || null,
      crimeAttemptedCompleted: record.crm_atpt_cptd_cd?.trim() || null,
      lawCategoryCode: record.law_cat_cd?.trim() || null,
      boroughName: record.boro_nm?.trim() || null,
      locationDescription: record.loc_of_occur_desc?.trim() || null,
      premiseType: record.prem_typ_desc?.trim() || null,
      jurisdiction: record.juris_desc?.trim() || null,
      xCoord: record.x_coord_cd?.trim() || null,
      yCoord: record.y_coord_cd?.trim() || null,
      latitude: this.parseNumber(record.latitude),
      longitude: this.parseNumber(record.longitude),
      patrolBorough: record.patrol_boro?.trim() || null,
      victimAgeGroup: record.vic_age_group?.trim() || null,
      victimRace: record.vic_race?.trim() || null,
      victimSex: record.vic_sex?.trim() || null,
      dataSourceId: NYC_DATASETS.COMPLAINT_DATA.id
    };

    await prisma.$executeRaw`
      INSERT INTO nyc_complaint_data (
        id, cmplnt_num, cmplnt_fr_dt, cmplnt_fr_tm, cmplnt_to_dt, cmplnt_to_tm,
        addr_pct_cd, rpt_dt, ky_cd, ofns_desc, pd_cd, pd_desc, crm_atpt_cptd_cd,
        law_cat_cd, boro_nm, loc_of_occur_desc, prem_typ_desc, juris_desc,
        x_coord_cd, y_coord_cd, latitude, longitude, patrol_boro, vic_age_group,
        vic_race, vic_sex, data_source_id, created_at, updated_at
      ) VALUES (
        ${uuidv4()}::uuid, ${data.complaintNumber}, ${data.complaintFromDate}, ${data.complaintFromTime},
        ${data.complaintToDate}, ${data.complaintToTime}, ${data.precinctCode}, ${data.reportDate},
        ${data.keyCode}, ${data.offenseDescription}, ${data.pdCode}, ${data.pdDescription},
        ${data.crimeAttemptedCompleted}, ${data.lawCategoryCode}, ${data.boroughName},
        ${data.locationDescription}, ${data.premiseType}, ${data.jurisdiction}, ${data.xCoord},
        ${data.yCoord}, ${data.latitude}, ${data.longitude}, ${data.patrolBorough},
        ${data.victimAgeGroup}, ${data.victimRace}, ${data.victimSex}, ${data.dataSourceId},
        NOW(), NOW()
      )
      ON CONFLICT (cmplnt_num) 
      DO UPDATE SET
        ofns_desc = EXCLUDED.ofns_desc,
        pd_desc = EXCLUDED.pd_desc,
        updated_at = NOW()
    `;
  }

  private async processTaxDebtDataRecord(record: any, userId: string) {
    const data = {
      month: record.month ? new Date(record.month) : null,
      cycle: record.cycle?.trim() || null,
      borough: record.borough?.trim() || null,
      block: record.block?.trim() || null,
      lot: record.lot?.trim() || null,
      taxClassCode: record.tax_class_code?.trim() || null,
      buildingClass: record.building_class?.trim() || null,
      communityBoard: record.community_board?.trim() || null,
      councilDistrict: record.council_district?.trim() || null,
      houseNumber: record.house_number?.trim() || null,
      streetName: record.street_name?.trim() || null,
      zipCode: record.zip_code?.trim() || null,
      waterDebtOnly: record.water_debt_only?.trim() || null,
      dataSourceId: NYC_DATASETS.TAX_DEBT_DATA.id
    };

    await prisma.$executeRaw`
      INSERT INTO nyc_tax_debt_data (
        id, month, cycle, borough, block, lot, tax_class_code, building_class,
        community_board, council_district, house_number, street_name, zip_code,
        water_debt_only, data_source_id, created_at, updated_at
      ) VALUES (
        ${uuidv4()}::uuid, ${data.month}, ${data.cycle}, ${data.borough}, ${data.block},
        ${data.lot}, ${data.taxClassCode}, ${data.buildingClass}, ${data.communityBoard},
        ${data.councilDistrict}, ${data.houseNumber}, ${data.streetName}, ${data.zipCode},
        ${data.waterDebtOnly}, ${data.dataSourceId}, NOW(), NOW()
      )
      ON CONFLICT (borough, block, lot, month) 
      DO UPDATE SET
        cycle = EXCLUDED.cycle,
        water_debt_only = EXCLUDED.water_debt_only,
        updated_at = NOW()
    `;
  }

  private async processBusinessLicenseRecord(record: any, userId: string) {
    if (!record.license_nbr) {
      throw new Error('Missing license number');
    }

    const data = {
      licenseNumber: record.license_nbr.trim(),
      businessName: record.business_name?.trim() || null,
      businessUniqueId: record.business_unique_id?.trim() || null,
      businessCategory: record.business_category?.trim() || null,
      licenseType: record.license_type?.trim() || null,
      licenseStatus: record.license_status?.trim() || null,
      licenseCreationDate: record.license_creation_date ? new Date(record.license_creation_date) : null,
      licenseExpirationDate: record.lic_expir_dd ? new Date(record.lic_expir_dd) : null,
      addressCity: record.address_city?.trim() || null,
      addressState: record.address_state?.trim() || null,
      addressZip: record.address_zip?.trim() || null,
      dataSourceId: NYC_DATASETS.BUSINESS_LICENSES.id
    };

    await prisma.$executeRaw`
      INSERT INTO nyc_business_licenses (
        id, license_nbr, business_name, business_unique_id, business_category,
        license_type, license_status, license_creation_date, lic_expir_dd,
        address_city, address_state, address_zip, data_source_id, created_at, updated_at
      ) VALUES (
        ${uuidv4()}::uuid, ${data.licenseNumber}, ${data.businessName}, ${data.businessUniqueId},
        ${data.businessCategory}, ${data.licenseType}, ${data.licenseStatus},
        ${data.licenseCreationDate}, ${data.licenseExpirationDate}, ${data.addressCity},
        ${data.addressState}, ${data.addressZip}, ${data.dataSourceId}, NOW(), NOW()
      )
      ON CONFLICT (license_nbr) 
      DO UPDATE SET
        license_status = EXCLUDED.license_status,
        lic_expir_dd = EXCLUDED.lic_expir_dd,
        updated_at = NOW()
    `;
  }

  private async processEventPermitRecord(record: any, userId: string) {
    if (!record.eventid) {
      throw new Error('Missing event ID');
    }

    const data = {
      eventId: record.eventid.trim(),
      eventType: record.eventtype?.trim() || null,
      startDateTime: record.startdatetime ? new Date(record.startdatetime) : null,
      endDateTime: record.enddatetime ? new Date(record.enddatetime) : null,
      enteredOn: record.enteredon ? new Date(record.enteredon) : null,
      eventAgency: record.eventagency?.trim() || null,
      parkingHeld: record.parkingheld?.trim() || null,
      borough: record.borough?.trim() || null,
      communityBoard: record.communityboard_s?.trim() || null,
      policePrecinct: record.policeprecinct_s?.trim() || null,
      category: record.category?.trim() || null,
      subcategoryName: record.subcategoryname?.trim() || null,
      country: record.country?.trim() || null,
      zipCodes: record.zipcode_s?.trim() || null,
      dataSourceId: NYC_DATASETS.EVENT_PERMITS.id
    };

    await prisma.$executeRaw`
      INSERT INTO nyc_event_permits (
        id, eventid, eventtype, startdatetime, enddatetime, enteredon,
        eventagency, parkingheld, borough, communityboard_s, policeprecinct_s,
        category, subcategoryname, country, zipcode_s, data_source_id, created_at, updated_at
      ) VALUES (
        ${uuidv4()}::uuid, ${data.eventId}, ${data.eventType}, ${data.startDateTime},
        ${data.endDateTime}, ${data.enteredOn}, ${data.eventAgency}, ${data.parkingHeld},
        ${data.borough}, ${data.communityBoard}, ${data.policePrecinct}, ${data.category},
        ${data.subcategoryName}, ${data.country}, ${data.zipCodes}, ${data.dataSourceId},
        NOW(), NOW()
      )
      ON CONFLICT (eventid) 
      DO UPDATE SET
        eventtype = EXCLUDED.eventtype,
        startdatetime = EXCLUDED.startdatetime,
        enddatetime = EXCLUDED.enddatetime,
        updated_at = NOW()
    `;
  }

  private async processBuildJobFilingRecord(record: any, userId: string) {
    if (!record.job_filing_number) {
      throw new Error('Missing job filing number');
    }

    const data = {
      jobFilingNumber: record.job_filing_number.trim(),
      filingStatus: record.filing_status?.trim() || null,
      houseNumber: record.house_no?.trim() || null,
      streetName: record.street_name?.trim() || null,
      borough: record.borough?.trim() || null,
      block: record.block?.trim() || null,
      lot: record.lot?.trim() || null,
      bin: record.bin?.trim() || null,
      communityBoard: record.commmunity_board?.trim() || null,
      workOnFloor: record.work_on_floor?.trim() || null,
      applicantTitle: record.applicant_professional_title?.trim() || null,
      applicantLicense: record.applicant_license?.trim() || null,
      applicantFirstName: record.applicant_first_name?.trim() || null,
      applicantLastName: record.applicant_last_name?.trim() || null,
      ownerBusinessName: record.owner_s_business_name?.trim() || null,
      ownerStreetName: record.owner_s_street_name?.trim() || null,
      city: record.city?.trim() || null,
      state: record.state?.trim() || null,
      zip: record.zip?.trim() || null,
      initialCost: this.parseNumber(record.initial_cost),
      totalFloorArea: this.parseNumber(record.total_construction_floor_area),
      buildingType: record.building_type?.trim() || null,
      existingDwellingUnits: this.parseNumber(record.existing_dwelling_units),
      proposedDwellingUnits: this.parseNumber(record.proposed_dwelling_units),
      currentStatusDate: record.current_status_date ? new Date(record.current_status_date) : null,
      jobType: record.job_type?.trim() || null,
      dataSourceId: NYC_DATASETS.BUILD_JOB_FILINGS.id
    };

    await prisma.$executeRaw`
      INSERT INTO nyc_build_job_filings (
        id, job_filing_number, filing_status, house_no, street_name, borough,
        block, lot, bin, commmunity_board, work_on_floor, applicant_professional_title,
        applicant_license, applicant_first_name, applicant_last_name, owner_s_business_name,
        owner_s_street_name, city, state, zip, initial_cost, total_construction_floor_area,
        building_type, existing_dwelling_units, proposed_dwelling_units, current_status_date,
        job_type, data_source_id, created_at, updated_at
      ) VALUES (
        ${uuidv4()}::uuid, ${data.jobFilingNumber}, ${data.filingStatus}, ${data.houseNumber},
        ${data.streetName}, ${data.borough}, ${data.block}, ${data.lot}, ${data.bin},
        ${data.communityBoard}, ${data.workOnFloor}, ${data.applicantTitle}, ${data.applicantLicense},
        ${data.applicantFirstName}, ${data.applicantLastName}, ${data.ownerBusinessName},
        ${data.ownerStreetName}, ${data.city}, ${data.state}, ${data.zip}, ${data.initialCost},
        ${data.totalFloorArea}, ${data.buildingType}, ${data.existingDwellingUnits},
        ${data.proposedDwellingUnits}, ${data.currentStatusDate}, ${data.jobType},
        ${data.dataSourceId}, NOW(), NOW()
      )
      ON CONFLICT (job_filing_number) 
      DO UPDATE SET
        filing_status = EXCLUDED.filing_status,
        current_status_date = EXCLUDED.current_status_date,
        updated_at = NOW()
    `;
  }

  private async processRestaurantInspectionRecord(record: any, userId: string) {
    if (!record.camis) {
      throw new Error('Missing CAMIS number');
    }
    
    // Validate CAMIS format (should be numeric)
    if (!/^\d+$/.test(record.camis.toString().trim())) {
      throw new Error(`Invalid CAMIS format: ${record.camis}`);
    }

    const data = {
      camis: record.camis.trim(),
      dba: record.dba?.trim() || null,
      borough: record.boro?.trim() || null,
      building: record.building?.trim() || null,
      street: record.street?.trim() || null,
      zipcode: record.zipcode?.trim() || null,
      phone: record.phone?.trim() || null,
      inspectionDate: record.inspection_date ? new Date(record.inspection_date) : null,
      criticalFlag: record.critical_flag?.trim() || null,
      recordDate: record.record_date ? new Date(record.record_date) : null,
      latitude: this.parseNumber(record.latitude),
      longitude: this.parseNumber(record.longitude),
      communityBoard: record.community_board?.trim() || null,
      councilDistrict: record.council_district?.trim() || null,
      censusTract: record.census_tract?.trim() || null,
      bin: record.bin?.trim() || null,
      bbl: record.bbl?.trim() || null,
      nta: record.nta?.trim() || null,
      dataSourceId: NYC_DATASETS.RESTAURANT_INSPECTIONS.id
    };

    await prisma.$executeRaw`
      INSERT INTO nyc_restaurant_inspections (
        id, camis, dba, boro, building, street, zipcode, phone, inspection_date,
        critical_flag, record_date, latitude, longitude, community_board,
        council_district, census_tract, bin, bbl, nta, data_source_id, created_at, updated_at
      ) VALUES (
        ${uuidv4()}::uuid, ${data.camis}, ${data.dba}, ${data.borough}, ${data.building},
        ${data.street}, ${data.zipcode}, ${data.phone}, ${data.inspectionDate},
        ${data.criticalFlag}, ${data.recordDate}, ${data.latitude}, ${data.longitude},
        ${data.communityBoard}, ${data.councilDistrict}, ${data.censusTract}, ${data.bin},
        ${data.bbl}, ${data.nta}, ${data.dataSourceId}, NOW(), NOW()
      )
      ON CONFLICT (camis, inspection_date) 
      DO UPDATE SET
        critical_flag = EXCLUDED.critical_flag,
        record_date = EXCLUDED.record_date,
        updated_at = NOW()
    `;
  }
}