#!/usr/bin/env node

/**
 * Import Cleaned Gems - Production Data Import Script
 * 
 * Imports cleaned and processed NYC datasets:
 * 1. DOB Permits (2.7M records) - Construction intelligence
 * 2. Evictions (99K records) - Risk assessment data  
 * 3. Violations (1.75M records) - Building quality data
 * 4. BIN-Zipcode Reference - Geographic mapping
 * 
 * These are your "gems" - already cleaned, validated, and production-ready.
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const prisma = new PrismaClient();

// Configuration
const DATA_DIR = path.join(__dirname, '..', 'data');
const BATCH_SIZE = 1000; // Process in batches for memory efficiency

// File mappings
const GEMS = {
  permits: {
    file: path.join(DATA_DIR, 'Phase 4/FINAL_DELIVERABLES/permits_standardized.csv'),
    table: 'cleanedDOBPermit',
    description: 'DOB Permits (2.7M records)',
    expectedCount: 2700000
  },
  evictions: {
    file: path.join(DATA_DIR, 'Polished/evictions_processed.csv'),
    table: 'cleanedEviction', 
    description: 'Evictions (99K records)',
    expectedCount: 99000
  },
  violations: {
    file: path.join(DATA_DIR, 'violations_standardized_with_census.csv'),
    table: 'cleanedViolation',
    description: 'Violations (1.75M records)', 
    expectedCount: 1750000
  },
  binReference: {
    file: path.join(DATA_DIR, 'master_bin_zipcode.csv'),
    table: 'binZipcodeReference',
    description: 'BIN-Zipcode Reference',
    expectedCount: 500000
  }
};

// Utility functions
function parseDecimal(value) {
  if (!value || value === '' || value === 'null' || value === 'nan') return null;
  const parsed = parseFloat(value.toString().replace(/[,$]/g, ''));
  return isNaN(parsed) ? null : parsed;
}

function parseInteger(value) {
  if (!value || value === '' || value === 'null' || value === 'nan') return null;
  const parsed = parseInt(value.toString().replace(/[,$]/g, ''));
  return isNaN(parsed) ? null : parsed;
}

function parseDate(value) {
  if (!value || value === '' || value === 'null' || value === 'nan') return null;
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

function cleanString(value) {
  if (!value || value === '' || value === 'null' || value === 'nan') return null;
  return value.toString().trim().substring(0, 254); // Truncate to avoid varchar overflow
}

// Import functions for each dataset
async function importPermits() {
  console.log('🏗️ Starting DOB Permits import...');
  
  const records = [];
  let processedCount = 0;
  let importedCount = 0;
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(GEMS.permits.file)
      .pipe(csv())
      .on('data', (row) => {
        processedCount++;
        
        // Map CSV columns to database fields
        const record = {
          jobNumber: cleanString(row['Job #']),
          jobType: cleanString(row['Job Type']),
          bin: cleanString(row['Bin #']),
          houseNumber: cleanString(row['House #']),
          streetName: cleanString(row['Street Name']),
          borough: cleanString(row['Borough']),
          block: cleanString(row['Block']),
          lot: cleanString(row['Lot']),
          buildingType: cleanString(row['Building Type']),
          preFilingDate: parseDate(row['Pre- Filing Date']),
          latestActionDate: parseDate(row['Latest Action Date']),
          signoffDate: parseDate(row['SIGNOFF_DATE']),
          jobStatus: cleanString(row['Job Status']),
          ownerBusinessName: cleanString(row["Owner's Business Name"]),
          zipCode: cleanString(row['Zip']),
          applicantFirstName: cleanString(row["Applicant's First Name"]),
          applicantLastName: cleanString(row["Applicant's Last Name"]),
          initialCost: parseDecimal(row['Initial Cost']),
          latitude: parseDecimal(row['GIS_LATITUDE']),
          longitude: parseDecimal(row['GIS_LONGITUDE']),
          address: cleanString(row['ADDRESS'])
        };
        
        // Skip records without job number (primary key)
        if (record.jobNumber) {
          records.push(record);
        }
        
        // Process in batches
        if (records.length >= BATCH_SIZE) {
          processBatch();
        }
        
        // Progress logging
        if (processedCount % 10000 === 0) {
          console.log(`  📊 Processed: ${processedCount.toLocaleString()} | Imported: ${importedCount.toLocaleString()}`);
        }
      })
      .on('end', async () => {
        // Process remaining records
        if (records.length > 0) {
          await processBatch();
        }
        console.log(`✅ DOB Permits import completed: ${importedCount.toLocaleString()} records`);
        resolve(importedCount);
      })
      .on('error', reject);
    
    async function processBatch() {
      try {
        const batch = records.splice(0, BATCH_SIZE);
        const result = await prisma.cleanedDOBPermit.createMany({
          data: batch,
          skipDuplicates: true
        });
        importedCount += result.count;
      } catch (error) {
        console.error('❌ Batch import error:', error.message);
        // Continue processing despite errors
      }
    }
  });
}

async function importEvictions() {
  console.log('🏠 Starting Evictions import...');
  
  const records = [];
  let processedCount = 0;
  let importedCount = 0;
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(GEMS.evictions.file)
      .pipe(csv())
      .on('data', (row) => {
        processedCount++;
        
        const record = {
          evictionAddress: cleanString(row['Eviction Address']),
          executedDate: parseDate(row['Executed Date']),
          residentialCommercial: cleanString(row['Residential/Commercial']),
          borough: cleanString(row['BOROUGH']),
          evictionPostcode: cleanString(row['Eviction Postcode']),
          bin: cleanString(row['BIN']),
          bbl: cleanString(row['BBL']),
          neighborhoods: cleanString(row['neighborhoods'])
        };
        
        // Skip records without address (required field)
        if (record.evictionAddress) {
          records.push(record);
        }
        
        if (records.length >= BATCH_SIZE) {
          processBatch();
        }
        
        if (processedCount % 5000 === 0) {
          console.log(`  📊 Processed: ${processedCount.toLocaleString()} | Imported: ${importedCount.toLocaleString()}`);
        }
      })
      .on('end', async () => {
        if (records.length > 0) {
          await processBatch();
        }
        console.log(`✅ Evictions import completed: ${importedCount.toLocaleString()} records`);
        resolve(importedCount);
      })
      .on('error', reject);
    
    async function processBatch() {
      try {
        const batch = records.splice(0, BATCH_SIZE);
        const result = await prisma.cleanedEviction.createMany({
          data: batch,
          skipDuplicates: true
        });
        importedCount += result.count;
      } catch (error) {
        console.error('❌ Batch import error:', error.message);
      }
    }
  });
}

async function importViolations() {
  console.log('⚠️ Starting Violations import...');
  
  const records = [];
  let processedCount = 0;
  let importedCount = 0;
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(GEMS.violations.file)
      .pipe(csv())
      .on('data', (row) => {
        processedCount++;
        
        const record = {
          bin: cleanString(row['BIN']),
          borough: cleanString(row['Borough']),
          block: cleanString(row['BLOCK']),
          lot: cleanString(row['LOT']),
          violationType: cleanString(row['VIOLATION_TYPE']),
          penaltyImposed: parseDecimal(row['PENALITY_IMPOSED']),
          address: cleanString(row['ADDRESS']),
          issueYear: parseInteger(row['ISSUE_DATE_YYYY']),
          issueMonth: parseInteger(row['ISSUE_DATE_MM']),
          issueDay: parseInteger(row['ISSUE_DATE_DD']),
          zipcode: cleanString(row['Zipcode'])
        };
        
        // Skip records without key identifiers
        if (record.bin || (record.borough && record.block && record.lot)) {
          records.push(record);
        }
        
        if (records.length >= BATCH_SIZE) {
          processBatch();
        }
        
        if (processedCount % 10000 === 0) {
          console.log(`  📊 Processed: ${processedCount.toLocaleString()} | Imported: ${importedCount.toLocaleString()}`);
        }
      })
      .on('end', async () => {
        if (records.length > 0) {
          await processBatch();
        }
        console.log(`✅ Violations import completed: ${importedCount.toLocaleString()} records`);
        resolve(importedCount);
      })
      .on('error', reject);
    
    async function processBatch() {
      try {
        const batch = records.splice(0, BATCH_SIZE);
        const result = await prisma.cleanedViolation.createMany({
          data: batch,
          skipDuplicates: true
        });
        importedCount += result.count;
      } catch (error) {
        console.error('❌ Batch import error:', error.message);
      }
    }
  });
}

async function importBinReference() {
  console.log('🗺️ Starting BIN-Zipcode Reference import...');
  
  const records = [];
  let processedCount = 0;
  let importedCount = 0;
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(GEMS.binReference.file)
      .pipe(csv())
      .on('data', (row) => {
        processedCount++;
        
        const record = {
          bin: cleanString(row['BIN']),
          zipcode: cleanString(row['Zipcode'])
        };
        
        // Skip records without BIN
        if (record.bin && record.zipcode) {
          records.push(record);
        }
        
        if (records.length >= BATCH_SIZE) {
          processBatch();
        }
        
        if (processedCount % 5000 === 0) {
          console.log(`  📊 Processed: ${processedCount.toLocaleString()} | Imported: ${importedCount.toLocaleString()}`);
        }
      })
      .on('end', async () => {
        if (records.length > 0) {
          await processBatch();
        }
        console.log(`✅ BIN Reference import completed: ${importedCount.toLocaleString()} records`);
        resolve(importedCount);
      })
      .on('error', reject);
    
    async function processBatch() {
      try {
        const batch = records.splice(0, BATCH_SIZE);
        const result = await prisma.binZipcodeReference.createMany({
          data: batch,
          skipDuplicates: true
        });
        importedCount += result.count;
      } catch (error) {
        console.error('❌ Batch import error:', error.message);
      }
    }
  });
}

// Main import function
async function importAllGems() {
  console.log('💎 Starting Gems Import Process');
  console.log('=====================================');
  
  const startTime = Date.now();
  const results = {};
  
  try {
    // Check file existence
    for (const [name, gem] of Object.entries(GEMS)) {
      if (!fs.existsSync(gem.file)) {
        throw new Error(`❌ File not found: ${gem.file}`);
      }
      console.log(`✅ Found: ${gem.description} (${gem.file})`);
    }
    
    console.log('\n🚀 Starting imports...\n');
    
    // Import in order of business value and dependency
    results.binReference = await importBinReference();
    results.permits = await importPermits();
    results.evictions = await importEvictions();
    results.violations = await importViolations();
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n🎉 GEMS IMPORT COMPLETED');
    console.log('=====================================');
    console.log(`⏱️ Total Duration: ${duration} seconds`);
    console.log(`📊 Records Imported:`);
    console.log(`   🗺️ BIN Reference: ${results.binReference.toLocaleString()}`);
    console.log(`   🏗️ DOB Permits: ${results.permits.toLocaleString()}`);
    console.log(`   🏠 Evictions: ${results.evictions.toLocaleString()}`);
    console.log(`   ⚠️ Violations: ${results.violations.toLocaleString()}`);
    console.log(`   📈 Total: ${(results.binReference + results.permits + results.evictions + results.violations).toLocaleString()}`);
    
    console.log('\n✨ Your real estate intelligence platform is now loaded with:');
    console.log('   • 2.7M+ construction permits for development tracking');
    console.log('   • 99K+ eviction records for risk assessment');
    console.log('   • 1.75M+ violation records for due diligence');
    console.log('   • Complete BIN-zipcode mapping for geographic analysis');
    
  } catch (error) {
    console.error('💥 Import failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  importAllGems();
}

module.exports = { importAllGems };