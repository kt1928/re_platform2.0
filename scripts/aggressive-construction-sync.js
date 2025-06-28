#!/usr/bin/env node

/**
 * Aggressive Construction Data Sync
 * 
 * Target: Get DOB Violations and DOB Permits coverage to 90%+
 * These are CRITICAL datasets for construction-focused real estate development
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// NYC Open Data endpoints
const DOB_VIOLATIONS_API = 'https://data.cityofnewyork.us/resource/3h2n-5cm9.json';
const DOB_PERMITS_API = 'https://data.cityofnewyork.us/resource/dq6g-a4sc.json';

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.log(`  ⚠️ Attempt ${i + 1} failed: ${error.message}`);
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
    }
  }
}

async function syncDOBViolations() {
  console.log('🚨 AGGRESSIVE DOB VIOLATIONS SYNC');
  console.log('=================================\n');
  
  let offset = 925000; // Resume from where we left off
  const batchSize = 2000; // Smaller batches for better rate limiting
  let totalProcessed = 0;
  let totalAdded = 0;
  let hasMore = true;
  
  // Target: Get to 90% of 2.4M = 2.16M records
  const targetRecords = 2160000;
  
  while (hasMore && totalProcessed < targetRecords) {
    try {
      console.log(`📊 Fetching batch: offset=${offset.toLocaleString()}, limit=${batchSize.toLocaleString()}`);
      
      const url = `${DOB_VIOLATIONS_API}?$limit=${batchSize}&$offset=${offset}&$order=issue_date DESC`;
      const batch = await fetchWithRetry(url);
      
      if (batch.length === 0) {
        console.log('✅ No more records available from API');
        hasMore = false;
        break;
      }
      
      console.log(`  Processing ${batch.length} violations...`);
      
      // Process batch
      let batchAdded = 0;
      for (const record of batch) {
        try {
          if (!record.violation_number) continue;
          
          await prisma.nYCDOBViolation.upsert({
            where: {
              violationNumber: record.violation_number.toString().trim()
            },
            update: {
              dispositionComments: record.disposition_comments?.trim() || null,
              description: record.description?.trim() || null,
              violationCategory: record.violation_category?.trim() || null,
              updatedAt: new Date()
            },
            create: {
              isnDobBisViol: record.isn_dob_bis_viol?.trim() || null,
              borough: record.boro?.trim() || null,
              block: record.block?.trim() || null,
              lot: record.lot?.trim() || null,
              issueDate: record.issue_date?.trim() || null,
              violationTypeCode: record.violation_type_code?.trim() || null,
              violationNumber: record.violation_number.toString().trim(),
              houseNumber: record.house_number?.trim() || null,
              street: record.street?.trim() || null,
              dispositionComments: record.disposition_comments?.trim() || null,
              deviceNumber: record.device_number?.trim() || null,
              description: record.description?.trim() || null,
              number: record.number?.trim() || null,
              violationCategory: record.violation_category?.trim() || null,
              violationType: record.violation_type?.trim() || null,
              dataSourceId: '3h2n-5cm9'
            }
          });
          batchAdded++;
        } catch (error) {
          // Skip individual record errors
          continue;
        }
      }
      
      totalProcessed += batch.length;
      totalAdded += batchAdded;
      offset += batchSize;
      
      const coverage = ((totalAdded / 2446189) * 100).toFixed(1);
      console.log(`  ✅ Batch complete: +${batchAdded} | Total: ${totalAdded.toLocaleString()} | Coverage: ${coverage}%\n`);
      
      // Progress check
      if (totalAdded >= targetRecords) {
        console.log(`🎯 Target reached: ${totalAdded.toLocaleString()} records (${coverage}% coverage)`);
        hasMore = false;
      }
      
      // Enhanced rate limiting to avoid API limits
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Batch failed at offset ${offset}:`, error.message);
      // Continue with next batch
      offset += batchSize;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  return { totalProcessed, totalAdded };
}

async function syncDOBPermits() {
  console.log('🏗️ AGGRESSIVE DOB PERMITS SYNC');
  console.log('==============================\n');
  
  let offset = 0; // Start from beginning for permits
  const batchSize = 2000; // Smaller batches for better rate limiting
  let totalProcessed = 0;
  let totalAdded = 0;
  let hasMore = true;
  
  // Target: Get to 90% of 788K = 709K records
  const targetRecords = 709000;
  
  while (hasMore && totalProcessed < targetRecords) {
    try {
      console.log(`📊 Fetching batch: offset=${offset.toLocaleString()}, limit=${batchSize.toLocaleString()}`);
      
      const url = `${DOB_PERMITS_API}?$limit=${batchSize}&$offset=${offset}&$order=approved_date DESC`;
      const batch = await fetchWithRetry(url);
      
      if (batch.length === 0) {
        console.log('✅ No more records available from API');
        hasMore = false;
        break;
      }
      
      console.log(`  Processing ${batch.length} permits...`);
      
      // Process batch
      let batchAdded = 0;
      for (const record of batch) {
        try {
          if (!record.work_permit) continue;
          
          await prisma.nYCDOBPermit.upsert({
            where: {
              workPermit: record.work_permit.toString().trim()
            },
            update: {
              filingReason: record.filing_reason?.trim() || null,
              approvedDate: record.approved_date ? new Date(record.approved_date) : null,
              issuedDate: record.issued_date ? new Date(record.issued_date) : null,
              estimatedJobCosts: record.estimated_job_costs ? parseFloat(record.estimated_job_costs) : null,
              jobDescription: record.job_description?.trim() || null,
              updatedAt: new Date()
            },
            create: {
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
              workPermit: record.work_permit.toString().trim(),
              approvedDate: record.approved_date ? new Date(record.approved_date) : null,
              issuedDate: record.issued_date ? new Date(record.issued_date) : null,
              estimatedJobCosts: record.estimated_job_costs ? parseFloat(record.estimated_job_costs) : null,
              jobDescription: record.job_description?.trim() || null,
              dataSourceId: 'dq6g-a4sc'
            }
          });
          batchAdded++;
        } catch (error) {
          // Skip individual record errors
          continue;
        }
      }
      
      totalProcessed += batch.length;
      totalAdded += batchAdded;
      offset += batchSize;
      
      const coverage = ((totalAdded / 788340) * 100).toFixed(1);
      console.log(`  ✅ Batch complete: +${batchAdded} | Total: ${totalAdded.toLocaleString()} | Coverage: ${coverage}%\n`);
      
      // Progress check
      if (totalAdded >= targetRecords) {
        console.log(`🎯 Target reached: ${totalAdded.toLocaleString()} records (${coverage}% coverage)`);
        hasMore = false;
      }
      
      // Enhanced rate limiting to avoid API limits  
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`❌ Batch failed at offset ${offset}:`, error.message);
      offset += batchSize;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  return { totalProcessed, totalAdded };
}

async function main() {
  console.log('🚀 CONSTRUCTION DATA EMERGENCY SYNC');
  console.log('===================================');
  console.log('Target: 90%+ coverage for critical construction datasets\n');
  
  const startTime = Date.now();
  
  try {
    // Get current counts
    const currentViolations = await prisma.nYCDOBViolation.count();
    const currentPermits = await prisma.nYCDOBPermit.count();
    
    console.log(`📊 STARTING COUNTS:`);
    console.log(`   Violations: ${currentViolations.toLocaleString()}`);
    console.log(`   Permits: ${currentPermits.toLocaleString()}\n`);
    
    // Sync violations first (bigger gap)
    const violationsResult = await syncDOBViolations();
    
    // Sync permits
    const permitsResult = await syncDOBPermits();
    
    // Final verification
    const finalViolations = await prisma.nYCDOBViolation.count();
    const finalPermits = await prisma.nYCDOBPermit.count();
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log('\n🎉 CONSTRUCTION SYNC COMPLETE');
    console.log('=============================');
    console.log(`⏱️ Duration: ${duration} seconds`);
    console.log(`\n📊 FINAL RESULTS:`);
    console.log(`⚠️ DOB Violations: ${finalViolations.toLocaleString()} (${((finalViolations/2446189)*100).toFixed(1)}% coverage)`);
    console.log(`🏗️ DOB Permits: ${finalPermits.toLocaleString()} (${((finalPermits/788340)*100).toFixed(1)}% coverage)`);
    console.log(`\n🎯 CONSTRUCTION INTELLIGENCE UNLOCKED:`);
    console.log(`   • Comprehensive violation history for due diligence`);
    console.log(`   • Complete permit pipeline for development tracking`);
    console.log(`   • Ready for construction risk analysis`);
    
  } catch (error) {
    console.error('💥 Sync failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };