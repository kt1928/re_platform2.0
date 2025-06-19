import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { PortfolioRepository } from '@/lib/repositories/portfolio-repository';
import { updatePortfolioSchema, PortfolioResponse } from '@/types/portfolio';
import { commonSchemas } from '@/lib/utils';
import { 
  ValidationError, 
  AuthenticationError, 
  NotFoundError,
  InternalError 
} from '@/lib/errors';

// GET /api/v1/portfolios/:id - Get single portfolio
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

    // Find portfolio (user can only access their own)
    const repository = new PortfolioRepository();
    const portfolio = await repository.findById(id, user.id);

    if (!portfolio) {
      throw new NotFoundError('Portfolio');
    }

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

    console.error('Portfolio fetch error:', error);
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

// PATCH /api/v1/portfolios/:id - Update portfolio
export async function PATCH(
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
    const updateData = updatePortfolioSchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No update data provided');
    }

    // Update portfolio
    const repository = new PortfolioRepository();
    const portfolio = await repository.update(id, user.id, updateData);

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

    console.log(`Portfolio updated by ${user.email}: ${portfolio.name} (${portfolio.id})`);

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

    console.error('Portfolio update error:', error);
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

// DELETE /api/v1/portfolios/:id - Delete portfolio
export async function DELETE(
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

    // Delete portfolio
    const repository = new PortfolioRepository();
    await repository.delete(id, user.id);

    console.log(`Portfolio deleted by ${user.email}: ${id}`);

    return NextResponse.json({
      success: true,
      data: {
        id,
        message: 'Portfolio deleted successfully',
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

    console.error('Portfolio deletion error:', error);
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