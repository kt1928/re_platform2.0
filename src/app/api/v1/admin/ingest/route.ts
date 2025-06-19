import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { handleApiError } from '@/lib/errors';
import { DataIngestionService } from '@/lib/services/data-ingestion-service';
import { z } from 'zod';

const mockIngestionSchema = z.object({
  source: z.literal('mock'),
  params: z.object({
    count: z.number().min(1).max(100)
  })
});

const zillowIngestionSchema = z.object({
  source: z.literal('zillow'),
  params: z.object({
    zipCode: z.string().length(5),
    limit: z.number().min(1).max(50)
  })
});

const ingestionSchema = z.discriminatedUnion('source', [
  mockIngestionSchema,
  zillowIngestionSchema
]);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Admin access required' }
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = ingestionSchema.parse(body);

    const ingestionService = new DataIngestionService();
    const results = await ingestionService.ingestFromSource(
      validatedData.source,
      validatedData.params,
      payload.userId
    );

    return NextResponse.json({
      success: true,
      data: results,
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1',
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: error.errors
          }
        },
        { status: 400 }
      );
    }
    return handleApiError(error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'Authentication required' }
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INSUFFICIENT_PERMISSIONS', message: 'Admin access required' }
        },
        { status: 403 }
      );
    }

    const ingestionService = new DataIngestionService();
    const sources = ingestionService.getAvailableDataSources();

    return NextResponse.json({
      success: true,
      data: {
        sources,
        examples: {
          mock: {
            source: 'mock',
            params: { count: 10 }
          },
          zillow: {
            source: 'zillow',
            params: { zipCode: '10001', limit: 20 }
          }
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: 'v1',
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}