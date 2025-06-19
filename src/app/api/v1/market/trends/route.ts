import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { MarketRepository } from '@/lib/repositories/market-repository';
import { marketTrendsSchema, MarketTrendsResponse } from '@/types/market';
import { 
  ValidationError, 
  AuthenticationError, 
  InternalError 
} from '@/lib/errors';

// GET /api/v1/market/trends - Get market trends analysis
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Require authentication
    const user = await requireAuth(request);

    // Parse query parameters
    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams);
    const params = marketTrendsSchema.parse(searchParams);

    // Get trends data
    const repository = new MarketRepository();
    const { trends, summary } = await repository.getTrends(params);

    // Format response
    const response: MarketTrendsResponse = {
      zipCodes: params.zipCodes.split(',').map(z => z.trim()),
      metric: params.metric,
      period: params.period,
      trends,
      summary,
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

    console.error('Market trends error:', error);
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