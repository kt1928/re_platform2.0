import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/jwt';
import { prisma } from '@/lib/db';
import { NYCDatasetDiscoveryService } from '@/lib/services/nyc-dataset-discovery-service';

export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    
    if (!payload) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Invalid token' } },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const datasetId = searchParams.get('id');

    if (datasetId) {
      // Get specific dataset configuration
      const config = await prisma.datasetConfiguration.findUnique({
        where: { datasetId },
        include: {
          fieldSchemas: true,
          dataFreshness: true
        }
      });

      if (!config) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Dataset configuration not found' } },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { configuration: config }
      });
    } else {
      // Get all dataset configurations
      const configs = await prisma.datasetConfiguration.findMany({
        include: {
          dataFreshness: {
            select: {
              freshnessScore: true,
              isStale: true,
              recommendSync: true,
              ourRecordCount: true,
              lastChecked: true
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { datasetName: 'asc' }
        ]
      });

      const summary = {
        total: configs.length,
        active: configs.filter(c => c.isActive).length,
        builtIn: configs.filter(c => c.isBuiltIn).length,
        custom: configs.filter(c => !c.isBuiltIn).length,
        syncEnabled: configs.filter(c => c.syncEnabled).length
      };

      return NextResponse.json({
        success: true,
        data: {
          configurations: configs,
          summary
        }
      });
    }

  } catch (error) {
    console.error('Dataset configuration fetch error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error instanceof Error ? error.message : 'Internal server error' 
        } 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication (admin only for adding datasets)
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, datasetId, configuration } = body;

    const discoveryService = new NYCDatasetDiscoveryService();

    switch (action) {
      case 'add': {
        // Add a new dataset configuration
        if (!datasetId) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Dataset ID is required' } },
            { status: 400 }
          );
        }

        // Check if dataset already exists
        const existing = await prisma.datasetConfiguration.findUnique({
          where: { datasetId }
        });

        if (existing) {
          return NextResponse.json(
            { success: false, error: { code: 'CONFLICT', message: 'Dataset already configured' } },
            { status: 409 }
          );
        }

        // Get dataset details from discovery service
        const dataset = await discoveryService.getDatasetDetails(datasetId);
        if (!dataset) {
          return NextResponse.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Dataset not found in NYC Open Data' } },
            { status: 404 }
          );
        }

        // Add dataset with provided configuration options
        const configId = await discoveryService.addDatasetConfiguration(
          dataset,
          payload.email,
          {
            priority: configuration?.priority,
            autoSync: configuration?.autoSync,
            tableName: configuration?.tableName,
            primaryKeyFields: configuration?.primaryKeyFields,
            dateField: configuration?.dateField
          }
        );

        // Get the created configuration
        const newConfig = await prisma.datasetConfiguration.findUnique({
          where: { id: configId },
          include: {
            fieldSchemas: true,
            dataFreshness: true
          }
        });

        return NextResponse.json({
          success: true,
          data: {
            configuration: newConfig,
            message: `Dataset "${dataset.name}" added successfully`
          }
        });
      }

      case 'update': {
        // Update existing dataset configuration
        if (!datasetId) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Dataset ID is required' } },
            { status: 400 }
          );
        }

        const updatedConfig = await prisma.datasetConfiguration.update({
          where: { datasetId },
          data: {
            ...configuration,
            lastConfigUpdate: new Date(),
            updatedAt: new Date()
          },
          include: {
            fieldSchemas: true,
            dataFreshness: true
          }
        });

        return NextResponse.json({
          success: true,
          data: {
            configuration: updatedConfig,
            message: 'Dataset configuration updated successfully'
          }
        });
      }

      case 'remove': {
        // Remove dataset configuration (soft delete by deactivating)
        if (!datasetId) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'Dataset ID is required' } },
            { status: 400 }
          );
        }

        // Check if it's a built-in dataset
        const existing = await prisma.datasetConfiguration.findUnique({
          where: { datasetId }
        });

        if (!existing) {
          return NextResponse.json(
            { success: false, error: { code: 'NOT_FOUND', message: 'Dataset configuration not found' } },
            { status: 404 }
          );
        }

        if (existing.isBuiltIn) {
          return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: 'Cannot remove built-in datasets' } },
            { status: 403 }
          );
        }

        // Soft delete: deactivate instead of removing
        await prisma.datasetConfiguration.update({
          where: { datasetId },
          data: {
            isActive: false,
            syncEnabled: false,
            updatedAt: new Date()
          }
        });

        // Also deactivate freshness monitoring
        await prisma.nYCDataFreshness.updateMany({
          where: { datasetId },
          data: {
            isStale: true,
            recommendSync: false,
            updatedAt: new Date()
          }
        });

        return NextResponse.json({
          success: true,
          data: {
            message: 'Dataset configuration deactivated successfully'
          }
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: `Unknown action: ${action}` } },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Dataset configuration error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_ERROR', 
          message: error instanceof Error ? error.message : 'Internal server error' 
        } 
      },
      { status: 500 }
    );
  }
}