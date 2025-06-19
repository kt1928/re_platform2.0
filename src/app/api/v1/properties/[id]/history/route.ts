import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { PropertyRepository } from '@/lib/repositories/property-repository';
import { PropertyHistoryItem } from '@/types/property';
import { commonSchemas } from '@/lib/utils';
import { 
  ValidationError, 
  AuthenticationError, 
  NotFoundError,
  InternalError 
} from '@/lib/errors';

// GET /api/v1/properties/:id/history - Get property change history
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = crypto.randomUUID();

  try {
    // Require authentication
    const user = await requireAuth(request);

    // Validate property ID
    const { id } = commonSchemas.uuid.parse(params.id) ? params : { id: '' };
    if (!id) {
      throw new ValidationError('Invalid property ID format');
    }

    // Get property history
    const repository = new PropertyRepository();
    const history = await repository.getHistory(id);

    // Format response
    const historyItems: PropertyHistoryItem[] = history.map(item => ({
      id: item.id,
      fieldName: item.fieldName,
      oldValue: item.oldValue,
      newValue: item.newValue,
      changedAt: item.changedAt.toISOString(),
      dataSource: item.dataSource,
    }));

    return NextResponse.json({
      success: true,
      data: {
        propertyId: id,
        history: historyItems,
        total: historyItems.length,
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
          message: 'Invalid property ID',
          details: error.errors,
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: requestId,
        },
      }, { status: 400 });
    }

    if (error instanceof AuthenticationError || error instanceof NotFoundError || error instanceof ValidationError) {
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

    console.error('Property history fetch error:', error);
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