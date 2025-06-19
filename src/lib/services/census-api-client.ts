interface CensusVariable {
  code: string;
  description: string;
  table: string;
}

export const CENSUS_VARIABLES: Record<string, CensusVariable> = {
  // Population
  'B01003_001E': { code: 'B01003_001E', description: 'Total Population', table: 'B01003' },
  
  // Income
  'B19013_001E': { code: 'B19013_001E', description: 'Median Household Income', table: 'B19013' },
  'B19113_001E': { code: 'B19113_001E', description: 'Median Family Income', table: 'B19113' },
  
  // Employment
  'B23025_002E': { code: 'B23025_002E', description: 'Civilian Labor Force (Employed)', table: 'B23025' },
  'B23025_005E': { code: 'B23025_005E', description: 'Unemployed', table: 'B23025' },
  
  // Housing Tenure
  'B25003_002E': { code: 'B25003_002E', description: 'Owner-Occupied Housing Units', table: 'B25003' },
  'B25003_003E': { code: 'B25003_003E', description: 'Renter-Occupied Housing Units', table: 'B25003' },
  
  // Housing Units by Structure
  'B25024_001E': { code: 'B25024_001E', description: 'Total Housing Units', table: 'B25024' },
  'B25024_002E': { code: 'B25024_002E', description: 'Single-Family Detached', table: 'B25024' },
  'B25024_003E': { code: 'B25024_003E', description: 'Single-Family Attached', table: 'B25024' },
  'B25024_004E': { code: 'B25024_004E', description: '2 Units', table: 'B25024' },
  'B25024_005E': { code: 'B25024_005E', description: '3-4 Units', table: 'B25024' },
  'B25024_006E': { code: 'B25024_006E', description: '5-9 Units', table: 'B25024' },
  'B25024_007E': { code: 'B25024_007E', description: '10-19 Units', table: 'B25024' },
  'B25024_008E': { code: 'B25024_008E', description: '20-49 Units', table: 'B25024' },
  'B25024_009E': { code: 'B25024_009E', description: '50+ Units', table: 'B25024' },
  'B25024_010E': { code: 'B25024_010E', description: 'Mobile Home/Other', table: 'B25024' },
  
  // Income Distribution
  'B19001_002E': { code: 'B19001_002E', description: 'Income Less than $10,000', table: 'B19001' },
  'B19001_003E': { code: 'B19001_003E', description: 'Income $10,000 to $14,999', table: 'B19001' },
  'B19001_004E': { code: 'B19001_004E', description: 'Income $15,000 to $19,999', table: 'B19001' },
  'B19001_005E': { code: 'B19001_005E', description: 'Income $20,000 to $24,999', table: 'B19001' },
  'B19001_006E': { code: 'B19001_006E', description: 'Income $25,000 to $29,999', table: 'B19001' },
  'B19001_007E': { code: 'B19001_007E', description: 'Income $30,000 to $34,999', table: 'B19001' },
  'B19001_008E': { code: 'B19001_008E', description: 'Income $35,000 to $39,999', table: 'B19001' },
  'B19001_009E': { code: 'B19001_009E', description: 'Income $40,000 to $44,999', table: 'B19001' },
  'B19001_010E': { code: 'B19001_010E', description: 'Income $45,000 to $49,999', table: 'B19001' },
  'B19001_011E': { code: 'B19001_011E', description: 'Income $50,000 to $59,999', table: 'B19001' },
  'B19001_012E': { code: 'B19001_012E', description: 'Income $60,000 to $74,999', table: 'B19001' },
  'B19001_013E': { code: 'B19001_013E', description: 'Income $75,000 to $99,999', table: 'B19001' },
  'B19001_014E': { code: 'B19001_014E', description: 'Income $100,000 to $124,999', table: 'B19001' },
  'B19001_015E': { code: 'B19001_015E', description: 'Income $125,000 to $149,999', table: 'B19001' },
  'B19001_016E': { code: 'B19001_016E', description: 'Income $150,000 to $199,999', table: 'B19001' },
  'B19001_017E': { code: 'B19001_017E', description: 'Income $200,000+', table: 'B19001' },
  
  // Demographics by Age and Sex
  'B01001_001E': { code: 'B01001_001E', description: 'Total Population by Sex', table: 'B01001' },
  'B01001_003E': { code: 'B01001_003E', description: 'Male Under 5 Years', table: 'B01001' },
  'B01001_027E': { code: 'B01001_027E', description: 'Female Under 5 Years', table: 'B01001' },
  'B01001_004E': { code: 'B01001_004E', description: 'Male 5-9 Years', table: 'B01001' },
  'B01001_028E': { code: 'B01001_028E', description: 'Female 5-9 Years', table: 'B01001' },
  'B01001_005E': { code: 'B01001_005E', description: 'Male 10-14 Years', table: 'B01001' },
  'B01001_029E': { code: 'B01001_029E', description: 'Female 10-14 Years', table: 'B01001' },
  'B01001_006E': { code: 'B01001_006E', description: 'Male 15-17 Years', table: 'B01001' },
  'B01001_030E': { code: 'B01001_030E', description: 'Female 15-17 Years', table: 'B01001' },
  'B01001_007E': { code: 'B01001_007E', description: 'Male 18-19 Years', table: 'B01001' },
  'B01001_031E': { code: 'B01001_031E', description: 'Female 18-19 Years', table: 'B01001' },
  'B01001_008E': { code: 'B01001_008E', description: 'Male 20 Years', table: 'B01001' },
  'B01001_032E': { code: 'B01001_032E', description: 'Female 20 Years', table: 'B01001' },
  'B01001_009E': { code: 'B01001_009E', description: 'Male 21 Years', table: 'B01001' },
  'B01001_033E': { code: 'B01001_033E', description: 'Female 21 Years', table: 'B01001' },
  'B01001_010E': { code: 'B01001_010E', description: 'Male 22-24 Years', table: 'B01001' },
  'B01001_034E': { code: 'B01001_034E', description: 'Female 22-24 Years', table: 'B01001' },
  'B01001_011E': { code: 'B01001_011E', description: 'Male 25-29 Years', table: 'B01001' },
  'B01001_035E': { code: 'B01001_035E', description: 'Female 25-29 Years', table: 'B01001' },
  'B01001_012E': { code: 'B01001_012E', description: 'Male 30-34 Years', table: 'B01001' },
  'B01001_036E': { code: 'B01001_036E', description: 'Female 30-34 Years', table: 'B01001' },
  'B01001_013E': { code: 'B01001_013E', description: 'Male 35-39 Years', table: 'B01001' },
  'B01001_037E': { code: 'B01001_037E', description: 'Female 35-39 Years', table: 'B01001' },
  'B01001_017E': { code: 'B01001_017E', description: 'Male 60-61 Years', table: 'B01001' },
  'B01001_041E': { code: 'B01001_041E', description: 'Female 60-61 Years', table: 'B01001' },
  'B01001_020E': { code: 'B01001_020E', description: 'Male 65-66 Years', table: 'B01001' },
  'B01001_044E': { code: 'B01001_044E', description: 'Female 65-66 Years', table: 'B01001' }
};

export interface CensusData {
  zipCode: string;
  state: string;
  [key: string]: string | number | null;
}

export class CensusApiClient {
  private baseUrl = 'https://api.census.gov/data';
  private apiKey?: string;

  constructor(apiKey?: string) {
    // TODO: Move API key to environment variables for production
    this.apiKey = apiKey || process.env.CENSUS_API_KEY || 'ebebfc045542f544e8eb57e1f158c06abb66d2e3';
  }

  /**
   * Fetch census data for ZIP Code Tabulation Areas (ZCTAs)
   * Note: ZCTAs are only available in 2019 ACS 5-Year data and earlier
   */
  async fetchZipCodeData(year: number = 2019, state?: string, testMode: boolean = false): Promise<CensusData[]> {
    // In test mode, only fetch a few key variables
    const allVariables = testMode 
      ? ['B01003_001E', 'B19013_001E', 'B25003_002E'] // Just 3 key variables for testing
      : Object.keys(CENSUS_VARIABLES);
    const chunkSize = 1; // Limit to 1 variable per request (Census API has very strict limits for ZCTAs)
    const chunks: string[][] = [];
    
    for (let i = 0; i < allVariables.length; i += chunkSize) {
      chunks.push(allVariables.slice(i, i + chunkSize));
    }

    console.log(`Fetching Census data in ${chunks.length} chunks for year ${year}${state ? ` (state: ${state})` : ''}`);

    try {
      let allResults: CensusData[] = [];
      
      for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const variables = chunks[chunkIndex].join(',');
        
        let url = `${this.baseUrl}/${year}/acs/acs5`;
        let params = new URLSearchParams({
          get: `${variables},state,zip code tabulation area`,
          for: 'zip code tabulation area:*'
        });

        // Note: Removed state filtering from API call due to 204 responses
        // Will filter by state in post-processing instead

        if (this.apiKey) {
          params.set('key', this.apiKey);
        }

        url += `?${params.toString()}`;
        console.log(`Fetching chunk ${chunkIndex + 1}/${chunks.length}: ${url.substring(0, 150)}...`);

        const response = await fetch(url);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Census API error (chunk ${chunkIndex + 1}): ${response.status} ${response.statusText} - ${errorText}`);
        }

        const responseText = await response.text();
        console.log(`Response status: ${response.status}, Content-Length: ${responseText.length}`);
        
        if (!responseText.trim()) {
          console.log(`Warning: Empty response for chunk ${chunkIndex + 1}, skipping...`);
          continue;
        }

        const rawData: (string | number)[][] = JSON.parse(responseText);
        
        if (!rawData || rawData.length === 0) {
          throw new Error(`No data returned from Census API for chunk ${chunkIndex + 1}`);
        }

        // First row contains column headers
        const headers = rawData[0] as string[];
        const dataRows = rawData.slice(1);

        const chunkResults: CensusData[] = dataRows.map(row => {
          const record: CensusData = {
            zipCode: '',
            state: ''
          };

          headers.forEach((header, index) => {
            const value = row[index];
            
            if (header === 'state') {
              record.state = String(value);
            } else if (header === 'zip code tabulation area') {
              record.zipCode = String(value);
            } else if (CENSUS_VARIABLES[header]) {
              // Convert to number if it's not null and not an error code
              record[header] = (value === null || value === -666666666) ? null : Number(value);
            }
          });

          return record;
        }).filter(record => record.zipCode && record.state);

        // Merge with existing results
        if (chunkIndex === 0) {
          allResults = chunkResults;
        } else {
          // Merge data by ZIP code
          allResults.forEach((existingRecord, index) => {
            const matchingChunkRecord = chunkResults.find(r => 
              r.zipCode === existingRecord.zipCode && r.state === existingRecord.state
            );
            if (matchingChunkRecord) {
              // Merge the census variables
              Object.keys(matchingChunkRecord).forEach(key => {
                if (key !== 'zipCode' && key !== 'state') {
                  allResults[index][key] = matchingChunkRecord[key];
                }
              });
            }
          });
        }
        
        // Add delay between requests to avoid rate limiting
        if (chunkIndex < chunks.length - 1) {
          console.log(`Waiting 1 second before next request...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Filter by state if specified
      if (state) {
        allResults = allResults.filter(record => record.state === state);
        console.log(`Filtered to ${allResults.length} ZIP code records for state ${state}`);
      }

      console.log(`Successfully fetched ${allResults.length} ZIP code records for year ${year}`);
      return allResults;

    } catch (error) {
      console.error('Error fetching Census data:', error);
      throw error;
    }
  }

  /**
   * Get available years for ACS 5-Year data with ZCTA support
   */
  getAvailableYears(): number[] {
    // ACS 5-Year data with ZCTAs is available from 2009 to 2019
    // Note: ZCTAs were discontinued in ACS releases after 2019
    const years: number[] = [];
    
    for (let year = 2009; year <= 2019; year++) {
      years.push(year);
    }
    
    return years;
  }

  /**
   * Test API connection and get sample data
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test with a simple query for a specific ZIP code using 2019 data
      const testUrl = `${this.baseUrl}/2019/acs/acs5?get=B01003_001E&for=zip code tabulation area:10001&in=state:36${this.apiKey ? `&key=${this.apiKey}` : ''}`;
      
      const response = await fetch(testUrl);
      const success = response.ok;
      
      if (!success) {
        const errorText = await response.text();
        console.error(`Census API test failed: ${response.status} ${response.statusText} - ${errorText}`);
      } else {
        console.log('Census API connection test successful');
      }
      
      return success;
    } catch (error) {
      console.error('Census API connection test failed:', error);
      return false;
    }
  }

  /**
   * Get state FIPS codes for reference
   */
  getStateFipsCodes(): Record<string, string> {
    return {
      '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
      '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware',
      '11': 'District of Columbia', '12': 'Florida', '13': 'Georgia', '15': 'Hawaii',
      '16': 'Idaho', '17': 'Illinois', '18': 'Indiana', '19': 'Iowa',
      '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
      '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
      '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska',
      '32': 'Nevada', '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico',
      '36': 'New York', '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio',
      '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
      '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas',
      '49': 'Utah', '50': 'Vermont', '51': 'Virginia', '53': 'Washington',
      '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming'
    };
  }
}