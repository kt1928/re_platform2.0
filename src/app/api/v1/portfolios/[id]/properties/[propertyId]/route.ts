import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { PortfolioRepository } from '@/lib/repositories/portfolio-repository';
import { 
  updatePortfolioPropertySchema, 
  PortfolioPropertyResponse 
} from '@/types/portfolio';
import { commonSchemas } from '@/lib/utils';
import { 
  ValidationError, 
  AuthenticationError, 
  NotFoundError,
  InternalError 
} from '@/lib/errors';

// PATCH /api/v1/portfolios/:id/properties/:propertyId - Update property in portfolio
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; propertyId: string } }
) {
  const requestId = crypto.randomUUID();

  try {
    // Require authentication
    const user = await requireAuth(request);

    // Validate IDs
    const portfolioId = commonSchemas.uuid.parse(params.id) ? params.id : '';
    const propertyId = commonSchemas.uuid.parse(params.propertyId) ? params.propertyId : '';
    
    if (!portfolioId || !propertyId) {
      throw new ValidationError('Invalid portfolio or property ID format');
    }

    // Parse and validate request body
    const body = await request.json();
    const updateData = updatePortfolioPropertySchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No update data provided');
    }

    // Update property in portfolio
    const repository = new PortfolioRepository();
    const portfolioProperty = await repository.updateProperty(
      portfolioId,
      propertyId,
      user.id,
      updateData
    );

    // Recalculate returns
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

    console.log(`Portfolio property updated by ${user.email}: property ${propertyId} in portfolio ${portfolioId}`);

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
          message: error instanceof ValidationError ? error.message : 'Invalid update data',
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

    console.error('Portfolio property update error:', error);
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

// DELETE /api/v1/portfolios/:id/properties/:propertyId - Remove property from portfolio
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; propertyId: string } }
) {
  const requestId = crypto.randomUUID();

  try {
    // Require authentication
    const user = await requireAuth(request);

    // Validate IDs
    const portfolioId = commonSchemas.uuid.parse(params.id) ? params.id : '';
    const propertyId = commonSchemas.uuid.parse(params.propertyId) ? params.propertyId : '';
    
    if (!portfolioId || !propertyId) {
      throw new ValidationError('Invalid portfolio or property ID format');
    }

    // Remove property from portfolio
    const repository = new PortfolioRepository();
    await repository.removeProperty(portfolioId, propertyId, user.id);

    console.log(`Property removed from portfolio by ${user.email}: property ${propertyId} from portfolio ${portfolioId}`);

    return NextResponse.json({
      success: true,
      data: {
        portfolioId,
        propertyId,
        message: 'Property removed from portfolio successfully',
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
          message: error instanceof ValidationError ? error.message : 'Invalid IDs',
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

    console.error('Portfolio property removal error:', error);
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