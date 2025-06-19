import { z } from 'zod';

// Market metrics validation schemas
export const createMarketMetricSchema = z.object({
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code format'),
  metricDate: z.string().datetime().or(z.date()).transform(val => new Date(val)),
  medianSalePrice: z.number().min(0).max(999999999.99).optional(),
  medianRent: z.number().min(0).max(99999999.99).optional(),
  pricePerSqft: z.number().min(0).max(99999.99).optional(),
  salesCount: z.number().int().min(0).optional(),
  newListingsCount: z.number().int().min(0).optional(),
  daysOnMarket: z.number().int().min(0).optional(),
  activeListings: z.number().int().min(0).optional(),
  monthsOfSupply: z.number().min(0).max(99.99).optional(),
  priceChangeYoy: z.number().min(-100).max(1000).optional(),
  salesVolumeChangeYoy: z.number().min(-100).max(1000).optional(),
});

export const marketMetricsSearchSchema = z.object({
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/).optional(),
  zipCodes: z.string().optional(), // Comma-separated list
  startDate: z.string().datetime().or(z.date()).transform(val => new Date(val)).optional(),
  endDate: z.string().datetime().or(z.date()).transform(val => new Date(val)).optional(),
  limit: z.coerce.number().int().min(1).max(365).default(30),
  interval: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
});

export const marketTrendsSchema = z.object({
  zipCodes: z.string(), // Comma-separated list
  metric: z.enum([
    'medianSalePrice',
    'medianRent',
    'pricePerSqft',
    'salesCount',
    'daysOnMarket',
    'activeListings',
  ]),
  period: z.enum(['1m', '3m', '6m', '1y', '5y']).default('1y'),
});

export const marketCompareSchema = z.object({
  zipCodes: z.array(z.string().regex(/^\d{5}(-\d{4})?$/)).min(2).max(10),
  metrics: z.array(z.enum([
    'medianSalePrice',
    'medianRent',
    'pricePerSqft',
    'salesCount',
    'daysOnMarket',
    'priceChangeYoy',
  ])).min(1),
  dateRange: z.object({
    start: z.string().datetime().or(z.date()).transform(val => new Date(val)),
    end: z.string().datetime().or(z.date()).transform(val => new Date(val)),
  }),
});

// Type exports
export type CreateMarketMetricRequest = z.infer<typeof createMarketMetricSchema>;
export type MarketMetricsSearchParams = z.infer<typeof marketMetricsSearchSchema>;
export type MarketTrendsParams = z.infer<typeof marketTrendsSchema>;
export type MarketCompareRequest = z.infer<typeof marketCompareSchema>;

// Response types
export interface MarketMetricResponse {
  id: string;
  zipCode: string;
  metricDate: string;
  medianSalePrice: number | null;
  medianRent: number | null;
  pricePerSqft: number | null;
  salesCount: number | null;
  newListingsCount: number | null;
  daysOnMarket: number | null;
  activeListings: number | null;
  monthsOfSupply: number | null;
  priceChangeYoy: number | null;
  salesVolumeChangeYoy: number | null;
  createdAt: string;
}

export interface MarketTrendPoint {
  date: string;
  value: number | null;
}

export interface MarketTrendsResponse {
  zipCodes: string[];
  metric: string;
  period: string;
  trends: {
    [zipCode: string]: MarketTrendPoint[];
  };
  summary: {
    [zipCode: string]: {
      current: number | null;
      change: number | null;
      changePercent: number | null;
      min: number | null;
      max: number | null;
      avg: number | null;
    };
  };
}

export interface MarketComparisonResponse {
  zipCodes: string[];
  metrics: string[];
  dateRange: {
    start: string;
    end: string;
  };
  data: {
    [zipCode: string]: {
      [metric: string]: {
        current: number | null;
        previous: number | null;
        change: number | null;
        changePercent: number | null;
        avg: number | null;
      };
    };
  };
  rankings: {
    [metric: string]: Array<{
      zipCode: string;
      value: number | null;
      rank: number;
    }>;
  };
}