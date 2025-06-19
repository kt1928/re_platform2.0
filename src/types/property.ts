import { z } from 'zod';
import { PropertyType } from '@prisma/client';

// Property validation schemas
export const createPropertySchema = z.object({
  externalId: z.string().max(100).optional(),
  addressLine1: z.string().min(1, 'Address is required').max(255),
  addressLine2: z.string().max(255).optional(),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().regex(/^[A-Z]{2}$/, 'State must be 2 uppercase letters'),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  propertyType: z.nativeEnum(PropertyType),
  bedrooms: z.number().int().min(0).max(20).optional(),
  bathrooms: z.number().min(0).max(20).optional(),
  squareFeet: z.number().int().min(1).max(100000).optional(),
  lotSize: z.number().int().min(1).optional(),
  yearBuilt: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  listPrice: z.number().min(0).max(999999999.99).optional(),
  soldPrice: z.number().min(0).max(999999999.99).optional(),
  rentEstimate: z.number().min(0).max(99999999.99).optional(),
  taxAssessedValue: z.number().min(0).max(999999999.99).optional(),
  dataSource: z.string().min(1).max(50),
});

export const updatePropertySchema = createPropertySchema.partial();

export const propertySearchSchema = z.object({
  q: z.string().max(255).optional(),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/).optional(),
  city: z.string().max(100).optional(),
  state: z.string().regex(/^[A-Z]{2}$/).optional(),
  propertyType: z.nativeEnum(PropertyType).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minBedrooms: z.coerce.number().int().min(0).optional(),
  maxBedrooms: z.coerce.number().int().min(0).optional(),
  minBathrooms: z.coerce.number().min(0).optional(),
  maxBathrooms: z.coerce.number().min(0).optional(),
  minSquareFeet: z.coerce.number().int().min(1).optional(),
  maxSquareFeet: z.coerce.number().int().min(1).optional(),
  minYearBuilt: z.coerce.number().int().min(1800).optional(),
  maxYearBuilt: z.coerce.number().int().max(new Date().getFullYear()).optional(),
  isActive: z.coerce.boolean().optional(),
  dataSource: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sortBy: z.enum(['createdAt', 'updatedAt', 'listPrice', 'soldPrice', 'squareFeet']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Type exports
export type CreatePropertyRequest = z.infer<typeof createPropertySchema>;
export type UpdatePropertyRequest = z.infer<typeof updatePropertySchema>;
export type PropertySearchParams = z.infer<typeof propertySearchSchema>;

// Response types
export interface PropertyResponse {
  id: string;
  externalId: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zipCode: string;
  latitude: number | null;
  longitude: number | null;
  propertyType: PropertyType;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  listPrice: number | null;
  soldPrice: number | null;
  rentEstimate: number | null;
  taxAssessedValue: number | null;
  dataSource: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PropertySearchResponse {
  properties: PropertyResponse[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface PropertyHistoryItem {
  id: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  dataSource: string | null;
}