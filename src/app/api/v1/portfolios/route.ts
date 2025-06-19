import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { PortfolioRepository } from '@/lib/repositories/portfolio-repository';
import { 
  portfolioSearchSchema, 
  createPortfolioSchema, 
  PortfolioResponse 
} from '@/types/portfolio';
import { 
  ValidationError, 
  AuthenticationError, 
  InternalError 
} from '@/lib/errors';

// GET /api/v1/portfolios - List user's portfolios
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Require authentication
    const user = await requireAuth(request);

    // Parse and validate query parameters
    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams);
    const params = portfolioSearchSchema.parse(searchParams);

    // Get user's portfolios
    const repository = new PortfolioRepository();
    const results = await repository.findByUser(user.id, params);

    // Format response
    const portfolios: PortfolioResponse[] = results.portfolios.map(portfolio => ({
      id: portfolio.id,
      userId: portfolio.userId,
      name: portfolio.name,
      description: portfolio.description,
      targetReturn: portfolio.targetReturn ? Number(portfolio.targetReturn) : null,
      riskTolerance: portfolio.riskTolerance,
      createdAt: portfolio.createdAt.toISOString(),
      updatedAt: portfolio.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        portfolios,
        total: results.total,
        limit: results.limit,
        offset: results.offset,
        hasMore: results.hasMore,
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: process.env.API_VERSION || '1.0',
        request_id: requestId,
      },
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid search parameters',
          details: error.errors,
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

    console.error('Portfolio list error:', error);
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

// POST /api/v1/portfolios - Create new portfolio
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Require authentication
    const user = await requireAuth(request);

    // Parse and validate request body
    const body = await request.json();
    const data = createPortfolioSchema.parse(body);

    // Create portfolio
    const repository = new PortfolioRepository();
    const portfolio = await repository.create(user.id, data);

    // Format response
    const response: PortfolioResponse = {
      id: portfolio.id,
      userId: portfolio.userId,
      name: portfolio.name,
      description: portfolio.description,
      targetReturn: portfolio.targetReturn ? Number(portfolio.targetReturn) : null,
      riskTolerance: portfolio.riskTolerance,
      createdAt: portfolio.createdAt.toISOString(),
      updatedAt: portfolio.updatedAt.toISOString(),
    };

    console.log(`Portfolio created by ${user.email}: ${portfolio.name} (${portfolio.id})`);

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
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid portfolio data',
          details: error.errors,
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

    console.error('Portfolio creation error:', error);
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