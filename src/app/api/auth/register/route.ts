/**
 * User Registration API Route
 * 
 * Creates a new user and organization.
 */

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/server/db';
import { z } from 'zod';

/**
 * Registration request schema
 */
const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  organizationName: z.string().min(1, 'Organization name is required'),
});

/**
 * POST /api/auth/register
 * 
 * Register a new user with their organization
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validationResult = registerSchema.safeParse(body);
    if (!validationResult.success) {
      const firstError = validationResult.error.issues[0];
      return NextResponse.json(
        { error: firstError?.message || 'Validation failed' },
        { status: 400 }
      );
    }

    const { email, password, firstName, lastName, organizationName } = validationResult.data;

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate slug from organization name
    const generateSlug = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 50);
    };

    const baseSlug = generateSlug(organizationName);
    const uniqueSuffix = Date.now().toString(36).slice(-4);

    // Create organization and user in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          slug: `${baseSlug}-${uniqueSuffix}`,
          subscriptionTier: 'STARTER',
          subscriptionStatus: 'ACTIVE',
        },
      });

      // Create default tenant (branch)
      const tenant = await tx.tenant.create({
        data: {
          organizationId: organization.id,
          slug: 'main',
          name: `${organizationName} - Main`,
          isActive: true,
        },
      });

      // Create user as organization owner
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          firstName,
          lastName,
          role: 'OWNER',
          isPickdStaff: false,
          organizationId: organization.id,
          tenantAccess: [tenant.id],
          isActive: true,
        },
      });

      return { user, organization, tenant };
    });

    return NextResponse.json({
      success: true,
      message: 'Registration successful',
      data: {
        userId: result.user.id,
        organizationId: result.organization.id,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}
