import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { PortfolioRepository } from '@/lib/repositories/portfolio-repository';
import { PortfolioPerformanceResponse } from '@/types/portfolio';
import { commonSchemas } from '@/lib/utils';
import { 
  ValidationError, 
  AuthenticationError, 
  NotFoundError,
  InternalError 
} from '@/lib/errors';

// GET /api/v1/portfolios/:id/performance - Get portfolio performance metrics
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = crypto.randomUUID();

  try {
    // Require authentication
    const user = await requireAuth(request);

    // Validate portfolio ID
    const { id } = commonSchemas.uuid.parse(params.id) ? params : { id: '' };
    if (!id) {
      throw new ValidationError('Invalid portfolio ID format');
    }

    // Get portfolio performance
    const repository = new PortfolioRepository();
    const performanceData = await repository.getPerformance(id, user.id);

    // Format response
    const response: PortfolioPerformanceResponse = {
      portfolioId: performanceData.portfolio.id,
      portfolioName: performanceData.portfolio.name,
      propertyCount: performanceData.metrics.propertyCount,
      totalInvested: performanceData.metrics.totalInvested,
      totalValue: performanceData.metrics.totalValue,
      totalMonthlyRent: performanceData.metrics.totalMonthlyRent,
      avgReturn: performanceData.metrics.avgReturn,
      unrealizedGain: performanceData.metrics.unrealizedGain,
      metrics: {
        totalReturn: performanceData.metrics.totalReturn,
        returnPercentage: performanceData.metrics.returnPercentage,
        annualizedReturn: performanceData.metrics.annualizedReturn,
        monthlyIncome: performanceData.metrics.monthlyIncome,
        occupancyRate: performanceData.metrics.occupancyRate,
      },
      properties: performanceData.properties,
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
          message: error instanceof ValidationError ? error.message : 'Invalid portfolio ID',
          details: error instanceof z.ZodError ? error.errors : undefined,
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: requestId,
        },
      }, { status: 400 });
    }

    if (error instanceof AuthenticationError || error instanceof NotFoundError) {
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

    console.error('Portfolio performance fetch error:', error);
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