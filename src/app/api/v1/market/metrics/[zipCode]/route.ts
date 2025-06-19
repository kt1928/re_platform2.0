import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { MarketRepository } from '@/lib/repositories/market-repository';
import { marketMetricsSearchSchema, MarketMetricResponse } from '@/types/market';
import { 
  ValidationError, 
  AuthenticationError, 
  InternalError 
} from '@/lib/errors';

// GET /api/v1/market/metrics/:zipCode - Get market metrics for ZIP code
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ zipCode: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    // Require authentication
    const user = await requireAuth(request);

    // Resolve params and validate ZIP code
    const resolvedParams = await params;
    const zipCodeRegex = /^\d{5}(-\d{4})?$/;
    if (!zipCodeRegex.test(resolvedParams.zipCode)) {
      throw new ValidationError('Invalid ZIP code format');
    }

    // Parse query parameters
    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams);
    const validatedParams = marketMetricsSearchSchema.parse({
      ...searchParams,
      zipCode: resolvedParams.zipCode,
    });

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
        zipCode: resolvedParams.zipCode,
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

    console.error('Market metrics fetch error:', error);
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