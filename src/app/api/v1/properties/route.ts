import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { PropertyRepository } from '@/lib/repositories/property-repository';
import { propertySearchSchema, createPropertySchema, PropertyResponse } from '@/types/property';
import { 
  ValidationError, 
  AuthenticationError, 
  InternalError 
} from '@/lib/errors';

// GET /api/v1/properties - Search properties
export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Require authentication
    const user = await requireAuth(request);

    // Parse and validate query parameters
    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams);
    const params = propertySearchSchema.parse(searchParams);

    // Search properties
    const repository = new PropertyRepository();
    const results = await repository.search(params);

    // Format response
    const properties: PropertyResponse[] = results.properties.map(property => ({
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
    }));

    return NextResponse.json({
      success: true,
      data: {
        properties,
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

    console.error('Property search error:', error);
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

// POST /api/v1/properties - Create property
export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Require authentication
    const user = await requireAuth(request);

    // Parse and validate request body
    const body = await request.json();
    const data = createPropertySchema.parse(body);

    // Create property
    const repository = new PropertyRepository();
    const property = await repository.create(data);

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

    console.log(`Property created by ${user.email}: ${property.addressLine1}, ${property.city} (${property.id})`);

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
          message: 'Invalid property data',
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

    console.error('Property creation error:', error);
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