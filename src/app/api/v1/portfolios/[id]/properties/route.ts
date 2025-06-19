import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { PortfolioRepository } from '@/lib/repositories/portfolio-repository';
import { 
  addPropertyToPortfolioSchema, 
  PortfolioPropertyResponse 
} from '@/types/portfolio';
import { commonSchemas } from '@/lib/utils';
import { 
  ValidationError, 
  AuthenticationError, 
  NotFoundError,
  InternalError 
} from '@/lib/errors';

// GET /api/v1/portfolios/:id/properties - List properties in portfolio
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

    // Get portfolio properties
    const repository = new PortfolioRepository();
    const properties = await repository.getProperties(id, user.id);

    // Format response
    const response: PortfolioPropertyResponse[] = properties.map(pp => ({
      id: pp.id,
      portfolioId: pp.portfolioId,
      property: {
        id: pp.property.id,
        addressLine1: pp.property.addressLine1,
        city: pp.property.city,
        state: pp.property.state,
        zipCode: pp.property.zipCode,
        propertyType: pp.property.propertyType,
      },
      purchaseDate: pp.purchaseDate.toISOString(),
      purchasePrice: Number(pp.purchasePrice),
      downPayment: pp.downPayment ? Number(pp.downPayment) : null,
      loanAmount: pp.loanAmount ? Number(pp.loanAmount) : null,
      interestRate: pp.interestRate ? Number(pp.interestRate) : null,
      currentValue: pp.currentValue ? Number(pp.currentValue) : null,
      monthlyRent: pp.monthlyRent ? Number(pp.monthlyRent) : null,
      occupancyStatus: pp.occupancyStatus,
      totalReturn: pp.totalReturn ? Number(pp.totalReturn) : null,
      annualizedReturn: pp.annualizedReturn ? Number(pp.annualizedReturn) : null,
      cashOnCashReturn: pp.cashOnCashReturn ? Number(pp.cashOnCashReturn) : null,
      createdAt: pp.createdAt.toISOString(),
      updatedAt: pp.updatedAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        portfolioId: id,
        properties: response,
        total: response.length,
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
          message: error instanceof ValidationError ? error.message : 'Invalid request',
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

    console.error('Portfolio properties fetch error:', error);
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

// POST /api/v1/portfolios/:id/properties - Add property to portfolio
export async function POST(
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

    // Parse and validate request body
    const body = await request.json();
    const data = addPropertyToPortfolioSchema.parse(body);

    // Add property to portfolio
    const repository = new PortfolioRepository();
    const portfolioProperty = await repository.addProperty(id, user.id, data);

    // Calculate returns
    await repository.calculateReturns(portfolioProperty);

    // Format response
    const response: PortfolioPropertyResponse = {
      id: portfolioProperty.id,
      portfolioId: portfolioProperty.portfolioId,
      property: {
        id: portfolioProperty.property.id,
        addressLine1: portfolioProperty.property.addressLine1,
        city: portfolioProperty.property.city,
        state: portfolioProperty.property.state,
        zipCode: portfolioProperty.property.zipCode,
        propertyType: portfolioProperty.property.propertyType,
      },
      purchaseDate: portfolioProperty.purchaseDate.toISOString(),
      purchasePrice: Number(portfolioProperty.purchasePrice),
      downPayment: portfolioProperty.downPayment ? Number(portfolioProperty.downPayment) : null,
      loanAmount: portfolioProperty.loanAmount ? Number(portfolioProperty.loanAmount) : null,
      interestRate: portfolioProperty.interestRate ? Number(portfolioProperty.interestRate) : null,
      currentValue: portfolioProperty.currentValue ? Number(portfolioProperty.currentValue) : null,
      monthlyRent: portfolioProperty.monthlyRent ? Number(portfolioProperty.monthlyRent) : null,
      occupancyStatus: portfolioProperty.occupancyStatus,
      totalReturn: portfolioProperty.totalReturn ? Number(portfolioProperty.totalReturn) : null,
      annualizedReturn: portfolioProperty.annualizedReturn ? Number(portfolioProperty.annualizedReturn) : null,
      cashOnCashReturn: portfolioProperty.cashOnCashReturn ? Number(portfolioProperty.cashOnCashReturn) : null,
      createdAt: portfolioProperty.createdAt.toISOString(),
      updatedAt: portfolioProperty.updatedAt.toISOString(),
    };

    console.log(`Property added to portfolio by ${user.email}: ${portfolioProperty.property.addressLine1} to portfolio ${id}`);

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
          message: error instanceof ValidationError ? error.message : 'Invalid property data',
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

    if (error instanceof Error && error.message === 'Property already in portfolio') {
      return NextResponse.json({
        success: false,
        error: {
          code: 'CONFLICT',
          message: error.message,
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: requestId,
        },
      }, { status: 409 });
    }

    console.error('Add property to portfolio error:', error);
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