import { Prisma } from '@prisma/client';

const streetNames = [
  'Main', 'Oak', 'Maple', 'Elm', 'Washington', 'Jefferson', 'Madison', 
  'Lincoln', 'Park', 'Broadway', 'Market', 'Church', 'Spring', 'River',
  'Sunset', 'Pine', 'Cedar', 'Birch', 'Cherry', 'Walnut', 'Chestnut'
];

const streetTypes = ['St', 'Ave', 'Blvd', 'Rd', 'Dr', 'Ln', 'Way', 'Ct'];

const cities = [
  { name: 'New York', state: 'NY', zips: ['10001', '10002', '10003', '10004', '10005'] },
  { name: 'Los Angeles', state: 'CA', zips: ['90001', '90002', '90003', '90004', '90005'] },
  { name: 'Chicago', state: 'IL', zips: ['60601', '60602', '60603', '60604', '60605'] },
  { name: 'Houston', state: 'TX', zips: ['77001', '77002', '77003', '77004', '77005'] },
  { name: 'Phoenix', state: 'AZ', zips: ['85001', '85002', '85003', '85004', '85005'] },
  { name: 'Philadelphia', state: 'PA', zips: ['19101', '19102', '19103', '19104', '19105'] },
  { name: 'San Antonio', state: 'TX', zips: ['78201', '78202', '78203', '78204', '78205'] },
  { name: 'San Diego', state: 'CA', zips: ['92101', '92102', '92103', '92104', '92105'] },
  { name: 'Dallas', state: 'TX', zips: ['75201', '75202', '75203', '75204', '75205'] },
  { name: 'San Jose', state: 'CA', zips: ['95101', '95102', '95103', '95104', '95105'] }
];

const propertyTypes = [
  'SINGLE_FAMILY', 'CONDO', 'TOWNHOUSE', 'MULTI_FAMILY'
] as const;

export interface MockPropertyData {
  address_line1: string;
  city: string;
  state: string;
  zip_code: string;
  property_type: typeof propertyTypes[number];
  bedrooms: number;
  bathrooms: number;
  square_feet: number;
  lot_size?: number;
  year_built: number;
  list_price: number;
  rent_estimate: number;
  tax_assessed_value: number;
  latitude: number;
  longitude: number;
}

export class MockPropertyGenerator {
  private getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  private getRandomNumber(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private getRandomDecimal(min: number, max: number, decimals: number = 2): number {
    const value = Math.random() * (max - min) + min;
    return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }

  generateProperty(): MockPropertyData {
    const city = this.getRandomElement(cities);
    const propertyType = this.getRandomElement(propertyTypes);
    
    // Generate address
    const streetNumber = this.getRandomNumber(1, 9999);
    const streetName = this.getRandomElement(streetNames);
    const streetType = this.getRandomElement(streetTypes);
    const address_line1 = `${streetNumber} ${streetName} ${streetType}`;
    
    // Property characteristics based on type
    let bedrooms: number;
    let bathrooms: number;
    let square_feet: number;
    let lot_size: number | undefined;
    let pricePerSqft: number;
    
    switch (propertyType) {
      case 'SINGLE_FAMILY':
        bedrooms = this.getRandomNumber(2, 5);
        bathrooms = this.getRandomDecimal(1, 4, 1);
        square_feet = this.getRandomNumber(1200, 4000);
        lot_size = this.getRandomNumber(3000, 15000);
        pricePerSqft = this.getRandomNumber(150, 400);
        break;
      case 'CONDO':
        bedrooms = this.getRandomNumber(1, 3);
        bathrooms = this.getRandomDecimal(1, 2.5, 1);
        square_feet = this.getRandomNumber(600, 2000);
        lot_size = undefined;
        pricePerSqft = this.getRandomNumber(200, 600);
        break;
      case 'TOWNHOUSE':
        bedrooms = this.getRandomNumber(2, 4);
        bathrooms = this.getRandomDecimal(1.5, 3.5, 1);
        square_feet = this.getRandomNumber(1000, 2500);
        lot_size = this.getRandomNumber(1000, 4000);
        pricePerSqft = this.getRandomNumber(175, 450);
        break;
      case 'MULTI_FAMILY':
        bedrooms = this.getRandomNumber(4, 8);
        bathrooms = this.getRandomDecimal(2, 6, 1);
        square_feet = this.getRandomNumber(2000, 6000);
        lot_size = this.getRandomNumber(4000, 20000);
        pricePerSqft = this.getRandomNumber(125, 350);
        break;
      default:
        bedrooms = 3;
        bathrooms = 2;
        square_feet = 1500;
        pricePerSqft = 200;
    }
    
    const list_price = Math.round(square_feet * pricePerSqft / 1000) * 1000;
    const year_built = this.getRandomNumber(1950, 2023);
    
    // Estimate monthly rent (typically 0.8% to 1.1% of home value)
    const rentRatio = this.getRandomDecimal(0.008, 0.011);
    const rent_estimate = Math.round(list_price * rentRatio / 50) * 50;
    
    // Tax assessed value (typically 70-90% of market value)
    const assessmentRatio = this.getRandomDecimal(0.7, 0.9);
    const tax_assessed_value = Math.round(list_price * assessmentRatio / 1000) * 1000;
    
    // Generate coordinates (rough approximation based on city)
    const baseCoords = this.getCityCoordinates(city.name);
    const latitude = baseCoords.lat + this.getRandomDecimal(-0.1, 0.1, 6);
    const longitude = baseCoords.lng + this.getRandomDecimal(-0.1, 0.1, 6);
    
    return {
      address_line1,
      city: city.name,
      state: city.state,
      zip_code: this.getRandomElement(city.zips),
      property_type: propertyType,
      bedrooms,
      bathrooms,
      square_feet,
      lot_size,
      year_built,
      list_price,
      rent_estimate,
      tax_assessed_value,
      latitude,
      longitude
    };
  }

  generateMultiple(count: number): MockPropertyData[] {
    return Array.from({ length: count }, () => this.generateProperty());
  }

  private getCityCoordinates(cityName: string): { lat: number; lng: number } {
    const coords: Record<string, { lat: number; lng: number }> = {
      'New York': { lat: 40.7128, lng: -74.0060 },
      'Los Angeles': { lat: 34.0522, lng: -118.2437 },
      'Chicago': { lat: 41.8781, lng: -87.6298 },
      'Houston': { lat: 29.7604, lng: -95.3698 },
      'Phoenix': { lat: 33.4484, lng: -112.0740 },
      'Philadelphia': { lat: 39.9526, lng: -75.1652 },
      'San Antonio': { lat: 29.4241, lng: -98.4936 },
      'San Diego': { lat: 32.7157, lng: -117.1611 },
      'Dallas': { lat: 32.7767, lng: -96.7970 },
      'San Jose': { lat: 37.3382, lng: -121.8863 }
    };
    
    return coords[cityName] || { lat: 39.8283, lng: -98.5795 }; // Default to center of USA
  }
}