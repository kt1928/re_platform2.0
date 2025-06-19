import { prisma } from '@/lib/db';
import { MockPropertyGenerator, MockPropertyData } from '@/lib/data-sources/mock-property-generator';
import { v4 as uuidv4 } from 'uuid';

export interface DataSource {
  name: string;
  fetchProperties(params: any): Promise<any[]>;
}

export class MockDataSource implements DataSource {
  name = 'mock';
  private generator = new MockPropertyGenerator();

  async fetchProperties(params: { count: number }): Promise<MockPropertyData[]> {
    return this.generator.generateMultiple(params.count || 10);
  }
}

// Placeholder for future real data sources
export class ZillowDataSource implements DataSource {
  name = 'zillow';
  
  async fetchProperties(params: { zipCode: string; limit: number }): Promise<any[]> {
    // TODO: Implement Zillow API integration
    throw new Error('Zillow integration not yet implemented. API key required.');
  }
}

export class DataIngestionService {
  private dataSources: Map<string, DataSource> = new Map();
  
  constructor() {
    // Register available data sources
    this.dataSources.set('mock', new MockDataSource());
    this.dataSources.set('zillow', new ZillowDataSource());
  }

  async ingestFromSource(
    sourceName: string, 
    params: any,
    userId: string
  ): Promise<{
    success: number;
    failed: number;
    errors: string[];
  }> {
    const source = this.dataSources.get(sourceName);
    if (!source) {
      throw new Error(`Unknown data source: ${sourceName}`);
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    try {
      console.log(`Starting data ingestion from ${sourceName}...`);
      const properties = await source.fetchProperties(params);
      
      for (const propertyData of properties) {
        try {
          await this.insertProperty(propertyData, source.name, userId);
          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(
            `Failed to insert property at ${propertyData.address_line1}: ${
              error instanceof Error ? error.message : 'Unknown error'
            }`
          );
        }
      }

      console.log(`Ingestion complete. Success: ${results.success}, Failed: ${results.failed}`);
      
      // Log audit event
      await prisma.auditLog.create({
        data: {
          userId,
          tableName: 'data_ingestion',
          recordId: uuidv4(),
          action: 'INSERT',
          newData: {
            source: sourceName,
            params,
            results
          },
          ipAddress: null,
          userAgent: 'DataIngestionService'
        }
      });

    } catch (error) {
      console.error('Data ingestion error:', error);
      throw error;
    }

    return results;
  }

  private async insertProperty(
    propertyData: any,
    dataSource: string,
    userId: string
  ): Promise<void> {
    // Check if property already exists (by address and zip)
    const existing = await prisma.property.findFirst({
      where: {
        addressLine1: propertyData.address_line1,
        zipCode: propertyData.zip_code
      }
    });

    if (existing) {
      // Update existing property
      await prisma.property.update({
        where: { id: existing.id },
        data: {
          addressLine1: propertyData.address_line1,
          addressLine2: propertyData.address_line2,
          city: propertyData.city,
          state: propertyData.state,
          zipCode: propertyData.zip_code,
          propertyType: propertyData.property_type,
          bedrooms: propertyData.bedrooms,
          bathrooms: propertyData.bathrooms,
          squareFeet: propertyData.square_feet,
          lotSize: propertyData.lot_size,
          yearBuilt: propertyData.year_built,
          listPrice: propertyData.list_price,
          rentEstimate: propertyData.rent_estimate,
          taxAssessedValue: propertyData.tax_assessed_value,
          latitude: propertyData.latitude,
          longitude: propertyData.longitude,
          dataSource: dataSource,
          updatedAt: new Date()
        }
      });
      
      // Log property history
      await prisma.propertyHistory.create({
        data: {
          propertyId: existing.id,
          fieldName: 'full_update',
          oldValue: JSON.stringify(existing),
          newValue: JSON.stringify(propertyData),
          dataSource: dataSource
        }
      });
    } else {
      // Create new property
      const newProperty = await prisma.property.create({
        data: {
          id: uuidv4(),
          addressLine1: propertyData.address_line1,
          addressLine2: propertyData.address_line2,
          city: propertyData.city,
          state: propertyData.state,
          zipCode: propertyData.zip_code,
          propertyType: propertyData.property_type,
          bedrooms: propertyData.bedrooms,
          bathrooms: propertyData.bathrooms,
          squareFeet: propertyData.square_feet,
          lotSize: propertyData.lot_size,
          yearBuilt: propertyData.year_built,
          listPrice: propertyData.list_price,
          rentEstimate: propertyData.rent_estimate,
          taxAssessedValue: propertyData.tax_assessed_value,
          latitude: propertyData.latitude,
          longitude: propertyData.longitude,
          dataSource: dataSource,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      // Log audit event
      await prisma.auditLog.create({
        data: {
          userId,
          tableName: 'properties',
          recordId: newProperty.id,
          action: 'INSERT',
          newData: newProperty,
          ipAddress: null,
          userAgent: 'DataIngestionService'
        }
      });
    }
  }

  getAvailableDataSources(): string[] {
    return Array.from(this.dataSources.keys());
  }
}