import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { registerSchema } from '@/types/auth';
import { UserRepository } from '@/lib/repositories/user-repository';
import { hashPassword, validatePasswordStrength } from '@/lib/password';
import { requireAuth, requireAdmin, getUserIP, getUserAgent } from '@/lib/auth';
import { auditAuth } from '@/lib/audit';
import { 
  ValidationError, 
  AuthenticationError,
  AuthorizationError,
  InternalError 
} from '@/lib/errors';

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Require admin authentication for user registration
    const adminUser = await requireAuth(request);
    requireAdmin(adminUser);

    // Parse and validate request body
    const body = await request.json();
    const { email, password, fullName, role } = registerSchema.parse(body);

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new ValidationError('Password does not meet security requirements', {
        passwordErrors: passwordValidation.errors,
      });
    }

    // Check if email already exists
    const userRepository = new UserRepository();
    const emailExists = await userRepository.emailExists(email);
    if (emailExists) {
      throw new ValidationError('Email address is already registered');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const newUser = await userRepository.create({
      email,
      passwordHash,
      fullName,
      role,
    });

    // Audit user registration
    await auditAuth('REGISTER', newUser.id, {
      ipAddress: getUserIP(request),
      userAgent: getUserAgent(request),
      email: newUser.email,
      success: true,
    });

    console.log(`User registered by admin ${adminUser.email}: ${newUser.email} (${newUser.id}) with role ${newUser.role}`);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          fullName: newUser.fullName,
          role: newUser.role,
          isActive: newUser.isActive,
          createdAt: newUser.createdAt,
        },
      },
      meta: {
        timestamp: new Date().toISOString(),
        version: process.env.API_VERSION || '1.0',
        request_id: requestId,
      },
    }, { status: 201 });

  } catch (error) {
    const ip = getUserIP(request);

    if (error instanceof z.ZodError) {
      console.warn(`User registration validation failed from ${ip}: ${JSON.stringify(error.errors)}`);
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input parameters',
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

    if (error instanceof AuthorizationError) {
      console.warn(`Unauthorized user registration attempt from ${ip}`);
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

    if (error instanceof ValidationError) {
      return NextResponse.json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
        meta: {
          timestamp: new Date().toISOString(),
          request_id: requestId,
        },
      }, { status: error.statusCode });
    }

    console.error(`User registration error from ${ip}:`, error);
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