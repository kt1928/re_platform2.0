import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { MarketRepository } from '@/lib/repositories/market-repository';
import { 
  createMarketMetricSchema, 
  marketMetricsSearchSchema,
  MarketMetricResponse 
} from '@/types/market';
import { 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError,
  InternalError 
} from '@/lib/errors';

// GET /api/v1/market/metrics - Search market metrics
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Require authentication
    const user = await requireAuth(request);

    // Parse query parameters
    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams);
    const validatedParams = marketMetricsSearchSchema.parse(searchParams);

    if (!validatedParams.zipCode && !validatedParams.zipCodes) {
      throw new ValidationError('Either zipCode or zipCodes parameter is required');
    }

    // Get market metrics
    const repository = new MarketRepository();
    const metrics = await repository.findMetrics(validatedParams);

    // Format response
    const response: MarketMetricResponse[] = metrics.map(metric => ({
      id: metric.id,
      zipCode: metric.zipCode,
      metricDate: metric.metricDate.toISOString(),
      medianSalePrice: metric.medianSalePrice ? Number(metric.medianSalePrice) : null,
      medianRent: metric.medianRent ? Number(metric.medianRent) : null,
      pricePerSqft: metric.pricePerSqft ? Number(metric.pricePerSqft) : null,
      salesCount: metric.salesCount,
      newListingsCount: metric.newListingsCount,
      daysOnMarket: metric.daysOnMarket,
      activeListings: metric.activeListings,
      monthsOfSupply: metric.monthsOfSupply ? Number(metric.monthsOfSupply) : null,
      priceChangeYoy: metric.priceChangeYoy ? Number(metric.priceChangeYoy) : null,
      salesVolumeChangeYoy: metric.salesVolumeChangeYoy ? Number(metric.salesVolumeChangeYoy) : null,
      createdAt: metric.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        metrics: response,
        total: response.length,
        interval: validatedParams.interval,
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: process.env.API_VERSION || '1.0',
        request_id: requestId,
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError || error instanceof ValidationError) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error instanceof ValidationError ? error.message : 'Invalid parameters',
          details: error instanceof z.ZodError ? error.errors : undefined,
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: requestId,
        },
      }, { status: 400 });
    }

    if (error instanceof AuthenticationError) {
      return NextResponse.json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: requestId,
        },
      }, { status: error.statusCode });
    }

    console.error('Market metrics search error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
      meta: {
        timestamp: new Date().toISOString(),
        request_id: requestId,
      },
    }, { status: 500 });
  }
}

// POST /api/v1/market/metrics - Create/update market metrics (admin only)
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Require admin authentication
    const user = await requireAuth(request);
    requireAdmin(user);

    // Parse and validate request body
    const body = await request.json();
    const data = createMarketMetricSchema.parse(body);

    // Create or update metric
    const repository = new MarketRepository();
    const metric = await repository.upsert(data);

    // Format response
    const response: MarketMetricResponse = {
      id: metric.id,
      zipCode: metric.zipCode,
      metricDate: metric.metricDate.toISOString(),
      medianSalePrice: metric.medianSalePrice ? Number(metric.medianSalePrice) : null,
      medianRent: metric.medianRent ? Number(metric.medianRent) : null,
      pricePerSqft: metric.pricePerSqft ? Number(metric.pricePerSqft) : null,
      salesCount: metric.salesCount,
      newListingsCount: metric.newListingsCount,
      daysOnMarket: metric.daysOnMarket,
      activeListings: metric.activeListings,
      monthsOfSupply: metric.monthsOfSupply ? Number(metric.monthsOfSupply) : null,
      priceChangeYoy: metric.priceChangeYoy ? Number(metric.priceChangeYoy) : null,
      salesVolumeChangeYoy: metric.salesVolumeChangeYoy ? Number(metric.salesVolumeChangeYoy) : null,
      createdAt: metric.createdAt.toISOString(),
    };

    console.log(`Market metric upserted by ${user.email}: ${metric.zipCode} for ${metric.metricDate.toISOString()}`);

    return NextResponse.json({
      success: true,
      data: response,
      meta: {
        timestamp: new Date().toISOString(),
        version: process.env.API_VERSION || '1.0',
        request_id: requestId,
      },
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError || error instanceof ValidationError) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error instanceof ValidationError ? error.message : 'Invalid metric data',
          details: error instanceof z.ZodError ? error.errors : undefined,
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: requestId,
        },
      }, { status: 400 });
    }

    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return NextResponse.json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: requestId,
        },
      }, { status: error.statusCode });
    }

    console.error('Market metric creation error:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
      meta: {
        timestamp: new Date().toISOString(),
        request_id: requestId,
      },
    }, { status: 500 });
  }
}