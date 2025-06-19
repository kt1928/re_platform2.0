import { prisma } from '@/lib/db';
import { MarketMetric, Prisma } from '@prisma/client';
import { 
  CreateMarketMetricRequest, 
  MarketMetricsSearchParams,
  MarketTrendsParams 
} from '@/types/market';
import { NotFoundError } from '@/lib/errors';

export class MarketRepository {
  async findByZipAndDate(zipCode: string, metricDate: Date): Promise<MarketMetric | null> {
    return prisma.marketMetric.findUnique({
      where: {
        zipCode_metricDate: {
          zipCode,
          metricDate,
        },
      },
    });
  }

  async upsert(data: CreateMarketMetricRequest): Promise<MarketMetric> {
    return prisma.marketMetric.upsert({
      where: {
        zipCode_metricDate: {
          zipCode: data.zipCode,
          metricDate: data.metricDate,
        },
      },
      update: {
        ...this.convertToDecimal(data),
        createdAt: new Date(),
      },
      create: {
        zipCode: data.zipCode,
        metricDate: data.metricDate,
        ...this.convertToDecimal(data),
      },
    });
  }

  async findMetrics(params: MarketMetricsSearchParams) {
    const { zipCode, zipCodes, startDate, endDate, limit, interval } = params;

    // Build where clause
    const where: Prisma.MarketMetricWhereInput = {};

    // Handle single or multiple ZIP codes
    if (zipCode) {
      where.zipCode = zipCode;
    } else if (zipCodes) {
      const zipList = zipCodes.split(',').map(z => z.trim());
      where.zipCode = { in: zipList };
    }

    // Date range filter
    if (startDate || endDate) {
      where.metricDate = {
        ...(startDate && { gte: startDate }),
        ...(endDate && { lte: endDate }),
      };
    }

    // Fetch metrics
    const metrics = await prisma.marketMetric.findMany({
      where,
      orderBy: [
        { zipCode: 'asc' },
        { metricDate: 'desc' },
      ],
      take: limit,
    });

    // Group by interval if needed
    if (interval !== 'daily') {
      return this.aggregateByInterval(metrics, interval);
    }

    return metrics;
  }

  async getTrends(params: MarketTrendsParams) {
    const { zipCodes, metric, period } = params;
    const zipList = zipCodes.split(',').map(z => z.trim());

    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();
    switch (period) {
      case '1m':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '3m':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case '6m':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case '5y':
        startDate.setFullYear(startDate.getFullYear() - 5);
        break;
    }

    // Fetch metrics for all ZIP codes
    const metrics = await prisma.marketMetric.findMany({
      where: {
        zipCode: { in: zipList },
        metricDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: [
        { zipCode: 'asc' },
        { metricDate: 'asc' },
      ],
    });

    // Group and analyze by ZIP code
    const trends: Record<string, any[]> = {};
    const summary: Record<string, any> = {};

    for (const zip of zipList) {
      const zipMetrics = metrics.filter(m => m.zipCode === zip);
      
      // Extract trend data
      trends[zip] = zipMetrics.map(m => ({
        date: m.metricDate.toISOString(),
        value: m[metric as keyof MarketMetric] ? Number(m[metric as keyof MarketMetric]) : null,
      }));

      // Calculate summary statistics
      const values = zipMetrics
        .map(m => m[metric as keyof MarketMetric] ? Number(m[metric as keyof MarketMetric]) : null)
        .filter(v => v !== null) as number[];

      if (values.length > 0) {
        const current = values[values.length - 1];
        const previous = values[0];
        const change = current - previous;
        const changePercent = previous !== 0 ? (change / previous) * 100 : null;

        summary[zip] = {
          current,
          change,
          changePercent,
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
        };
      } else {
        summary[zip] = {
          current: null,
          change: null,
          changePercent: null,
          min: null,
          max: null,
          avg: null,
        };
      }
    }

    return {
      trends,
      summary,
    };
  }

  async compareMarkets(zipCodes: string[], metrics: string[], startDate: Date, endDate: Date) {
    // Fetch metrics for all ZIP codes
    const marketMetrics = await prisma.marketMetric.findMany({
      where: {
        zipCode: { in: zipCodes },
        metricDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: [
        { zipCode: 'asc' },
        { metricDate: 'desc' },
      ],
    });

    // Analyze data for each ZIP code and metric
    const data: Record<string, Record<string, any>> = {};
    const rankings: Record<string, Array<any>> = {};

    // Initialize rankings
    for (const metric of metrics) {
      rankings[metric] = [];
    }

    for (const zipCode of zipCodes) {
      data[zipCode] = {};
      const zipMetrics = marketMetrics.filter(m => m.zipCode === zipCode);

      for (const metric of metrics) {
        const values = zipMetrics
          .map(m => m[metric as keyof MarketMetric] ? Number(m[metric as keyof MarketMetric]) : null)
          .filter(v => v !== null) as number[];

        if (values.length > 0) {
          const current = values[0]; // Most recent
          const previous = values[values.length - 1]; // Oldest in range
          const change = current - previous;
          const changePercent = previous !== 0 ? (change / previous) * 100 : null;
          const avg = values.reduce((a, b) => a + b, 0) / values.length;

          data[zipCode][metric] = {
            current,
            previous,
            change,
            changePercent,
            avg,
          };

          rankings[metric].push({
            zipCode,
            value: current,
            rank: 0, // Will be calculated after sorting
          });
        } else {
          data[zipCode][metric] = {
            current: null,
            previous: null,
            change: null,
            changePercent: null,
            avg: null,
          };
        }
      }
    }

    // Calculate rankings
    for (const metric of metrics) {
      // Sort by value (descending for most metrics, ascending for days on market)
      const ascending = metric === 'daysOnMarket';
      rankings[metric].sort((a, b) => {
        if (a.value === null) return 1;
        if (b.value === null) return -1;
        return ascending ? a.value - b.value : b.value - a.value;
      });

      // Assign ranks
      rankings[metric].forEach((item, index) => {
        item.rank = index + 1;
      });
    }

    return {
      data,
      rankings,
    };
  }

  async getStats(zipCode?: string) {
    const where = zipCode ? { zipCode } : {};

    const [
      totalRecords,
      uniqueZipCodes,
      latestDate,
      avgMedianPrice,
    ] = await Promise.all([
      prisma.marketMetric.count({ where }),
      prisma.marketMetric.findMany({
        where,
        select: { zipCode: true },
        distinct: ['zipCode'],
      }),
      prisma.marketMetric.findFirst({
        where,
        orderBy: { metricDate: 'desc' },
        select: { metricDate: true },
      }),
      prisma.marketMetric.aggregate({
        where: {
          ...where,
          medianSalePrice: { not: null },
        },
        _avg: { medianSalePrice: true },
      }),
    ]);

    return {
      totalRecords,
      uniqueZipCodes: uniqueZipCodes.length,
      latestDate: latestDate?.metricDate || null,
      avgMedianPrice: avgMedianPrice._avg.medianSalePrice ? Number(avgMedianPrice._avg.medianSalePrice) : null,
    };
  }

  private convertToDecimal(data: Partial<CreateMarketMetricRequest>) {
    return {
      ...(data.medianSalePrice !== undefined && {
        medianSalePrice: data.medianSalePrice ? new Prisma.Decimal(data.medianSalePrice) : null,
      }),
      ...(data.medianRent !== undefined && {
        medianRent: data.medianRent ? new Prisma.Decimal(data.medianRent) : null,
      }),
      ...(data.pricePerSqft !== undefined && {
        pricePerSqft: data.pricePerSqft ? new Prisma.Decimal(data.pricePerSqft) : null,
      }),
      ...(data.monthsOfSupply !== undefined && {
        monthsOfSupply: data.monthsOfSupply ? new Prisma.Decimal(data.monthsOfSupply) : null,
      }),
      ...(data.priceChangeYoy !== undefined && {
        priceChangeYoy: data.priceChangeYoy ? new Prisma.Decimal(data.priceChangeYoy) : null,
      }),
      ...(data.salesVolumeChangeYoy !== undefined && {
        salesVolumeChangeYoy: data.salesVolumeChangeYoy ? new Prisma.Decimal(data.salesVolumeChangeYoy) : null,
      }),
      salesCount: data.salesCount,
      newListingsCount: data.newListingsCount,
      daysOnMarket: data.daysOnMarket,
      activeListings: data.activeListings,
    };
  }

  private aggregateByInterval(metrics: MarketMetric[], interval: 'weekly' | 'monthly') {
    // Group metrics by ZIP code and interval
    const grouped: Record<string, MarketMetric[]> = {};

    for (const metric of metrics) {
      const key = this.getIntervalKey(metric.metricDate, metric.zipCode, interval);
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(metric);
    }

    // Aggregate each group
    const aggregated: MarketMetric[] = [];
    for (const group of Object.values(grouped)) {
      // Use the latest date in the group
      const latestMetric = group.reduce((latest, current) => 
        current.metricDate > latest.metricDate ? current : latest
      );

      // Calculate averages for numeric fields
      const avgMetric: any = { ...latestMetric };
      
      const numericFields = [
        'medianSalePrice', 'medianRent', 'pricePerSqft', 
        'salesCount', 'newListingsCount', 'daysOnMarket',
        'activeListings', 'monthsOfSupply'
      ];

      for (const field of numericFields) {
        const values = group
          .map(m => m[field as keyof MarketMetric])
          .filter(v => v !== null)
          .map(v => Number(v));

        if (values.length > 0) {
          avgMetric[field] = new Prisma.Decimal(
            values.reduce((a, b) => a + b, 0) / values.length
          );
        }
      }

      aggregated.push(avgMetric);
    }

    return aggregated;
  }

  private getIntervalKey(date: Date, zipCode: string, interval: 'weekly' | 'monthly') {
    if (interval === 'weekly') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      return `${zipCode}-${weekStart.toISOString().split('T')[0]}`;
    } else {
      return `${zipCode}-${date.getFullYear()}-${date.getMonth() + 1}`;
    }
  }
}