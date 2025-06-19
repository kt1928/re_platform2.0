import { prisma } from '@/lib/db';
import { Portfolio, PortfolioProperty, Prisma } from '@prisma/client';
import { 
  CreatePortfolioRequest, 
  UpdatePortfolioRequest,
  PortfolioSearchParams,
  AddPropertyToPortfolioRequest,
  UpdatePortfolioPropertyRequest 
} from '@/types/portfolio';
import { NotFoundError } from '@/lib/errors';

export class PortfolioRepository {
  async findById(id: string, userId?: string) {
    const where: Prisma.PortfolioWhereInput = { id };
    if (userId) {
      where.userId = userId;
    }
    
    return prisma.portfolio.findFirst({ where });
  }

  async findByUser(userId: string, params?: PortfolioSearchParams) {
    const { q, riskTolerance, limit = 20, offset = 0 } = params || {};

    const where: Prisma.PortfolioWhereInput = {
      userId,
      ...(riskTolerance && { riskTolerance }),
      ...(q && {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      }),
    };

    const [portfolios, total] = await Promise.all([
      prisma.portfolio.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.portfolio.count({ where }),
    ]);

    return {
      portfolios,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    };
  }

  async create(userId: string, data: CreatePortfolioRequest): Promise<Portfolio> {
    return prisma.portfolio.create({
      data: {
        ...data,
        userId,
        targetReturn: data.targetReturn ? new Prisma.Decimal(data.targetReturn) : null,
      },
    });
  }

  async update(id: string, userId: string, data: UpdatePortfolioRequest): Promise<Portfolio> {
    const portfolio = await this.findById(id, userId);
    if (!portfolio) {
      throw new NotFoundError('Portfolio');
    }

    return prisma.portfolio.update({
      where: { id },
      data: {
        ...data,
        targetReturn: data.targetReturn !== undefined 
          ? data.targetReturn ? new Prisma.Decimal(data.targetReturn) : null
          : undefined,
        updatedAt: new Date(),
      },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const portfolio = await this.findById(id, userId);
    if (!portfolio) {
      throw new NotFoundError('Portfolio');
    }

    await prisma.portfolio.delete({ where: { id } });
  }

  async addProperty(portfolioId: string, userId: string, data: AddPropertyToPortfolioRequest) {
    // Verify portfolio ownership
    const portfolio = await this.findById(portfolioId, userId);
    if (!portfolio) {
      throw new NotFoundError('Portfolio');
    }

    // Verify property exists
    const property = await prisma.property.findUnique({
      where: { id: data.propertyId },
    });
    if (!property) {
      throw new NotFoundError('Property');
    }

    // Check if property already in portfolio
    const existing = await prisma.portfolioProperty.findUnique({
      where: {
        portfolioId_propertyId: {
          portfolioId,
          propertyId: data.propertyId,
        },
      },
    });

    if (existing) {
      throw new Error('Property already in portfolio');
    }

    return prisma.portfolioProperty.create({
      data: {
        portfolioId,
        propertyId: data.propertyId,
        purchaseDate: data.purchaseDate,
        purchasePrice: new Prisma.Decimal(data.purchasePrice),
        downPayment: data.downPayment ? new Prisma.Decimal(data.downPayment) : null,
        loanAmount: data.loanAmount ? new Prisma.Decimal(data.loanAmount) : null,
        interestRate: data.interestRate ? new Prisma.Decimal(data.interestRate) : null,
        currentValue: data.currentValue ? new Prisma.Decimal(data.currentValue) : null,
        monthlyRent: data.monthlyRent ? new Prisma.Decimal(data.monthlyRent) : null,
        occupancyStatus: data.occupancyStatus,
      },
      include: {
        property: true,
      },
    });
  }

  async updateProperty(
    portfolioId: string, 
    propertyId: string, 
    userId: string, 
    data: UpdatePortfolioPropertyRequest
  ) {
    // Verify portfolio ownership
    const portfolio = await this.findById(portfolioId, userId);
    if (!portfolio) {
      throw new NotFoundError('Portfolio');
    }

    const portfolioProperty = await prisma.portfolioProperty.findUnique({
      where: {
        portfolioId_propertyId: {
          portfolioId,
          propertyId,
        },
      },
    });

    if (!portfolioProperty) {
      throw new NotFoundError('Property not in portfolio');
    }

    return prisma.portfolioProperty.update({
      where: {
        portfolioId_propertyId: {
          portfolioId,
          propertyId,
        },
      },
      data: {
        ...(data.purchaseDate && { purchaseDate: data.purchaseDate }),
        ...(data.purchasePrice !== undefined && {
          purchasePrice: new Prisma.Decimal(data.purchasePrice),
        }),
        ...(data.downPayment !== undefined && {
          downPayment: data.downPayment ? new Prisma.Decimal(data.downPayment) : null,
        }),
        ...(data.loanAmount !== undefined && {
          loanAmount: data.loanAmount ? new Prisma.Decimal(data.loanAmount) : null,
        }),
        ...(data.interestRate !== undefined && {
          interestRate: data.interestRate ? new Prisma.Decimal(data.interestRate) : null,
        }),
        ...(data.currentValue !== undefined && {
          currentValue: data.currentValue ? new Prisma.Decimal(data.currentValue) : null,
        }),
        ...(data.monthlyRent !== undefined && {
          monthlyRent: data.monthlyRent ? new Prisma.Decimal(data.monthlyRent) : null,
        }),
        ...(data.occupancyStatus !== undefined && { occupancyStatus: data.occupancyStatus }),
        updatedAt: new Date(),
      },
      include: {
        property: true,
      },
    });
  }

  async removeProperty(portfolioId: string, propertyId: string, userId: string) {
    // Verify portfolio ownership
    const portfolio = await this.findById(portfolioId, userId);
    if (!portfolio) {
      throw new NotFoundError('Portfolio');
    }

    const portfolioProperty = await prisma.portfolioProperty.delete({
      where: {
        portfolioId_propertyId: {
          portfolioId,
          propertyId,
        },
      },
    });

    return portfolioProperty;
  }

  async getProperties(portfolioId: string, userId: string) {
    // Verify portfolio ownership
    const portfolio = await this.findById(portfolioId, userId);
    if (!portfolio) {
      throw new NotFoundError('Portfolio');
    }

    return prisma.portfolioProperty.findMany({
      where: { portfolioId },
      include: {
        property: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPerformance(portfolioId: string, userId: string) {
    // Verify portfolio ownership
    const portfolio = await this.findById(portfolioId, userId);
    if (!portfolio) {
      throw new NotFoundError('Portfolio');
    }

    const properties = await prisma.portfolioProperty.findMany({
      where: { portfolioId },
      include: {
        property: true,
      },
    });

    // Calculate portfolio metrics
    let totalInvested = 0;
    let totalValue = 0;
    let totalMonthlyRent = 0;
    let totalReturn = 0;
    let occupiedCount = 0;

    const propertyMetrics = properties.map(pp => {
      const invested = Number(pp.purchasePrice);
      const currentValue = pp.currentValue ? Number(pp.currentValue) : invested;
      const monthlyRent = pp.monthlyRent ? Number(pp.monthlyRent) : 0;
      const propertyReturn = currentValue - invested + (monthlyRent * 12); // Simple annual return
      const returnPercentage = invested > 0 ? (propertyReturn / invested) * 100 : 0;

      totalInvested += invested;
      totalValue += currentValue;
      totalMonthlyRent += monthlyRent;
      totalReturn += propertyReturn;

      if (pp.occupancyStatus === 'occupied') {
        occupiedCount++;
      }

      return {
        propertyId: pp.propertyId,
        address: `${pp.property.addressLine1}, ${pp.property.city}, ${pp.property.state}`,
        purchasePrice: invested,
        currentValue,
        monthlyRent,
        return: returnPercentage,
      };
    });

    const occupancyRate = properties.length > 0 
      ? (occupiedCount / properties.length) * 100 
      : 0;

    const avgReturn = properties.length > 0 
      ? totalReturn / totalInvested * 100 
      : null;

    return {
      portfolio,
      properties: propertyMetrics,
      metrics: {
        propertyCount: properties.length,
        totalInvested,
        totalValue,
        totalMonthlyRent,
        avgReturn,
        unrealizedGain: totalValue - totalInvested,
        totalReturn,
        returnPercentage: totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0,
        annualizedReturn: avgReturn, // Simplified calculation
        monthlyIncome: totalMonthlyRent,
        occupancyRate,
      },
    };
  }

  async calculateReturns(portfolioProperty: PortfolioProperty) {
    const purchasePrice = Number(portfolioProperty.purchasePrice);
    const currentValue = portfolioProperty.currentValue 
      ? Number(portfolioProperty.currentValue) 
      : purchasePrice;
    const monthlyRent = portfolioProperty.monthlyRent 
      ? Number(portfolioProperty.monthlyRent) 
      : 0;

    // Calculate total return
    const totalReturn = currentValue - purchasePrice;

    // Calculate annualized return (simplified)
    const yearsSincePurchase = 
      (new Date().getTime() - portfolioProperty.purchaseDate.getTime()) / 
      (365 * 24 * 60 * 60 * 1000);
    
    const annualizedReturn = yearsSincePurchase > 0 
      ? ((currentValue / purchasePrice) ** (1 / yearsSincePurchase) - 1) * 100 
      : null;

    // Calculate cash-on-cash return
    const downPayment = portfolioProperty.downPayment 
      ? Number(portfolioProperty.downPayment) 
      : purchasePrice;
    
    const annualCashFlow = monthlyRent * 12;
    const cashOnCashReturn = downPayment > 0 
      ? (annualCashFlow / downPayment) * 100 
      : null;

    // Update the portfolio property with calculated returns
    await prisma.portfolioProperty.update({
      where: { id: portfolioProperty.id },
      data: {
        totalReturn: new Prisma.Decimal(totalReturn),
        annualizedReturn: annualizedReturn ? new Prisma.Decimal(annualizedReturn) : null,
        cashOnCashReturn: cashOnCashReturn ? new Prisma.Decimal(cashOnCashReturn) : null,
      },
    });

    return {
      totalReturn,
      annualizedReturn,
      cashOnCashReturn,
    };
  }
}