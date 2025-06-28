const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Define the existing 11 NYC datasets
const EXISTING_DATASETS = [
  {
    datasetId: 'usep-8jbt',
    datasetName: 'NYC Property Sales',
    description: 'Historical property sale records with prices, addresses, and transaction details',
    category: 'Housing & Development',
    tags: ['property', 'sales', 'real estate', 'housing'],
    apiEndpoint: 'https://data.cityofnewyork.us/resource/usep-8jbt.json',
    webUrl: 'https://data.cityofnewyork.us/City-Government/Citywide-Rolling-Calendar-Sales/usep-8jbt',
    priority: 95,
    tableName: 'nyc_property_sales',
    primaryKeyFields: ['borough', 'block', 'lot', 'sale_date'],
    dateField: 'sale_date',
    processingMethod: 'custom'
  },
  {
    datasetId: 'dq6g-a4sc',
    datasetName: 'DOB NOW: All Approved Permits',
    description: 'Department of Buildings permits for construction, renovation, and alteration projects',
    category: 'Housing & Development',
    tags: ['permits', 'construction', 'DOB', 'building'],
    apiEndpoint: 'https://data.cityofnewyork.us/resource/dq6g-a4sc.json',
    webUrl: 'https://data.cityofnewyork.us/Housing-Development/DOB-NOW-All-Approved-Permits/dq6g-a4sc',
    priority: 85,
    tableName: 'nyc_dob_permits',
    primaryKeyFields: ['work_permit'],
    dateField: 'approved_date',
    processingMethod: 'custom'
  },
  {
    datasetId: '3h2n-5cm9',
    datasetName: 'DOB Violations',
    description: 'Active building code violations and safety enforcement actions',
    category: 'Housing & Development',
    tags: ['violations', 'DOB', 'building', 'safety'],
    apiEndpoint: 'https://data.cityofnewyork.us/resource/3h2n-5cm9.json',
    webUrl: 'https://data.cityofnewyork.us/Housing-Development/DOB-Violations/3h2n-5cm9',
    priority: 80,
    tableName: 'nyc_dob_violations',
    primaryKeyFields: ['violation_number'],
    dateField: 'issue_date',
    processingMethod: 'custom'
  },
  {
    datasetId: 'rbx6-tga4',
    datasetName: 'DOB NOW: Build – Approved Permits',
    description: 'Property valuations for fiscal year 2024',
    category: 'Housing & Development',
    tags: ['permits', 'valuation', 'DOB', 'building'],
    apiEndpoint: 'https://data.cityofnewyork.us/resource/rbx6-tga4.json',
    webUrl: 'https://data.cityofnewyork.us/Housing-Development/DOB-NOW-Build-Approved-Permits/rbx6-tga4',
    priority: 75,
    tableName: 'nyc_property_valuation_2024',
    primaryKeyFields: ['job_filing_number'],
    dateField: 'approved_date',
    processingMethod: 'custom'
  },
  {
    datasetId: '6z8x-wfk4',
    datasetName: 'Evictions',
    description: 'Court-ordered eviction proceedings and marshal execution records',
    category: 'Housing & Development',
    tags: ['evictions', 'housing', 'court', 'legal'],
    apiEndpoint: 'https://data.cityofnewyork.us/resource/6z8x-wfk4.json',
    webUrl: 'https://data.cityofnewyork.us/City-Government/Evictions/6z8x-wfk4',
    priority: 65,
    tableName: 'nyc_property_valuation_2023',
    primaryKeyFields: ['court_index_number'],
    dateField: 'executed_date',
    processingMethod: 'custom'
  },
  {
    datasetId: 'qgea-i56i',
    datasetName: 'NYPD Complaint Data',
    description: 'Crime and incident reports across all NYC boroughs',
    category: 'Public Safety',
    tags: ['crime', 'police', 'complaints', 'safety'],
    apiEndpoint: 'https://data.cityofnewyork.us/resource/qgea-i56i.json',
    webUrl: 'https://data.cityofnewyork.us/Public-Safety/NYPD-Complaint-Data-Current-Year-To-Date/qgea-i56i',
    priority: 70,
    tableName: 'nyc_complaint_data',
    primaryKeyFields: ['cmplnt_num'],
    dateField: 'cmplnt_fr_dt',
    processingMethod: 'custom'
  },
  {
    datasetId: '9rz4-mjek',
    datasetName: 'Tax Debt/Water Debt Data',
    description: 'Outstanding property tax and water debt obligations',
    category: 'City Government',
    tags: ['tax', 'debt', 'water', 'property'],
    apiEndpoint: 'https://data.cityofnewyork.us/resource/9rz4-mjek.json',
    webUrl: 'https://data.cityofnewyork.us/City-Government/Tax-Debt-Water-Debt/9rz4-mjek',
    priority: 60,
    tableName: 'nyc_tax_debt_data',
    primaryKeyFields: ['borough', 'block', 'lot', 'month'],
    dateField: 'month',
    processingMethod: 'custom'
  },
  {
    datasetId: 'w7w3-xahh',
    datasetName: 'Business Licenses',
    description: 'Active business licenses and regulatory compliance data',
    category: 'Business',
    tags: ['business', 'licenses', 'permits', 'regulatory'],
    apiEndpoint: 'https://data.cityofnewyork.us/resource/w7w3-xahh.json',
    webUrl: 'https://data.cityofnewyork.us/Business/Legally-Operating-Businesses/w7w3-xahh',
    priority: 50,
    tableName: 'nyc_business_licenses',
    primaryKeyFields: ['license_nbr'],
    dateField: 'license_creation_date',
    processingMethod: 'custom'
  },
  {
    datasetId: 'tg4x-b46p',
    datasetName: 'Event Permits',
    description: 'Permitted public events, street closures, and special activities',
    category: 'City Government',
    tags: ['events', 'permits', 'public', 'activities'],
    apiEndpoint: 'https://data.cityofnewyork.us/resource/tg4x-b46p.json',
    webUrl: 'https://data.cityofnewyork.us/City-Government/NYC-Permitted-Event-Information/tg4x-b46p',
    priority: 40,
    tableName: 'nyc_event_permits',
    primaryKeyFields: ['eventid'],
    dateField: 'startdatetime',
    processingMethod: 'custom'
  },
  {
    datasetId: 'w9ak-ipjd',
    datasetName: 'DOB Job Filings',
    description: 'Department of Buildings job application filings and permits',
    category: 'Housing & Development',
    tags: ['DOB', 'jobs', 'filings', 'permits'],
    apiEndpoint: 'https://data.cityofnewyork.us/resource/w9ak-ipjd.json',
    webUrl: 'https://data.cityofnewyork.us/Housing-Development/DOB-Job-Application-Filings/w9ak-ipjd',
    priority: 55,
    tableName: 'nyc_build_job_filings',
    primaryKeyFields: ['job_filing_number'],
    dateField: 'current_status_date',
    processingMethod: 'custom'
  },
  {
    datasetId: '43nn-pn8j',
    datasetName: 'Restaurant Inspections',
    description: 'Health department inspection results and violation records',
    category: 'Health',
    tags: ['restaurants', 'health', 'inspections', 'food safety'],
    apiEndpoint: 'https://data.cityofnewyork.us/resource/43nn-pn8j.json',
    webUrl: 'https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j',
    priority: 45,
    tableName: 'nyc_restaurant_inspections',
    primaryKeyFields: ['camis', 'inspection_date'],
    dateField: 'inspection_date',
    processingMethod: 'custom'
  }
];

async function initializeDatasetConfigurations() {
  console.log('🚀 Initializing dataset configurations for existing 11 NYC datasets...');

  try {
    for (const dataset of EXISTING_DATASETS) {
      console.log(`📝 Setting up: ${dataset.datasetName}`);

      // Check if configuration already exists
      const existingConfig = await prisma.datasetConfiguration.findUnique({
        where: { datasetId: dataset.datasetId }
      });

      if (existingConfig) {
        console.log(`⏭️  Configuration already exists for ${dataset.datasetName}, skipping...`);
        continue;
      }

      // Create dataset configuration
      const config = await prisma.datasetConfiguration.create({
        data: {
          datasetId: dataset.datasetId,
          datasetName: dataset.datasetName,
          description: dataset.description,
          category: dataset.category,
          tags: dataset.tags,
          apiEndpoint: dataset.apiEndpoint,
          webUrl: dataset.webUrl,
          priority: dataset.priority,
          syncEnabled: true,
          autoSyncEnabled: false,
          tableName: dataset.tableName,
          primaryKeyFields: dataset.primaryKeyFields,
          dateField: dataset.dateField,
          processingMethod: dataset.processingMethod,
          addedBy: 'system-initialization',
          isBuiltIn: true, // Mark as built-in dataset
          fieldMappings: {},
          validationRules: {},
          transformationRules: {}
        }
      });

      // Initialize freshness tracking
      const existingFreshness = await prisma.nYCDataFreshness.findUnique({
        where: { datasetId: dataset.datasetId }
      });

      if (!existingFreshness) {
        await prisma.nYCDataFreshness.create({
          data: {
            datasetId: dataset.datasetId,
            datasetName: dataset.datasetName,
            priority: dataset.priority,
            freshnessScore: 0,
            isStale: true,
            recommendSync: true,
            autoSyncEnabled: false
          }
        });
      }

      console.log(`✅ Configured: ${dataset.datasetName}`);
    }

    console.log('🎉 All dataset configurations initialized successfully!');

    // Show summary
    const totalConfigs = await prisma.datasetConfiguration.count();
    const builtInConfigs = await prisma.datasetConfiguration.count({
      where: { isBuiltIn: true }
    });

    console.log(`📊 Summary:`);
    console.log(`   Total configurations: ${totalConfigs}`);
    console.log(`   Built-in datasets: ${builtInConfigs}`);
    console.log(`   Custom datasets: ${totalConfigs - builtInConfigs}`);

  } catch (error) {
    console.error('❌ Error initializing dataset configurations:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the initialization
initializeDatasetConfigurations()
  .then(() => {
    console.log('✨ Initialization complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Initialization failed:', error);
    process.exit(1);
  });