/**
 * ZIP Code to State Mapping Service
 * 
 * Maps ZIP codes to their corresponding states using ZIP code ranges.
 * This is needed for 2020+ Census data since the API no longer includes state information.
 */

interface ZipRange {
  start: string;
  end: string;
  state: string;
  stateName: string;
}

// ZIP code ranges by state (USPS official ranges)
const ZIP_RANGES: ZipRange[] = [
  { start: '00501', end: '00544', state: '36', stateName: 'New York' }, // NY special case
  { start: '00601', end: '00988', state: '72', stateName: 'Puerto Rico' },
  { start: '01001', end: '01299', state: '25', stateName: 'Massachusetts' },
  { start: '01301', end: '01999', state: '25', stateName: 'Massachusetts' },
  { start: '02001', end: '02299', state: '25', stateName: 'Massachusetts' },
  { start: '02301', end: '02799', state: '25', stateName: 'Massachusetts' },
  { start: '02801', end: '02999', state: '44', stateName: 'Rhode Island' },
  { start: '03001', end: '03899', state: '33', stateName: 'New Hampshire' },
  { start: '03901', end: '04999', state: '23', stateName: 'Maine' },
  { start: '05001', end: '05999', state: '50', stateName: 'Vermont' },
  { start: '06001', end: '06999', state: '09', stateName: 'Connecticut' },
  { start: '07001', end: '08999', state: '34', stateName: 'New Jersey' },
  { start: '10001', end: '14999', state: '36', stateName: 'New York' },
  { start: '15001', end: '19699', state: '42', stateName: 'Pennsylvania' },
  { start: '19701', end: '19999', state: '10', stateName: 'Delaware' },
  { start: '20001', end: '20599', state: '11', stateName: 'District of Columbia' },
  { start: '20601', end: '21999', state: '24', stateName: 'Maryland' },
  { start: '22001', end: '24699', state: '51', stateName: 'Virginia' },
  { start: '24701', end: '26999', state: '54', stateName: 'West Virginia' },
  { start: '27001', end: '28999', state: '37', stateName: 'North Carolina' },
  { start: '29001', end: '29999', state: '45', stateName: 'South Carolina' },
  { start: '30001', end: '31999', state: '13', stateName: 'Georgia' },
  { start: '32001', end: '34999', state: '12', stateName: 'Florida' },
  { start: '35001', end: '36999', state: '01', stateName: 'Alabama' },
  { start: '37001', end: '38599', state: '47', stateName: 'Tennessee' },
  { start: '38601', end: '39999', state: '28', stateName: 'Mississippi' },
  { start: '40001', end: '42799', state: '21', stateName: 'Kentucky' },
  { start: '43001', end: '45999', state: '39', stateName: 'Ohio' },
  { start: '46001', end: '47999', state: '18', stateName: 'Indiana' },
  { start: '48001', end: '49999', state: '26', stateName: 'Michigan' },
  { start: '50001', end: '52999', state: '19', stateName: 'Iowa' },
  { start: '53001', end: '54999', state: '55', stateName: 'Wisconsin' },
  { start: '55001', end: '56799', state: '27', stateName: 'Minnesota' },
  { start: '57001', end: '57799', state: '46', stateName: 'South Dakota' },
  { start: '58001', end: '58899', state: '38', stateName: 'North Dakota' },
  { start: '59001', end: '59999', state: '30', stateName: 'Montana' },
  { start: '60001', end: '62999', state: '17', stateName: 'Illinois' },
  { start: '63001', end: '65999', state: '29', stateName: 'Missouri' },
  { start: '66001', end: '67999', state: '20', stateName: 'Kansas' },
  { start: '68001', end: '69999', state: '31', stateName: 'Nebraska' },
  { start: '70001', end: '71499', state: '22', stateName: 'Louisiana' },
  { start: '71601', end: '72999', state: '05', stateName: 'Arkansas' },
  { start: '73001', end: '74999', state: '40', stateName: 'Oklahoma' },
  { start: '75001', end: '79999', state: '48', stateName: 'Texas' },
  { start: '80001', end: '81999', state: '08', stateName: 'Colorado' },
  { start: '82001', end: '83199', state: '56', stateName: 'Wyoming' },
  { start: '83201', end: '83899', state: '16', stateName: 'Idaho' },
  { start: '84001', end: '84999', state: '49', stateName: 'Utah' },
  { start: '85001', end: '86599', state: '04', stateName: 'Arizona' },
  { start: '87001', end: '88499', state: '35', stateName: 'New Mexico' },
  { start: '88501', end: '88599', state: '48', stateName: 'Texas' },
  { start: '89001', end: '89999', state: '32', stateName: 'Nevada' },
  { start: '90001', end: '96199', state: '06', stateName: 'California' },
  { start: '96701', end: '96899', state: '15', stateName: 'Hawaii' },
  { start: '97001', end: '97999', state: '41', stateName: 'Oregon' },
  { start: '98001', end: '99499', state: '53', stateName: 'Washington' },
  { start: '99501', end: '99999', state: '02', stateName: 'Alaska' }
];

export class ZipToStateMapper {
  /**
   * Map a ZIP code to its corresponding state FIPS code
   */
  static getStateFromZip(zipCode: string): { state: string; stateName: string } | null {
    if (!zipCode || zipCode.length < 5) {
      return null;
    }

    // Normalize ZIP code to 5 digits
    const normalizedZip = zipCode.padStart(5, '0').substring(0, 5);

    // Find the matching range
    for (const range of ZIP_RANGES) {
      if (normalizedZip >= range.start && normalizedZip <= range.end) {
        return {
          state: range.state,
          stateName: range.stateName
        };
      }
    }

    // Special cases for territories and military
    if (zipCode.startsWith('96')) {
      if (zipCode >= '96200' && zipCode <= '96699') {
        return { state: '60', stateName: 'American Samoa' }; // AS
      }
      if (zipCode >= '96910' && zipCode <= '96932') {
        return { state: '66', stateName: 'Guam' }; // GU
      }
      if (zipCode >= '96940' && zipCode <= '96944') {
        return { state: '69', stateName: 'Northern Mariana Islands' }; // MP
      }
      if (zipCode >= '96950' && zipCode <= '96952') {
        return { state: '70', stateName: 'Palau' }; // PW
      }
    }

    // Virgin Islands
    if (zipCode >= '00801' && zipCode <= '00899') {
      return { state: '78', stateName: 'U.S. Virgin Islands' };
    }

    console.warn(`No state mapping found for ZIP code: ${zipCode}`);
    return null;
  }

  /**
   * Validate that a ZIP code belongs to a specific state
   */
  static validateZipForState(zipCode: string, expectedState: string): boolean {
    const mapping = this.getStateFromZip(zipCode);
    return mapping?.state === expectedState;
  }

  /**
   * Get all ZIP codes that should belong to a specific state from a list
   */
  static filterZipsByState(zipCodes: string[], targetState: string): string[] {
    return zipCodes.filter(zip => {
      const mapping = this.getStateFromZip(zip);
      return mapping?.state === targetState;
    });
  }

  /**
   * Get statistics about ZIP code distribution by state
   */
  static analyzeZipDistribution(zipCodes: string[]): Record<string, { count: number; stateName: string }> {
    const distribution: Record<string, { count: number; stateName: string }> = {};

    zipCodes.forEach(zip => {
      const mapping = this.getStateFromZip(zip);
      if (mapping) {
        if (!distribution[mapping.state]) {
          distribution[mapping.state] = {
            count: 0,
            stateName: mapping.stateName
          };
        }
        distribution[mapping.state].count++;
      }
    });

    return distribution;
  }
}