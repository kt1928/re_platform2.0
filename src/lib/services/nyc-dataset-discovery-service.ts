import { prisma } from '@/lib/db';

export interface DiscoveredDataset {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  apiEndpoint: string;
  webUrl: string;
  recordCount: number;
  lastUpdated: Date | null;
  columns: DatasetColumn[];
  updateFrequency: string;
  isConfigured: boolean; // already added to our system
}

export interface DatasetColumn {
  fieldName: string;
  displayName: string;
  dataTypeName: string;
  description: string;
  position: number;
}

export interface DatasetSearchFilters {
  query?: string;
  category?: string;
  tags?: string[];
  minRecords?: number;
  maxRecords?: number;
  updatedSince?: Date;
  limit?: number;
  offset?: number;
}

export interface DatasetSearchResult {
  datasets: DiscoveredDataset[];
  totalCount: number;
  categories: string[];
  popularTags: string[];
}

export class NYCDatasetDiscoveryService {
  private readonly baseUrl = 'https://api.us.socrata.com/api/catalog/v1';
  private readonly nycDomain = 'data.cityofnewyork.us';

  /**
   * Search and discover NYC Open Data datasets
   */
  async searchDatasets(filters: DatasetSearchFilters = {}): Promise<DatasetSearchResult> {
    try {
      console.log('🔍 Discovering NYC datasets with filters:', filters);

      // Build Socrata API query parameters
      const params = new URLSearchParams({
        domains: this.nycDomain,
        search_context: this.nycDomain,
        limit: (filters.limit || 50).toString(),
        offset: (filters.offset || 0).toString()
      });

      // Add search query
      if (filters.query) {
        params.append('q', filters.query);
      }

      // Add category filter
      if (filters.category) {
        params.append('categories', filters.category);
      }

      // Add tags filter
      if (filters.tags && filters.tags.length > 0) {
        params.append('tags', filters.tags.join(','));
      }

      // Only include datasets (not stories, charts, etc.)
      params.append('only', 'datasets');

      const response = await fetch(`${this.baseUrl}?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Socrata API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`📊 Found ${data.results?.length || 0} datasets from Socrata API`);

      // Get our configured datasets to mark which are already added
      const configuredDatasets = await this.getConfiguredDatasetIds();

      // Transform and filter results
      const datasets = await Promise.all(
        (data.results || [])
          .filter((item: any) => this.isValidDataset(item, filters))
          .map((item: any) => this.transformSocrataDataset(item, configuredDatasets))
      );

      // Extract categories and tags for filtering UI
      const categories = this.extractUniqueCategories(data.results || []);
      const popularTags = this.extractPopularTags(data.results || []);

      return {
        datasets,
        totalCount: data.resultSetSize || datasets.length,
        categories,
        popularTags
      };

    } catch (error) {
      console.error('Error discovering datasets:', error);
      throw new Error(`Dataset discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get detailed information about a specific dataset
   */
  async getDatasetDetails(datasetId: string): Promise<DiscoveredDataset | null> {
    try {
      console.log(`🔍 Getting detailed info for dataset: ${datasetId}`);

      // Get dataset metadata
      const metadataResponse = await fetch(`https://${this.nycDomain}/api/views/${datasetId}.json`);
      if (!metadataResponse.ok) {
        throw new Error(`Failed to fetch dataset metadata: ${metadataResponse.statusText}`);
      }
      const metadata = await metadataResponse.json();

      // Get record count
      const countResponse = await fetch(`https://${this.nycDomain}/resource/${datasetId}.json?$select=count(*)`);
      const countData = await countResponse.json();
      const recordCount = parseInt(countData[0]?.count || '0');

      // Check if already configured
      const configuredDatasets = await this.getConfiguredDatasetIds();
      const isConfigured = configuredDatasets.has(datasetId);

      return this.transformSocrataDataset({
        resource: { id: datasetId, ...metadata },
        classification: { categories: metadata.category ? [metadata.category] : [], tags: metadata.tags || [] },
        metadata: {
          rowsUpdatedAt: metadata.rowsUpdatedAt,
          custom_fields: {
            'Dataset Information': { 'Update Frequency': metadata.updateFrequency || 'Unknown' }
          }
        }
      }, configuredDatasets, recordCount);

    } catch (error) {
      console.error(`Error getting dataset details for ${datasetId}:`, error);
      return null;
    }
  }

  /**
   * Add a discovered dataset to our configuration
   */
  async addDatasetConfiguration(
    dataset: DiscoveredDataset,
    userEmail: string,
    options: {
      priority?: number;
      autoSync?: boolean;
      tableName?: string;
      primaryKeyFields?: string[];
      dateField?: string;
    } = {}
  ): Promise<string> {
    try {
      console.log(`➕ Adding dataset configuration: ${dataset.name}`);

      // Detect primary key and date fields automatically
      const detectedPrimaryKey = this.detectPrimaryKeyFields(dataset.columns);
      const detectedDateField = this.detectDateField(dataset.columns);

      // Create dataset configuration
      const config = await prisma.datasetConfiguration.create({
        data: {
          datasetId: dataset.id,
          datasetName: dataset.name,
          description: dataset.description,
          category: dataset.category,
          tags: dataset.tags,
          apiEndpoint: dataset.apiEndpoint,
          webUrl: dataset.webUrl,
          priority: options.priority || this.calculatePriority(dataset),
          autoSyncEnabled: options.autoSync || false,
          tableName: options.tableName || `nyc_${dataset.id.replace(/-/g, '_')}`,
          primaryKeyFields: options.primaryKeyFields || detectedPrimaryKey,
          dateField: options.dateField || detectedDateField,
          processingMethod: 'generic',
          addedBy: userEmail,
          fieldMappings: this.generateDefaultFieldMappings(dataset.columns),
          validationRules: this.generateDefaultValidationRules(dataset.columns),
          isBuiltIn: false
        }
      });

      // Create field schemas
      await this.createFieldSchemas(dataset.id, dataset.columns);

      // Initialize freshness tracking
      await this.initializeFreshnessTracking(dataset.id, dataset.name, options.priority || 50);

      console.log(`✅ Dataset configuration created: ${config.id}`);
      return config.id;

    } catch (error) {
      console.error('Error adding dataset configuration:', error);
      throw new Error(`Failed to add dataset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get list of recommended datasets based on real estate relevance
   */
  async getRecommendedDatasets(): Promise<DiscoveredDataset[]> {
    const realEstateKeywords = [
      'property', 'building', 'housing', 'permit', 'violation', 'construction',
      'rent', 'sale', 'assessment', 'tax', 'zoning', 'development', 'planning',
      'eviction', 'ownership', 'residential', 'commercial', 'real estate'
    ];

    const searchResults = await this.searchDatasets({
      query: realEstateKeywords.join(' OR '),
      limit: 20
    });

    // Score and sort by relevance to real estate
    return searchResults.datasets
      .map(dataset => ({
        ...dataset,
        relevanceScore: this.calculateRealEstateRelevance(dataset)
      }))
      .sort((a, b) => (b as any).relevanceScore - (a as any).relevanceScore)
      .slice(0, 10);
  }

  /**
   * Check if a dataset is valid and meets our criteria
   */
  private isValidDataset(item: any, filters: DatasetSearchFilters): boolean {
    const resource = item.resource;
    if (!resource || !resource.id || !resource.name) return false;

    // Must be a dataset (not visualization, story, etc.)
    if (resource.type !== 'dataset') return false;

    // Check record count filters
    const recordCount = resource.updatedAt ? 1 : 0; // Simplified check
    if (filters.minRecords && recordCount < filters.minRecords) return false;
    if (filters.maxRecords && recordCount > filters.maxRecords) return false;

    // Check update date filter
    if (filters.updatedSince) {
      const lastUpdated = resource.updatedAt ? new Date(resource.updatedAt) : null;
      if (!lastUpdated || lastUpdated < filters.updatedSince) return false;
    }

    return true;
  }

  /**
   * Transform Socrata API response to our dataset format
   */
  private transformSocrataDataset(
    item: any, 
    configuredDatasets: Set<string>, 
    recordCount?: number
  ): DiscoveredDataset {
    const resource = item.resource;
    const classification = item.classification || {};
    const metadata = item.metadata || {};

    return {
      id: resource.id,
      name: resource.name || 'Unnamed Dataset',
      description: resource.description || 'No description available',
      category: classification.categories?.[0] || 'Other',
      tags: classification.tags || [],
      apiEndpoint: `https://${this.nycDomain}/resource/${resource.id}.json`,
      webUrl: `https://${this.nycDomain}/d/${resource.id}`,
      recordCount: recordCount || parseInt(resource.updatedAt || '0'),
      lastUpdated: resource.updatedAt ? new Date(resource.updatedAt * 1000) : null,
      columns: this.transformColumns(resource.columns_field_name || []),
      updateFrequency: metadata.custom_fields?.['Dataset Information']?.['Update Frequency'] || 'Unknown',
      isConfigured: configuredDatasets.has(resource.id)
    };
  }

  /**
   * Transform dataset columns from Socrata format
   */
  private transformColumns(columns: any[]): DatasetColumn[] {
    if (!Array.isArray(columns)) return [];

    return columns.map((col, index) => ({
      fieldName: col.fieldName || col.name || `field_${index}`,
      displayName: col.name || col.fieldName || `Field ${index + 1}`,
      dataTypeName: this.normalizeDataType(col.dataTypeName || col.type || 'text'),
      description: col.description || '',
      position: col.position || index
    }));
  }

  /**
   * Get set of already configured dataset IDs
   */
  private async getConfiguredDatasetIds(): Promise<Set<string>> {
    const configs = await prisma.datasetConfiguration.findMany({
      select: { datasetId: true }
    });
    return new Set(configs.map(c => c.datasetId));
  }

  /**
   * Extract unique categories for filtering
   */
  private extractUniqueCategories(results: any[]): string[] {
    const categories = new Set<string>();
    results.forEach(item => {
      const cats = item.classification?.categories || [];
      cats.forEach((cat: string) => categories.add(cat));
    });
    return Array.from(categories).sort();
  }

  /**
   * Extract popular tags for filtering
   */
  private extractPopularTags(results: any[]): string[] {
    const tagCounts: Record<string, number> = {};
    results.forEach(item => {
      const tags = item.classification?.tags || [];
      tags.forEach((tag: string) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    return Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([tag]) => tag);
  }

  /**
   * Normalize data types to our standard types
   */
  private normalizeDataType(socrataType: string): string {
    const typeMap: Record<string, string> = {
      'text': 'text',
      'number': 'number',
      'floating_timestamp': 'date',
      'calendar_date': 'date',
      'checkbox': 'boolean',
      'money': 'number',
      'percent': 'number',
      'location': 'text',
      'phone': 'text',
      'email': 'text',
      'url': 'text'
    };

    return typeMap[socrataType.toLowerCase()] || 'text';
  }

  /**
   * Detect primary key fields from columns
   */
  private detectPrimaryKeyFields(columns: DatasetColumn[]): string[] {
    const primaryKeyPatterns = [
      /^id$/i,
      /^.*_id$/i,
      /^.*_number$/i,
      /^unique.*$/i,
      /^primary.*$/i
    ];

    const candidates = columns.filter(col => 
      primaryKeyPatterns.some(pattern => pattern.test(col.fieldName))
    );

    if (candidates.length > 0) {
      return candidates.slice(0, 2).map(col => col.fieldName); // Max 2 primary key fields
    }

    // Fallback to first column if no obvious primary key
    return columns.length > 0 ? [columns[0].fieldName] : [];
  }

  /**
   * Detect date field for incremental syncing
   */
  private detectDateField(columns: DatasetColumn[]): string | null {
    const datePatterns = [
      /^.*_date$/i,
      /^.*_time$/i,
      /^created.*$/i,
      /^updated.*$/i,
      /^modified.*$/i,
      /^timestamp$/i
    ];

    const dateColumns = columns.filter(col => 
      col.dataTypeName === 'date' || 
      datePatterns.some(pattern => pattern.test(col.fieldName))
    );

    // Prefer columns with "created", "updated", or "modified" in the name
    const preferredColumn = dateColumns.find(col => 
      /^(created|updated|modified).*$/i.test(col.fieldName)
    );

    return preferredColumn?.fieldName || dateColumns[0]?.fieldName || null;
  }

  /**
   * Calculate priority based on dataset characteristics
   */
  private calculatePriority(dataset: DiscoveredDataset): number {
    let priority = 50; // Base priority

    // Boost priority for real estate-related datasets
    const realEstateKeywords = ['property', 'building', 'permit', 'violation', 'housing', 'rent', 'sale'];
    const nameAndDesc = `${dataset.name} ${dataset.description}`.toLowerCase();
    const matches = realEstateKeywords.filter(keyword => nameAndDesc.includes(keyword));
    priority += matches.length * 5;

    // Boost for larger datasets (more data = potentially more valuable)
    if (dataset.recordCount > 100000) priority += 10;
    else if (dataset.recordCount > 10000) priority += 5;

    // Boost for recently updated datasets
    if (dataset.lastUpdated) {
      const daysSinceUpdate = Math.floor((Date.now() - dataset.lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceUpdate < 30) priority += 5;
    }

    return Math.min(100, Math.max(1, priority));
  }

  /**
   * Calculate real estate relevance score
   */
  private calculateRealEstateRelevance(dataset: DiscoveredDataset): number {
    let score = 0;
    const text = `${dataset.name} ${dataset.description} ${dataset.tags.join(' ')}`.toLowerCase();

    // High-value keywords
    const highValueKeywords = ['property', 'building', 'real estate', 'housing', 'permit'];
    highValueKeywords.forEach(keyword => {
      if (text.includes(keyword)) score += 10;
    });

    // Medium-value keywords
    const mediumValueKeywords = ['construction', 'development', 'zoning', 'assessment', 'violation'];
    mediumValueKeywords.forEach(keyword => {
      if (text.includes(keyword)) score += 5;
    });

    // Low-value keywords
    const lowValueKeywords = ['tax', 'finance', 'planning', 'inspection', 'license'];
    lowValueKeywords.forEach(keyword => {
      if (text.includes(keyword)) score += 2;
    });

    return score;
  }

  /**
   * Generate default field mappings
   */
  private generateDefaultFieldMappings(columns: DatasetColumn[]): any {
    const mappings: any = {};
    columns.forEach(col => {
      mappings[col.fieldName] = col.fieldName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    });
    return mappings;
  }

  /**
   * Generate default validation rules
   */
  private generateDefaultValidationRules(columns: DatasetColumn[]): any {
    const rules: any = {};
    columns.forEach(col => {
      rules[col.fieldName] = {
        required: false,
        type: col.dataTypeName
      };
    });
    return rules;
  }

  /**
   * Create field schemas for a dataset
   */
  private async createFieldSchemas(datasetId: string, columns: DatasetColumn[]): Promise<void> {
    const fieldSchemas = columns.map(col => ({
      datasetId,
      fieldName: col.fieldName,
      fieldType: col.dataTypeName,
      description: col.description,
      isRequired: false,
      isIndexed: col.dataTypeName === 'date' || col.fieldName.toLowerCase().includes('id')
    }));

    await prisma.datasetFieldSchema.createMany({
      data: fieldSchemas
    });
  }

  /**
   * Initialize freshness tracking for new dataset
   */
  private async initializeFreshnessTracking(datasetId: string, datasetName: string, priority: number): Promise<void> {
    await prisma.nYCDataFreshness.create({
      data: {
        datasetId,
        datasetName,
        priority,
        freshnessScore: 0,
        isStale: true,
        recommendSync: true
      }
    });
  }
}