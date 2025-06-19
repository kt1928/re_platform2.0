import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { PropertyRepository } from '@/lib/repositories/property-repository';
import { updatePropertySchema, PropertyResponse } from '@/types/property';
import { commonSchemas } from '@/lib/utils';
import { 
  ValidationError, 
  AuthenticationError, 
  NotFoundError,
  InternalError 
} from '@/lib/errors';

// GET /api/v1/properties/:id - Get single property
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    // Require authentication
    const user = await requireAuth(request);

    // Resolve params and validate property ID
    const resolvedParams = await params;
    const { id } = commonSchemas.uuid.parse(resolvedParams.id) ? resolvedParams : { id: '' };
    if (!id) {
      throw new ValidationError('Invalid property ID format');
    }

    // Find property
    const repository = new PropertyRepository();
    const property = await repository.findById(id);

    if (!property) {
      throw new NotFoundError('Property');
    }

    // Format response
    const response: PropertyResponse = {
      id: property.id,
      externalId: property.externalId,
      addressLine1: property.addressLine1,
      addressLine2: property.addressLine2,
      city: property.city,
      state: property.state,
      zipCode: property.zipCode,
      latitude: property.latitude ? Number(property.latitude) : null,
      longitude: property.longitude ? Number(property.longitude) : null,
      propertyType: property.propertyType,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms ? Number(property.bathrooms) : null,
      squareFeet: property.squareFeet,
      lotSize: property.lotSize,
      yearBuilt: property.yearBuilt,
      listPrice: property.listPrice ? Number(property.listPrice) : null,
      soldPrice: property.soldPrice ? Number(property.soldPrice) : null,
      rentEstimate: property.rentEstimate ? Number(property.rentEstimate) : null,
      taxAssessedValue: property.taxAssessedValue ? Number(property.taxAssessedValue) : null,
      dataSource: property.dataSource,
      isActive: property.isActive,
      createdAt: property.createdAt.toISOString(),
      updatedAt: property.updatedAt.toISOString(),
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

    console.error('Property fetch error:', error);
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

// PATCH /api/v1/properties/:id - Update property
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    // Require authentication
    const user = await requireAuth(request);

    // Resolve params and validate property ID
    const resolvedParams = await params;
    const { id } = commonSchemas.uuid.parse(resolvedParams.id) ? resolvedParams : { id: '' };
    if (!id) {
      throw new ValidationError('Invalid property ID format');
    }

    // Parse and validate request body
    const body = await request.json();
    const updateData = updatePropertySchema.parse(body);

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No update data provided');
    }

    // Get current property for change tracking
    const repository = new PropertyRepository();
    const currentProperty = await repository.findById(id);
    if (!currentProperty) {
      throw new NotFoundError('Property');
    }

    // Update property
    const property = await repository.update(id, updateData);

    // Track changes in property history
    for (const [field, newValue] of Object.entries(updateData)) {
      if (newValue !== undefined) {
        const oldValue = String(currentProperty[field as keyof typeof currentProperty] || '');
        const newValueStr = String(newValue);
        
        if (oldValue !== newValueStr) {
          await repository.addHistoryEntry(
            id,
            field,
            oldValue || null,
            newValueStr,
            updateData.dataSource || 'api_update'
          );
        }
      }
    }

    // Format response
    const response: PropertyResponse = {
      id: property.id,
      externalId: property.externalId,
      addressLine1: property.addressLine1,
      addressLine2: property.addressLine2,
      city: property.city,
      state: property.state,
      zipCode: property.zipCode,
      latitude: property.latitude ? Number(property.latitude) : null,
      longitude: property.longitude ? Number(property.longitude) : null,
      propertyType: property.propertyType,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms ? Number(property.bathrooms) : null,
      squareFeet: property.squareFeet,
      lotSize: property.lotSize,
      yearBuilt: property.yearBuilt,
      listPrice: property.listPrice ? Number(property.listPrice) : null,
      soldPrice: property.soldPrice ? Number(property.soldPrice) : null,
      rentEstimate: property.rentEstimate ? Number(property.rentEstimate) : null,
      taxAssessedValue: property.taxAssessedValue ? Number(property.taxAssessedValue) : null,
      dataSource: property.dataSource,
      isActive: property.isActive,
      createdAt: property.createdAt.toISOString(),
      updatedAt: property.updatedAt.toISOString(),
    };

    console.log(`Property updated by ${user.email}: ${property.addressLine1}, ${property.city} (${property.id})`);

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
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid update data',
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

    console.error('Property update error:', error);
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

// DELETE /api/v1/properties/:id - Soft delete property
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = crypto.randomUUID();

  try {
    // Require authentication
    const user = await requireAuth(request);

    // Resolve params and validate property ID
    const resolvedParams = await params;
    const { id } = commonSchemas.uuid.parse(resolvedParams.id) ? resolvedParams : { id: '' };
    if (!id) {
      throw new ValidationError('Invalid property ID format');
    }

    // Soft delete property
    const repository = new PropertyRepository();
    const property = await repository.softDelete(id);

    console.log(`Property soft deleted by ${user.email}: ${property.addressLine1}, ${property.city} (${property.id})`);

    return NextResponse.json({
      success: true,
      data: {
        id: property.id,
        isActive: property.isActive,
        message: 'Property deactivated successfully',
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

    console.error('Property deletion error:', error);
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