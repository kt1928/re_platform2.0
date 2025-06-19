import { z } from 'zod';
import { RiskTolerance } from '@prisma/client';

// Portfolio validation schemas
export const createPortfolioSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(1000).optional(),
  targetReturn: z.number().min(0).max(100).optional(),
  riskTolerance: z.nativeEnum(RiskTolerance).optional(),
});

export const updatePortfolioSchema = createPortfolioSchema.partial();

export const portfolioSearchSchema = z.object({
  q: z.string().max(255).optional(),
  userId: z.string().uuid().optional(),
  riskTolerance: z.nativeEnum(RiskTolerance).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// Portfolio property management schemas
export const addPropertyToPortfolioSchema = z.object({
  propertyId: z.string().uuid(),
  purchaseDate: z.string().datetime().or(z.date()).transform(val => new Date(val)),
  purchasePrice: z.number().min(0).max(999999999.99),
  downPayment: z.number().min(0).max(999999999.99).optional(),
  loanAmount: z.number().min(0).max(999999999.99).optional(),
  interestRate: z.number().min(0).max(100).optional(),
  currentValue: z.number().min(0).max(999999999.99).optional(),
  monthlyRent: z.number().min(0).max(99999999.99).optional(),
  occupancyStatus: z.string().max(20).optional(),
});

export const updatePortfolioPropertySchema = addPropertyToPortfolioSchema
  .omit({ propertyId: true })
  .partial();

// Type exports
export type CreatePortfolioRequest = z.infer<typeof createPortfolioSchema>;
export type UpdatePortfolioRequest = z.infer<typeof updatePortfolioSchema>;
export type PortfolioSearchParams = z.infer<typeof portfolioSearchSchema>;
export type AddPropertyToPortfolioRequest = z.infer<typeof addPropertyToPortfolioSchema>;
export type UpdatePortfolioPropertyRequest = z.infer<typeof updatePortfolioPropertySchema>;

// Response types
export interface PortfolioResponse {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  targetReturn: number | null;
  riskTolerance: RiskTolerance;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioPropertyResponse {
  id: string;
  portfolioId: string;
  property: {
    id: string;
    addressLine1: string;
    city: string;
    state: string;
    zipCode: string;
    propertyType: string;
  };
  purchaseDate: string;
  purchasePrice: number;
  downPayment: number | null;
  loanAmount: number | null;
  interestRate: number | null;
  currentValue: number | null;
  monthlyRent: number | null;
  occupancyStatus: string | null;
  totalReturn: number | null;
  annualizedReturn: number | null;
  cashOnCashReturn: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioPerformanceResponse {
  portfolioId: string;
  portfolioName: string;
  propertyCount: number;
  totalInvested: number;
  totalValue: number;
  totalMonthlyRent: number;
  avgReturn: number | null;
  unrealizedGain: number;
  metrics: {
    totalReturn: number;
    returnPercentage: number;
    annualizedReturn: number | null;
    monthlyIncome: number;
    occupancyRate: number;
  };
  properties: Array<{
    propertyId: string;
    address: string;
    purchasePrice: number;
    currentValue: number | null;
    monthlyRent: number | null;
    return: number | null;
  }>;
}