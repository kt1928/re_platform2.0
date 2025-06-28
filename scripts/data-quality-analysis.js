#!/usr/bin/env node

/**
 * NYC Open Data Coverage & Quality Analysis
 * 
 * Comprehensive analysis comparing our database coverage against 
 * raw NYC Open Data sources, with data quality metrics and 
 * transformation effectiveness assessment.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// NYC Open Data source record counts (from API)
const NYC_SOURCE_COUNTS = {
  'usep-8jbt': { name: 'Property Sales', count: 77634 },
  'dq6g-a4sc': { name: 'DOB Permits', count: 788340 },
  '3h2n-5cm9': { name: 'DOB Violations', count: 2446189 },
  '6z8x-wfk4': { name: 'Evictions', count: 111102 },
  'qgea-i56i': { name: 'NYPD Complaints', count: 9491946 },
  '9rz4-mjek': { name: 'Tax Debt', count: 259597 },
  'w7w3-xahh': { name: 'Business Licenses', count: 78451 },
  'tg4x-b46p': { name: 'Event Permits', count: 12080 },
  '43nn-pn8j': { name: 'Restaurant Inspections', count: 283601 }
};

async function analyzeDataCoverage() {
  console.log('🎯 NYC OPEN DATA COMPREHENSIVE ANALYSIS');
  console.log('======================================\n');

  // Get database counts
  const dbCounts = {
    // Raw API ingested data
    propertySupport1: await prisma.nYCPropertySale.count(),
    dobPermits: await prisma.nYCDOBPermit.count(),
    dobViolations: await prisma.nYCDOBViolation.count(),
    propertyVal2024: await prisma.nYCPropertyValuation2024.count(),
    propertyVal2023: await prisma.nYCPropertyValuation2023.count(),
    complaintData: await prisma.nYCComplaintData.count(),
    taxDebtData: await prisma.nYCTaxDebtData.count(),
    businessLicenses: await prisma.nYCBusinessLicense.count(),
    eventPermits: await prisma.nYCEventPermit.count(),
    buildJobFilings: await prisma.nYCBuildJobFiling.count(),
    restaurantInspections: await prisma.nYCRestaurantInspection.count(),
    
    // Cleaned/transformed data (gems)
    cleanedPermits: await prisma.cleanedDOBPermit.count(),
    cleanedEvictions: await prisma.cleanedEviction.count(),
    cleanedViolations: await prisma.cleanedViolation.count(),
    binReference: await prisma.binZipcodeReference.count()
  };

  // Dataset mapping and analysis
  const datasets = [
    {
      name: 'Property Sales',
      sourceId: 'usep-8jbt',
      sourceCount: NYC_SOURCE_COUNTS['usep-8jbt'].count,
      rawCount: dbCounts.propertySupport1,
      cleanedCount: 0, // No cleaned version yet
      businessValue: 'HIGH',
      status: 'API_SYNCED'
    },
    {
      name: 'DOB Permits',
      sourceId: 'dq6g-a4sc',
      sourceCount: NYC_SOURCE_COUNTS['dq6g-a4sc'].count,
      rawCount: dbCounts.dobPermits,
      cleanedCount: dbCounts.cleanedPermits,
      businessValue: 'CRITICAL',
      status: 'CLEANED_READY'
    },
    {
      name: 'DOB Violations',
      sourceId: '3h2n-5cm9',
      sourceCount: NYC_SOURCE_COUNTS['3h2n-5cm9'].count,
      rawCount: dbCounts.dobViolations,
      cleanedCount: dbCounts.cleanedViolations,
      businessValue: 'HIGH',
      status: 'CLEANED_READY'
    },
    {
      name: 'Evictions',
      sourceId: '6z8x-wfk4',
      sourceCount: NYC_SOURCE_COUNTS['6z8x-wfk4'].count,
      rawCount: dbCounts.propertyVal2023, // Mapped to property_valuation_2023
      cleanedCount: dbCounts.cleanedEvictions,
      businessValue: 'CRITICAL',
      status: 'CLEANED_READY'
    },
    {
      name: 'NYPD Complaints',
      sourceId: 'qgea-i56i',
      sourceCount: NYC_SOURCE_COUNTS['qgea-i56i'].count,
      rawCount: dbCounts.complaintData,
      cleanedCount: 0,
      businessValue: 'MEDIUM',
      status: 'API_SYNCED'
    },
    {
      name: 'Tax Debt',
      sourceId: '9rz4-mjek',
      sourceCount: NYC_SOURCE_COUNTS['9rz4-mjek'].count,
      rawCount: dbCounts.taxDebtData,
      cleanedCount: 0,
      businessValue: 'HIGH',
      status: 'API_SYNCED'
    },
    {
      name: 'Business Licenses',
      sourceId: 'w7w3-xahh',
      sourceCount: NYC_SOURCE_COUNTS['w7w3-xahh'].count,
      rawCount: dbCounts.businessLicenses,
      cleanedCount: 0,
      businessValue: 'MEDIUM',
      status: 'API_SYNCED'
    },
    {
      name: 'Event Permits',
      sourceId: 'tg4x-b46p',
      sourceCount: NYC_SOURCE_COUNTS['tg4x-b46p'].count,
      rawCount: dbCounts.eventPermits,
      cleanedCount: 0,
      businessValue: 'LOW',
      status: 'API_SYNCED'
    },
    {
      name: 'Restaurant Inspections',
      sourceId: '43nn-pn8j',
      sourceCount: NYC_SOURCE_COUNTS['43nn-pn8j'].count,
      rawCount: dbCounts.restaurantInspections,
      cleanedCount: 0,
      businessValue: 'MEDIUM',
      status: 'API_SYNCED'
    }
  ];

  // Additional datasets we have but not in standard NYC API
  const additionalDatasets = [
    {
      name: 'Property Valuation 2024',
      rawCount: dbCounts.propertyVal2024,
      businessValue: 'HIGH',
      status: 'PROCESSED'
    },
    {
      name: 'Build Job Filings',
      rawCount: dbCounts.buildJobFilings,
      businessValue: 'MEDIUM',
      status: 'PROCESSED'
    },
    {
      name: 'BIN-Zipcode Reference',
      rawCount: dbCounts.binReference,
      businessValue: 'CRITICAL',
      status: 'INFRASTRUCTURE'
    }
  ];

  console.log('📊 DATASET COVERAGE ANALYSIS');
  console.log('============================\n');

  let totalSourceRecords = 0;
  let totalRawRecords = 0;
  let totalCleanedRecords = 0;

  datasets.forEach(dataset => {
    const rawCoverage = ((dataset.rawCount / dataset.sourceCount) * 100).toFixed(1);
    const cleanedCoverage = dataset.cleanedCount > 0 ? 
      ((dataset.cleanedCount / dataset.sourceCount) * 100).toFixed(1) : 'N/A';
    
    const statusIcon = dataset.status === 'CLEANED_READY' ? '💎' : 
                      dataset.status === 'API_SYNCED' ? '📊' : '⚙️';
    
    const valueIcon = dataset.businessValue === 'CRITICAL' ? '🔥' :
                      dataset.businessValue === 'HIGH' ? '⭐' :
                      dataset.businessValue === 'MEDIUM' ? '📈' : '📋';

    console.log(`${statusIcon} ${valueIcon} ${dataset.name}`);
    console.log(`   Source: ${dataset.sourceCount.toLocaleString()} records`);
    console.log(`   Raw DB: ${dataset.rawCount.toLocaleString()} (${rawCoverage}% coverage)`);
    if (dataset.cleanedCount > 0) {
      console.log(`   Cleaned: ${dataset.cleanedCount.toLocaleString()} (${cleanedCoverage}% of source)`);
    }
    console.log(`   Status: ${dataset.status}\n`);

    totalSourceRecords += dataset.sourceCount;
    totalRawRecords += dataset.rawCount;
    totalCleanedRecords += dataset.cleanedCount;
  });

  console.log('🔧 ADDITIONAL PROCESSED DATASETS');
  console.log('=================================\n');

  additionalDatasets.forEach(dataset => {
    const statusIcon = dataset.status === 'INFRASTRUCTURE' ? '🗺️' : 
                      dataset.status === 'PROCESSED' ? '⚙️' : '📊';
    
    const valueIcon = dataset.businessValue === 'CRITICAL' ? '🔥' :
                      dataset.businessValue === 'HIGH' ? '⭐' : '📈';

    console.log(`${statusIcon} ${valueIcon} ${dataset.name}`);
    console.log(`   Records: ${dataset.rawCount.toLocaleString()}`);
    console.log(`   Status: ${dataset.status}\n`);

    totalRawRecords += dataset.rawCount;
    if (dataset.status === 'INFRASTRUCTURE') {
      totalCleanedRecords += dataset.rawCount;
    }
  });

  // Calculate overall metrics
  const overallRawCoverage = ((totalRawRecords / totalSourceRecords) * 100).toFixed(1);
  const cleaningRatio = ((totalCleanedRecords / totalRawRecords) * 100).toFixed(1);

  console.log('🎯 SUMMARY METRICS');
  console.log('==================');
  console.log(`📊 Total NYC Source Records: ${totalSourceRecords.toLocaleString()}`);
  console.log(`🗄️ Total Raw Records in DB: ${totalRawRecords.toLocaleString()}`);
  console.log(`💎 Total Cleaned Records: ${totalCleanedRecords.toLocaleString()}`);
  console.log(`📈 Overall Source Coverage: ${overallRawCoverage}%`);
  console.log(`✨ Data Cleaning Ratio: ${cleaningRatio}%\n`);

  // Business impact assessment
  console.log('💼 BUSINESS IMPACT ASSESSMENT');
  console.log('==============================');
  
  const criticalDatasets = datasets.filter(d => d.businessValue === 'CRITICAL');
  const criticalCoverage = criticalDatasets.reduce((acc, d) => acc + (d.rawCount / d.sourceCount), 0) / criticalDatasets.length * 100;
  
  console.log(`🔥 Critical Datasets Coverage: ${criticalCoverage.toFixed(1)}%`);
  console.log(`   • DOB Permits: Essential for development tracking`);
  console.log(`   • DOB Violations: Critical for due diligence`);
  console.log(`   • Evictions: Essential for risk assessment`);
  console.log(`   • BIN Reference: Infrastructure for geographic analysis\n`);

  // Data quality assessment
  await assessDataQuality();

  await prisma.$disconnect();
}

async function assessDataQuality() {
  console.log('🔍 DATA QUALITY ASSESSMENT');
  console.log('===========================\n');

  try {
    // Test data completeness and quality
    const qualityMetrics = {
      // DOB Permits quality
      permitCompleteness: await prisma.cleanedDOBPermit.aggregate({
        _count: { id: true },
        where: {
          AND: [
            { address: { not: null } },
            { zipCode: { not: null } },
            { borough: { not: null } }
          ]
        }
      }),
      totalPermits: await prisma.cleanedDOBPermit.count(),

      // Evictions quality
      evictionCompleteness: await prisma.cleanedEviction.aggregate({
        _count: { id: true },
        where: {
          AND: [
            { evictionAddress: { not: null } },
            { borough: { not: null } },
            { executedDate: { not: null } }
          ]
        }
      }),
      totalEvictions: await prisma.cleanedEviction.count(),

      // BIN reference quality
      binCompleteness: await prisma.binZipcodeReference.aggregate({
        _count: { id: true },
        where: {
          AND: [
            { bin: { not: null } },
            { zipcode: { not: null } }
          ]
        }
      }),
      totalBins: await prisma.binZipcodeReference.count()
    };

    const permitQuality = (qualityMetrics.permitCompleteness._count.id / qualityMetrics.totalPermits * 100).toFixed(1);
    const evictionQuality = (qualityMetrics.evictionCompleteness._count.id / qualityMetrics.totalEvictions * 100).toFixed(1);
    const binQuality = (qualityMetrics.binCompleteness._count.id / qualityMetrics.totalBins * 100).toFixed(1);

    console.log('✅ CLEANED DATA QUALITY SCORES:');
    console.log(`🏗️ DOB Permits: ${permitQuality}% complete (address, zip, borough)`);
    console.log(`🏠 Evictions: ${evictionQuality}% complete (address, borough, date)`);
    console.log(`🗺️ BIN Reference: ${binQuality}% complete (bin, zipcode)\n`);

    // Geographic coverage
    const geoCoverage = await prisma.cleanedDOBPermit.groupBy({
      by: ['borough'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } }
    });

    console.log('🗺️ GEOGRAPHIC COVERAGE (DOB Permits):');
    geoCoverage.forEach(borough => {
      console.log(`   ${borough.borough}: ${borough._count.id.toLocaleString()} permits`);
    });

  } catch (error) {
    console.log('❌ Error assessing data quality:', error.message);
  }
}

// Run analysis
if (require.main === module) {
  analyzeDataCoverage().catch(console.error);
}

module.exports = { analyzeDataCoverage };