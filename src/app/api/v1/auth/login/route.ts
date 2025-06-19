import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { loginSchema, LoginResponse } from '@/types/auth';
import { UserRepository } from '@/lib/repositories/user-repository';
import { verifyPassword } from '@/lib/password';
import { generateToken } from '@/lib/jwt';
import { getUserIP, getUserAgent } from '@/lib/auth';
import { auditAuth } from '@/lib/audit';
import { 
  ValidationError, 
  AuthenticationError, 
  InternalError 
} from '@/lib/errors';

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  
  try {
    // Parse and validate request body
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    // Find user by email
    const userRepository = new UserRepository();
    const user = await userRepository.findByEmail(email);

    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    if (!user.isActive) {
      throw new AuthenticationError('Account is deactivated');
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Update last login timestamp
    await userRepository.updateLastLogin(user.id);

    // Audit successful login
    await auditAuth('LOGIN', user.id, {
      ipAddress: getUserIP(request),
      userAgent: getUserAgent(request),
      email: user.email,
      success: true,
    });

    // Log successful login
    console.log(`User login successful: ${user.email} (${user.id}) from ${getUserIP(request)}`);

    const response: LoginResponse = {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
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
    // Log failed login attempt
    const ip = getUserIP(request);
    const userAgent = getUserAgent(request);
    
    if (error instanceof z.ZodError) {
      console.warn(`Login validation failed from ${ip}: ${JSON.stringify(error.errors)}`);
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
      console.warn(`Login failed from ${ip}: ${error.message}`);
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

    console.error(`Login error from ${ip}:`, error);
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