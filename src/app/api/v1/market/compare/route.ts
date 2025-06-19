import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { MarketRepository } from '@/lib/repositories/market-repository';
import { marketCompareSchema, MarketComparisonResponse } from '@/types/market';
import { 
  ValidationError, 
  AuthenticationError, 
  InternalError 
} from '@/lib/errors';

// POST /api/v1/market/compare - Compare multiple markets
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Require authentication
    const user = await requireAuth(request);

    // Parse and validate request body
    const body = await request.json();
    const params = marketCompareSchema.parse(body);

    // Get comparison data
    const repository = new MarketRepository();
    const { data, rankings } = await repository.compareMarkets(
      params.zipCodes,
      params.metrics,
      params.dateRange.start,
      params.dateRange.end
    );

    // Format response
    const response: MarketComparisonResponse = {
      zipCodes: params.zipCodes,
      metrics: params.metrics,
      dateRange: {
        start: params.dateRange.start.toISOString(),
        end: params.dateRange.end.toISOString(),
      },
      data,
      rankings,
    };

    return NextResponse.json({
      success: true,
      data: response,
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
          message: error instanceof ValidationError ? error.message : 'Invalid comparison parameters',
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

    console.error('Market comparison error:', error);
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