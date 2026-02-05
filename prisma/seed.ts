/**
 * Database Seed Script
 * 
 * Creates test data for local development including:
 * - Pick'd admin user
 * - Demo restaurant organization with branches
 * - Restaurant users (owner, manager, staff)
 * - System themes
 * 
 * Run with: npm run db:seed
 */

import { PrismaClient, UserRole, ThemeCategory } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Create adapter and Prisma client
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
});

/**
 * Hash a password
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Main seed function
 */
async function main() {
  console.log('🌱 Starting database seed...\n');

  // ============================================================
  // 1. CREATE PICK'D ADMIN USER
  // ============================================================
  console.log('Creating Pick\'d admin user...');
  
  const adminPasswordHash = await hashPassword('admin123');
  
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@pickd.co.za' },
    update: {},
    create: {
      email: 'admin@pickd.co.za',
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.PICKD_ADMIN,
      isPickdStaff: true,
      tenantAccess: [],
      isActive: true,
    },
  });
  
  console.log(`  ✓ Admin user created: ${adminUser.email}`);

  // ============================================================
  // 2. CREATE DEMO ORGANIZATION
  // ============================================================
  console.log('\nCreating demo organization...');
  
  const demoOrg = await prisma.organization.upsert({
    where: { id: 'demo-org-001' },
    update: {},
    create: {
      id: 'demo-org-001',
      name: 'Coastal Eats Restaurant Group',
      subscriptionTier: 'PROFESSIONAL',
      subscriptionStatus: 'ACTIVE',
      settings: {
        timezone: 'Africa/Johannesburg',
        currency: 'ZAR',
        language: 'en',
      },
    },
  });
  
  console.log(`  ✓ Organization created: ${demoOrg.name}`);

  // ============================================================
  // 3. CREATE DEMO BRANCHES (TENANTS)
  // ============================================================
  console.log('\nCreating demo branches...');
  
  const branches = [
    {
      id: 'tenant-001',
      name: 'V&A Waterfront',
      address: '123 Waterfront Blvd',
      city: 'Cape Town',
      country: 'South Africa',
      googlePlaceId: 'ChIJxxxxxxxxxx',
    },
    {
      id: 'tenant-002',
      name: 'Stellenbosch',
      address: '45 Wine Route Road',
      city: 'Stellenbosch',
      country: 'South Africa',
      googlePlaceId: 'ChIJyyyyyyyyyy',
    },
    {
      id: 'tenant-003',
      name: 'Camps Bay',
      address: '78 Victoria Road',
      city: 'Cape Town',
      country: 'South Africa',
      googlePlaceId: 'ChIJzzzzzzzzzz',
    },
  ];

  const createdBranches: string[] = [];
  
  for (const branch of branches) {
    const tenant = await prisma.tenant.upsert({
      where: { id: branch.id },
      update: {},
      create: {
        id: branch.id,
        organizationId: demoOrg.id,
        name: branch.name,
        address: branch.address,
        city: branch.city,
        country: branch.country,
        googlePlaceId: branch.googlePlaceId,
        isActive: true,
      },
    });
    createdBranches.push(tenant.id);
    console.log(`  ✓ Branch created: ${tenant.name}`);
  }

  // ============================================================
  // 4. CREATE RESTAURANT USERS
  // ============================================================
  console.log('\nCreating restaurant users...');
  
  const restaurantUsers = [
    {
      email: 'owner@demo-restaurant.co.za',
      password: 'owner123',
      firstName: 'Sarah',
      lastName: 'Johnson',
      role: UserRole.OWNER,
      tenantAccess: createdBranches, // Access to all branches
    },
    {
      email: 'manager@demo-restaurant.co.za',
      password: 'manager123',
      firstName: 'Mike',
      lastName: 'Chen',
      role: UserRole.MANAGER,
      tenantAccess: [createdBranches[0], createdBranches[1]], // Access to first two branches
    },
    {
      email: 'staff@demo-restaurant.co.za',
      password: 'staff123',
      firstName: 'Lisa',
      lastName: 'Smith',
      role: UserRole.STAFF,
      tenantAccess: [createdBranches[0]], // Access to first branch only
    },
  ];

  for (const userData of restaurantUsers) {
    const passwordHash = await hashPassword(userData.password);
    
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        email: userData.email,
        passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        isPickdStaff: false,
        organizationId: demoOrg.id,
        tenantAccess: userData.tenantAccess,
        isActive: true,
      },
    });
    
    console.log(`  ✓ User created: ${user.email} (${user.role})`);
  }

  // ============================================================
  // 5. CREATE SYSTEM THEMES
  // ============================================================
  console.log('\nCreating system themes...');
  
  const systemThemes = [
    { name: 'Food Quality', category: ThemeCategory.PRODUCT, color: '#22c55e', keywords: ['food', 'taste', 'flavor', 'fresh', 'delicious'] },
    { name: 'Service', category: ThemeCategory.SERVICE, color: '#3b82f6', keywords: ['service', 'staff', 'waiter', 'friendly', 'attentive'] },
    { name: 'Wait Time', category: ThemeCategory.SERVICE, color: '#f59e0b', keywords: ['wait', 'slow', 'fast', 'quick', 'long'] },
    { name: 'Ambiance', category: ThemeCategory.AMBIANCE, color: '#8b5cf6', keywords: ['atmosphere', 'vibe', 'decor', 'music', 'lighting'] },
    { name: 'Cleanliness', category: ThemeCategory.CLEANLINESS, color: '#06b6d4', keywords: ['clean', 'dirty', 'hygiene', 'tidy', 'spotless'] },
    { name: 'Value for Money', category: ThemeCategory.VALUE, color: '#ec4899', keywords: ['price', 'value', 'expensive', 'cheap', 'worth'] },
    { name: 'Menu Variety', category: ThemeCategory.PRODUCT, color: '#10b981', keywords: ['menu', 'options', 'variety', 'choice', 'selection'] },
    { name: 'Portion Size', category: ThemeCategory.VALUE, color: '#f97316', keywords: ['portion', 'size', 'amount', 'generous', 'small'] },
  ];

  for (const theme of systemThemes) {
    await prisma.theme.upsert({
      where: { 
        id: `system-theme-${theme.name.toLowerCase().replace(/\s+/g, '-')}` 
      },
      update: {},
      create: {
        id: `system-theme-${theme.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: theme.name,
        category: theme.category,
        color: theme.color,
        keywords: theme.keywords,
        isSystem: true,
        isActive: true,
        organizationId: null, // System themes are global
      },
    });
    console.log(`  ✓ Theme created: ${theme.name}`);
  }

  // ============================================================
  // 6. CREATE DEFAULT PARAMETER SET
  // ============================================================
  console.log('\nCreating default parameter set...');
  
  const defaultParameters = {
    sentiment: {
      model_version: 'gpt-4-turbo',
      use_star_rating: true,
      language_handling_mode: 'multilingual_model',
    },
    time: {
      review_half_life_days: 60,
    },
    source: {
      weights: {
        google: 1.20,
        hellopeter: 1.15,
        tripadvisor: 1.00,
        facebook: 0.90,
        yelp: 1.00,
        zomato: 1.00,
        opentable: 0.90,
        website: 0.80,
        instagram: 0.80,
        twitter: 0.70,
      },
      min_weight: 0.60,
      max_weight: 1.40,
    },
    engagement: {
      enabled_by_source: {
        google: true,
        facebook: true,
        tripadvisor: true,
        hellopeter: false,
        yelp: true,
      },
      cap: 1.30,
    },
    confidence: {
      rules_version: '1.0.0',
      min_text_length_chars: 20,
      duplicate_similarity_threshold: 0.85,
      low_confidence_floor: 0.60,
      vague_review_weight: 0.70,
      duplicate_review_weight: 0.60,
    },
    fix_tracking: {
      pre_window_days: 30,
      post_window_days: 30,
      min_reviews_for_inference: 5,
      confidence_thresholds: {
        high: 10,
        medium: 5,
        low: 2,
      },
    },
  };

  await prisma.parameterSetVersion.upsert({
    where: { id: 'default-params-v1' },
    update: {},
    create: {
      id: 'default-params-v1',
      name: 'Default Parameters v1.0',
      description: 'Initial production parameter set',
      parameters: defaultParameters,
      status: 'ACTIVE',
      activatedAt: new Date(),
      activatedById: adminUser.id,
      createdById: adminUser.id,
    },
  });
  
  console.log('  ✓ Default parameter set created');

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n========================================');
  console.log('🎉 Seed completed successfully!');
  console.log('========================================');
  console.log('\n📧 Test Accounts:');
  console.log('----------------------------------------');
  console.log('Pick\'d Admin:');
  console.log('  Email: admin@pickd.co.za');
  console.log('  Password: admin123');
  console.log('');
  console.log('Restaurant Owner:');
  console.log('  Email: owner@demo-restaurant.co.za');
  console.log('  Password: owner123');
  console.log('');
  console.log('Restaurant Manager:');
  console.log('  Email: manager@demo-restaurant.co.za');
  console.log('  Password: manager123');
  console.log('');
  console.log('Restaurant Staff:');
  console.log('  Email: staff@demo-restaurant.co.za');
  console.log('  Password: staff123');
  console.log('----------------------------------------\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
