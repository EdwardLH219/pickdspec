/**
 * Admin API: Rule Set Versions
 * 
 * RBAC: PICKD_ADMIN only
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { authorizePickdAdmin, AuthorizationError } from '@/server/auth/rbac';
import { db } from '@/server/db';
import { RuleStatus, RuleSetCategory } from '@prisma/client';
import { validateRuleSet } from '@/server/rules/service';
import { DEFAULT_RULE_SET } from '@/server/rules/defaults';
import { audit } from '@/server/audit/service';
import type { RuleSet } from '@/server/rules/types';

/**
 * GET /api/admin/rules
 * List all rule set versions
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    authorizePickdAdmin(session.user);
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as RuleStatus | null;
    
    const versions = await db.ruleSetVersion.findMany({
      where: status ? { status } : undefined,
      include: {
        ruleSet: true,
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
        activatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
      orderBy: { versionNumber: 'desc' },
    });
    
    return NextResponse.json({ versions });
    
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error fetching rule set versions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/rules
 * Create a new rule set version (draft)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    authorizePickdAdmin(session.user);
    
    const body = await request.json();
    const { name, description, rules, baseOnVersionId } = body;
    
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    
    // Get base rules (from existing version or defaults)
    let baseRules: RuleSet = DEFAULT_RULE_SET;
    
    if (baseOnVersionId) {
      const baseVersion = await db.ruleSetVersion.findUnique({
        where: { id: baseOnVersionId },
      });
      if (baseVersion?.rules) {
        baseRules = baseVersion.rules as unknown as RuleSet;
      }
    }
    
    // Use provided rules or base
    const finalRules: RuleSet = rules ?? baseRules;
    
    // Validate rules
    const validation = validateRuleSet(finalRules);
    if (!validation.valid) {
      return NextResponse.json({
        error: 'Invalid rule set',
        details: validation.errors,
      }, { status: 400 });
    }
    
    // Get or create system rule set
    let ruleSet = await db.ruleSet.findFirst({
      where: { isSystem: true, category: RuleSetCategory.SCORING },
    });
    
    if (!ruleSet) {
      ruleSet = await db.ruleSet.create({
        data: {
          name: 'System Scoring Rules',
          description: 'Global scoring rule set',
          category: RuleSetCategory.SCORING,
          isSystem: true,
        },
      });
    }
    
    // Create draft version
    const version = await db.ruleSetVersion.create({
      data: {
        ruleSetId: ruleSet.id,
        name,
        description,
        rules: JSON.parse(JSON.stringify(finalRules)),
        status: RuleStatus.DRAFT,
        createdById: session.user.id,
      },
      include: {
        ruleSet: true,
        createdBy: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });
    
    // Audit log the creation
    await audit.ruleSetCreated(
      session.user,
      version.id,
      name,
      ruleSet.id,
      {
        confidence: finalRules.confidenceRules?.length ?? 0,
        sufficiency: finalRules.sufficiencyRules?.length ?? 0,
      }
    );
    
    return NextResponse.json({
      version,
      ruleCount: {
        confidence: finalRules.confidenceRules?.length ?? 0,
        sufficiency: finalRules.sufficiencyRules?.length ?? 0,
      },
    }, { status: 201 });
    
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Error creating rule set version:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
