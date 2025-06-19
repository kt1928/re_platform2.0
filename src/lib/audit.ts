import { prisma } from './db';
import { AuditAction } from '@prisma/client';

export interface AuditLogData {
  userId?: string;
  tableName: string;
  recordId: string;
  action: AuditAction;
  oldData?: unknown;
  newData?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: data.userId,
        tableName: data.tableName,
        recordId: data.recordId,
        action: data.action,
        oldData: data.oldData ? JSON.parse(JSON.stringify(data.oldData)) : null,
        newData: data.newData ? JSON.parse(JSON.stringify(data.newData)) : null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  } catch (error) {
    // Audit logging should never fail the main operation
    console.error('Failed to create audit log:', error);
  }
}

export function auditUser(
  action: AuditAction,
  userId: string,
  recordId: string,
  oldData?: unknown,
  newData?: unknown,
  metadata?: { ipAddress?: string; userAgent?: string }
) {
  return createAuditLog({
    userId,
    tableName: 'users',
    recordId,
    action,
    oldData,
    newData,
    ipAddress: metadata?.ipAddress,
    userAgent: metadata?.userAgent,
  });
}

export function auditAuth(
  action: 'LOGIN' | 'LOGOUT' | 'REGISTER' | 'PASSWORD_CHANGE',
  userId: string,
  metadata?: { 
    ipAddress?: string; 
    userAgent?: string; 
    email?: string;
    success?: boolean;
  }
) {
  const auditAction = action === 'LOGIN' || action === 'REGISTER' ? 'INSERT' : 'UPDATE';
  
  return createAuditLog({
    userId,
    tableName: 'auth_events',
    recordId: userId,
    action: auditAction,
    newData: {
      event: action,
      success: metadata?.success ?? true,
      email: metadata?.email,
      timestamp: new Date().toISOString(),
    },
    ipAddress: metadata?.ipAddress,
    userAgent: metadata?.userAgent,
  });
}

export async function getAuditLogs(options: {
  userId?: string;
  tableName?: string;
  recordId?: string;
  action?: AuditAction;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}) {
  const {
    userId,
    tableName,
    recordId,
    action,
    limit = 50,
    offset = 0,
    startDate,
    endDate,
  } = options;

  const where = {
    ...(userId && { userId }),
    ...(tableName && { tableName }),
    ...(recordId && { recordId }),
    ...(action && { action }),
    ...(startDate || endDate) && {
      createdAt: {
        ...(startDate && { gte: startDate }),
        ...(endDate && { lte: endDate }),
      },
    },
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { logs, total };
}

export async function getRecentActivity(userId: string, limit = 20) {
  return prisma.auditLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      tableName: true,
      action: true,
      createdAt: true,
      newData: true,
    },
  });
}