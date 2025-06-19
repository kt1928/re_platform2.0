import { prisma } from '@/lib/db';
import { Property, PropertyType, Prisma } from '@prisma/client';
import { CreatePropertyRequest, PropertySearchParams } from '@/types/property';
import { NotFoundError } from '@/lib/errors';

export class PropertyRepository {
  async findById(id: string): Promise<Property | null> {
    return prisma.property.findUnique({
      where: { id },
    });
  }

  async findByExternalId(externalId: string): Promise<Property | null> {
    return prisma.property.findFirst({
      where: { externalId },
    });
  }

  async search(params: PropertySearchParams) {
    const {
      q,
      zipCode,
      city,
      state,
      propertyType,
      minPrice,
      maxPrice,
      minBedrooms,
      maxBedrooms,
      minBathrooms,
      maxBathrooms,
      minSquareFeet,
      maxSquareFeet,
      minYearBuilt,
      maxYearBuilt,
      isActive,
      dataSource,
      limit,
      offset,
      sortBy,
      sortOrder,
    } = params;

    // Build where clause
    const where: Prisma.PropertyWhereInput = {
      ...(isActive !== undefined && { isActive }),
      ...(zipCode && { zipCode }),
      ...(city && { city: { contains: city, mode: 'insensitive' } }),
      ...(state && { state }),
      ...(propertyType && { propertyType }),
      ...(dataSource && { dataSource }),
      ...(minBedrooms !== undefined && { bedrooms: { gte: minBedrooms } }),
      ...(maxBedrooms !== undefined && { bedrooms: { lte: maxBedrooms } }),
      ...(minBathrooms !== undefined && { bathrooms: { gte: minBathrooms } }),
      ...(maxBathrooms !== undefined && { bathrooms: { lte: maxBathrooms } }),
      ...(minSquareFeet !== undefined && { squareFeet: { gte: minSquareFeet } }),
      ...(maxSquareFeet !== undefined && { squareFeet: { lte: maxSquareFeet } }),
      ...(minYearBuilt !== undefined && { yearBuilt: { gte: minYearBuilt } }),
      ...(maxYearBuilt !== undefined && { yearBuilt: { lte: maxYearBuilt } }),
    };

    // Add price filter (check both list and sold price)
    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceFilter: Prisma.DecimalFilter = {};
      if (minPrice !== undefined) priceFilter.gte = minPrice;
      if (maxPrice !== undefined) priceFilter.lte = maxPrice;
      
      where.OR = [
        { listPrice: priceFilter },
        { soldPrice: priceFilter },
      ];
    }

    // Add full-text search
    if (q) {
      where.AND = [
        {
          OR: [
            { addressLine1: { contains: q, mode: 'insensitive' } },
            { city: { contains: q, mode: 'insensitive' } },
            { state: { contains: q, mode: 'insensitive' } },
            { zipCode: { contains: q, mode: 'insensitive' } },
          ],
        },
      ];
    }

    // Build order by
    const orderBy: Prisma.PropertyOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
      }),
      prisma.property.count({ where }),
    ]);

    return {
      properties,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async create(data: CreatePropertyRequest): Promise<Property> {
    return prisma.property.create({
      data: {
        ...data,
        // Convert numbers to Decimal type for Prisma
        listPrice: data.listPrice ? new Prisma.Decimal(data.listPrice) : null,
        soldPrice: data.soldPrice ? new Prisma.Decimal(data.soldPrice) : null,
        rentEstimate: data.rentEstimate ? new Prisma.Decimal(data.rentEstimate) : null,
        taxAssessedValue: data.taxAssessedValue ? new Prisma.Decimal(data.taxAssessedValue) : null,
        latitude: data.latitude ? new Prisma.Decimal(data.latitude) : null,
        longitude: data.longitude ? new Prisma.Decimal(data.longitude) : null,
        bathrooms: data.bathrooms ? new Prisma.Decimal(data.bathrooms) : null,
      },
    });
  }

  async update(id: string, data: Partial<CreatePropertyRequest>): Promise<Property> {
    const property = await this.findById(id);
    if (!property) {
      throw new NotFoundError('Property');
    }

    return prisma.property.update({
      where: { id },
      data: {
        ...data,
        // Convert numbers to Decimal type for Prisma
        ...(data.listPrice !== undefined && {
          listPrice: data.listPrice ? new Prisma.Decimal(data.listPrice) : null,
        }),
        ...(data.soldPrice !== undefined && {
          soldPrice: data.soldPrice ? new Prisma.Decimal(data.soldPrice) : null,
        }),
        ...(data.rentEstimate !== undefined && {
          rentEstimate: data.rentEstimate ? new Prisma.Decimal(data.rentEstimate) : null,
        }),
        ...(data.taxAssessedValue !== undefined && {
          taxAssessedValue: data.taxAssessedValue ? new Prisma.Decimal(data.taxAssessedValue) : null,
        }),
        ...(data.latitude !== undefined && {
          latitude: data.latitude ? new Prisma.Decimal(data.latitude) : null,
        }),
        ...(data.longitude !== undefined && {
          longitude: data.longitude ? new Prisma.Decimal(data.longitude) : null,
        }),
        ...(data.bathrooms !== undefined && {
          bathrooms: data.bathrooms ? new Prisma.Decimal(data.bathrooms) : null,
        }),
        updatedAt: new Date(),
      },
    });
  }

  async softDelete(id: string): Promise<Property> {
    const property = await this.findById(id);
    if (!property) {
      throw new NotFoundError('Property');
    }

    return prisma.property.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });
  }

  async getHistory(propertyId: string) {
    const property = await this.findById(propertyId);
    if (!property) {
      throw new NotFoundError('Property');
    }

    return prisma.propertyHistory.findMany({
      where: { propertyId },
      orderBy: { changedAt: 'desc' },
    });
  }

  async addHistoryEntry(
    propertyId: string,
    fieldName: string,
    oldValue: string | null,
    newValue: string | null,
    dataSource?: string
  ) {
    return prisma.propertyHistory.create({
      data: {
        propertyId,
        fieldName,
        oldValue,
        newValue,
        dataSource,
      },
    });
  }

  async getStats() {
    const [
      total,
      active,
      byType,
      avgListPrice,
      avgSquareFeet,
    ] = await Promise.all([
      prisma.property.count(),
      prisma.property.count({ where: { isActive: true } }),
      prisma.property.groupBy({
        by: ['propertyType'],
        _count: { propertyType: true },
      }),
      prisma.property.aggregate({
        _avg: { listPrice: true },
        where: { listPrice: { not: null }, isActive: true },
      }),
      prisma.property.aggregate({
        _avg: { squareFeet: true },
        where: { squareFeet: { not: null }, isActive: true },
      }),
    ]);

    const typeStats = byType.reduce((acc, stat) => {
      acc[stat.propertyType] = stat._count.propertyType;
      return acc;
    }, {} as Record<PropertyType, number>);

    return {
      total,
      active,
      byType: typeStats,
      avgListPrice: avgListPrice._avg.listPrice ? Number(avgListPrice._avg.listPrice) : null,
      avgSquareFeet: avgSquareFeet._avg.squareFeet || null,
    };
  }

  async findNearby(latitude: number, longitude: number, radiusMiles = 1.0, limit = 10) {
    // Simple bounding box calculation (not precise but fast)
    const latRange = radiusMiles / 69.0; // ~69 miles per degree latitude
    const lonRange = radiusMiles / (69.0 * Math.cos((latitude * Math.PI) / 180));

    return prisma.property.findMany({
      where: {
        isActive: true,
        latitude: {
          gte: latitude - latRange,
          lte: latitude + latRange,
        },
        longitude: {
          gte: longitude - lonRange,
          lte: longitude + lonRange,
        },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }
}