/**
 * Database Seed Script
 * 
 * Creates comprehensive test data for local development including:
 * - Pick'd admin user
 * - Demo restaurant organization with 2 branches
 * - Restaurant users (owner, manager, staff)
 * - Memberships and branch access
 * - System themes
 * - Connectors and sample reviews
 * - Sample recommendations and tasks
 * - Default parameter set
 * 
 * Run with: npx prisma db seed
 */

import { PrismaClient, UserRole, ThemeCategory, Sentiment, MemberRole, AccessLevel, SourceType, ConnectorStatus, SyncFrequency, TaskPriority, TaskStatus, RecommendationSeverity, RecommendationStatus, RecommendationCategory, ParameterStatus, AuditAction } from '@prisma/client';
import bcrypt from 'bcryptjs';
import 'dotenv/config';

// Create Prisma client
const prisma = new PrismaClient();

/**
 * Hash a password
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Generate a random date within a range
 */
function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
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

  // Create Pick'd support user
  const supportPasswordHash = await hashPassword('support123');
  
  const supportUser = await prisma.user.upsert({
    where: { email: 'support@pickd.co.za' },
    update: {},
    create: {
      email: 'support@pickd.co.za',
      passwordHash: supportPasswordHash,
      firstName: 'Support',
      lastName: 'Team',
      role: UserRole.PICKD_SUPPORT,
      isPickdStaff: true,
      tenantAccess: [],
      isActive: true,
    },
  });
  
  console.log(`  ✓ Support user created: ${supportUser.email}`);

  // ============================================================
  // 2. CREATE DEMO ORGANIZATION
  // ============================================================
  console.log('\nCreating demo organization...');
  
  const demoOrg = await prisma.organization.upsert({
    where: { slug: 'coastal-eats' },
    update: {},
    create: {
      id: 'demo-org-001',
      name: 'Coastal Eats Restaurant Group',
      slug: 'coastal-eats',
      subscriptionTier: 'PROFESSIONAL',
      subscriptionStatus: 'ACTIVE',
      settings: {
        timezone: 'Africa/Johannesburg',
        currency: 'ZAR',
        language: 'en',
        notifications: {
          email: true,
          slack: false,
        },
      },
    },
  });
  
  console.log(`  ✓ Organization created: ${demoOrg.name}`);

  // ============================================================
  // 3. CREATE DEMO BRANCHES (2 TENANTS)
  // ============================================================
  console.log('\nCreating demo branches...');
  
  const branches = [
    {
      id: 'tenant-001',
      slug: 'waterfront',
      name: 'V&A Waterfront',
      address: '123 Waterfront Blvd',
      city: 'Cape Town',
      region: 'Western Cape',
      country: 'South Africa',
      googlePlaceId: 'ChIJxxxxxxxxxx1',
      hellopeterBusinessId: 'hp-coastal-waterfront',
    },
    {
      id: 'tenant-002',
      slug: 'stellenbosch',
      name: 'Stellenbosch',
      address: '45 Wine Route Road',
      city: 'Stellenbosch',
      region: 'Western Cape',
      country: 'South Africa',
      googlePlaceId: 'ChIJyyyyyyyyyy2',
      hellopeterBusinessId: 'hp-coastal-stellenbosch',
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
        slug: branch.slug,
        name: branch.name,
        address: branch.address,
        city: branch.city,
        region: branch.region,
        country: branch.country,
        googlePlaceId: branch.googlePlaceId,
        hellopeterBusinessId: branch.hellopeterBusinessId,
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
      tenantAccess: [createdBranches[0]], // Access to first branch only
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

  const createdUsers: { id: string; email: string; role: UserRole }[] = [];

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
    
    createdUsers.push({ id: user.id, email: user.email, role: user.role });
    console.log(`  ✓ User created: ${user.email} (${user.role})`);
  }

  // ============================================================
  // 5. CREATE MEMBERSHIPS & BRANCH ACCESS
  // ============================================================
  console.log('\nCreating memberships and branch access...');

  const ownerUser = createdUsers.find(u => u.role === UserRole.OWNER)!;
  const managerUser = createdUsers.find(u => u.role === UserRole.MANAGER)!;
  const staffUser = createdUsers.find(u => u.role === UserRole.STAFF)!;

  // Owner membership - full access
  const ownerMembership = await prisma.membership.upsert({
    where: { userId_organizationId: { userId: ownerUser.id, organizationId: demoOrg.id } },
    update: {},
    create: {
      userId: ownerUser.id,
      organizationId: demoOrg.id,
      role: MemberRole.OWNER,
      isActive: true,
      acceptedAt: new Date(),
    },
  });
  console.log(`  ✓ Owner membership created`);

  // Owner branch access - all branches
  for (const branchId of createdBranches) {
    await prisma.branchAccess.upsert({
      where: { membershipId_tenantId: { membershipId: ownerMembership.id, tenantId: branchId } },
      update: {},
      create: {
        membershipId: ownerMembership.id,
        tenantId: branchId,
        accessLevel: AccessLevel.ADMIN,
      },
    });
  }
  console.log(`  ✓ Owner branch access: all branches (ADMIN)`);

  // Manager membership - first branch
  const managerMembership = await prisma.membership.upsert({
    where: { userId_organizationId: { userId: managerUser.id, organizationId: demoOrg.id } },
    update: {},
    create: {
      userId: managerUser.id,
      organizationId: demoOrg.id,
      role: MemberRole.MANAGER,
      isActive: true,
      acceptedAt: new Date(),
    },
  });
  await prisma.branchAccess.upsert({
    where: { membershipId_tenantId: { membershipId: managerMembership.id, tenantId: createdBranches[0] } },
    update: {},
    create: {
      membershipId: managerMembership.id,
      tenantId: createdBranches[0],
      accessLevel: AccessLevel.WRITE,
    },
  });
  console.log(`  ✓ Manager membership: Waterfront branch (WRITE)`);

  // Staff membership - first branch read only
  const staffMembership = await prisma.membership.upsert({
    where: { userId_organizationId: { userId: staffUser.id, organizationId: demoOrg.id } },
    update: {},
    create: {
      userId: staffUser.id,
      organizationId: demoOrg.id,
      role: MemberRole.MEMBER,
      isActive: true,
      acceptedAt: new Date(),
    },
  });
  await prisma.branchAccess.upsert({
    where: { membershipId_tenantId: { membershipId: staffMembership.id, tenantId: createdBranches[0] } },
    update: {},
    create: {
      membershipId: staffMembership.id,
      tenantId: createdBranches[0],
      accessLevel: AccessLevel.READ,
    },
  });
  console.log(`  ✓ Staff membership: Waterfront branch (READ)`);

  // ============================================================
  // 6. CREATE SYSTEM THEMES
  // ============================================================
  console.log('\nCreating system themes...');
  
  const systemThemes = [
    { name: 'Food Quality', category: ThemeCategory.PRODUCT, color: '#22c55e', icon: 'utensils', keywords: ['food', 'taste', 'flavor', 'fresh', 'delicious', 'meal', 'dish'] },
    { name: 'Service', category: ThemeCategory.SERVICE, color: '#3b82f6', icon: 'users', keywords: ['service', 'staff', 'waiter', 'friendly', 'attentive', 'helpful', 'rude'] },
    { name: 'Wait Time', category: ThemeCategory.SERVICE, color: '#f59e0b', icon: 'clock', keywords: ['wait', 'slow', 'fast', 'quick', 'long', 'delayed', 'prompt'] },
    { name: 'Ambiance', category: ThemeCategory.AMBIANCE, color: '#8b5cf6', icon: 'sparkles', keywords: ['atmosphere', 'vibe', 'decor', 'music', 'lighting', 'cozy', 'noisy'] },
    { name: 'Cleanliness', category: ThemeCategory.CLEANLINESS, color: '#06b6d4', icon: 'sparkle', keywords: ['clean', 'dirty', 'hygiene', 'tidy', 'spotless', 'mess'] },
    { name: 'Value for Money', category: ThemeCategory.VALUE, color: '#ec4899', icon: 'coins', keywords: ['price', 'value', 'expensive', 'cheap', 'worth', 'overpriced'] },
    { name: 'Menu Variety', category: ThemeCategory.PRODUCT, color: '#10b981', icon: 'book-open', keywords: ['menu', 'options', 'variety', 'choice', 'selection', 'limited'] },
    { name: 'Portion Size', category: ThemeCategory.VALUE, color: '#f97316', icon: 'scale', keywords: ['portion', 'size', 'amount', 'generous', 'small', 'large'] },
    { name: 'Location', category: ThemeCategory.LOCATION, color: '#6366f1', icon: 'map-pin', keywords: ['location', 'parking', 'accessible', 'view', 'convenient'] },
  ];

  const createdThemes: { id: string; name: string }[] = [];

  for (let i = 0; i < systemThemes.length; i++) {
    const theme = systemThemes[i];
    const createdTheme = await prisma.theme.upsert({
      where: { 
        id: `system-theme-${theme.name.toLowerCase().replace(/\s+/g, '-')}` 
      },
      update: {},
      create: {
        id: `system-theme-${theme.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: theme.name,
        category: theme.category,
        color: theme.color,
        icon: theme.icon,
        keywords: theme.keywords,
        isSystem: true,
        isActive: true,
        sortOrder: i,
        organizationId: null,
      },
    });
    createdThemes.push({ id: createdTheme.id, name: createdTheme.name });
    console.log(`  ✓ Theme created: ${theme.name}`);
  }

  // ============================================================
  // 7. CREATE CONNECTORS
  // ============================================================
  console.log('\nCreating connectors...');

  for (const branchId of createdBranches) {
    const branch = branches.find(b => b.id === branchId)!;
    
    // Google connector
    await prisma.connector.upsert({
      where: { tenantId_sourceType: { tenantId: branchId, sourceType: SourceType.GOOGLE } },
      update: {},
      create: {
        tenantId: branchId,
        sourceType: SourceType.GOOGLE,
        name: `Google Reviews - ${branch.name}`,
        externalId: branch.googlePlaceId,
        status: ConnectorStatus.ACTIVE,
        syncFrequency: SyncFrequency.DAILY,
        lastSyncedAt: new Date(),
      },
    });

    // HelloPeter connector
    await prisma.connector.upsert({
      where: { tenantId_sourceType: { tenantId: branchId, sourceType: SourceType.HELLOPETER } },
      update: {},
      create: {
        tenantId: branchId,
        sourceType: SourceType.HELLOPETER,
        name: `HelloPeter - ${branch.name}`,
        externalId: branch.hellopeterBusinessId,
        status: ConnectorStatus.ACTIVE,
        syncFrequency: SyncFrequency.DAILY,
        lastSyncedAt: new Date(),
      },
    });
  }
  console.log(`  ✓ Created connectors for ${createdBranches.length} branches`);

  // ============================================================
  // 8. CREATE SAMPLE REVIEWS
  // ============================================================
  console.log('\nCreating sample reviews...');

  const sampleReviews = [
    // Positive reviews
    { rating: 5, title: 'Amazing experience!', content: 'The food was absolutely delicious and the service was impeccable. Our waiter was so friendly and attentive. Will definitely come back!', sentiment: Sentiment.POSITIVE, themes: ['Food Quality', 'Service'] },
    { rating: 5, title: 'Best restaurant in town', content: 'Loved everything about this place - the ambiance is perfect, food is fresh and tasty. Great value for money too!', sentiment: Sentiment.POSITIVE, themes: ['Food Quality', 'Ambiance', 'Value for Money'] },
    { rating: 4, title: 'Great food, nice atmosphere', content: 'Really enjoyed our dinner here. The portions were generous and the restaurant was very clean. Highly recommend!', sentiment: Sentiment.POSITIVE, themes: ['Food Quality', 'Portion Size', 'Cleanliness'] },
    
    // Mixed reviews
    { rating: 3, title: 'Food was good but service was slow', content: 'The meal itself was tasty but we had to wait almost 40 minutes for our food. Staff seemed overwhelmed. Food quality saves it.', sentiment: Sentiment.NEUTRAL, themes: ['Food Quality', 'Wait Time', 'Service'] },
    { rating: 3, title: 'Average experience', content: 'Nothing special to write home about. Food was okay, prices a bit high for what you get. Location is convenient though.', sentiment: Sentiment.NEUTRAL, themes: ['Food Quality', 'Value for Money', 'Location'] },
    
    // Negative reviews
    { rating: 2, title: 'Disappointed', content: 'Expected more based on reviews. The service was rude and the food took forever. Portions were tiny for the price.', sentiment: Sentiment.NEGATIVE, themes: ['Service', 'Wait Time', 'Portion Size', 'Value for Money'] },
    { rating: 1, title: 'Terrible experience', content: 'Worst restaurant visit ever. Found a hair in my food and when I complained the manager was dismissive. Tables were dirty too.', sentiment: Sentiment.NEGATIVE, themes: ['Food Quality', 'Cleanliness', 'Service'] },
    { rating: 2, title: 'Not coming back', content: 'Overpriced and underwhelming. Menu options were limited and what we ordered was bland. Such a letdown.', sentiment: Sentiment.NEGATIVE, themes: ['Value for Money', 'Menu Variety', 'Food Quality'] },
  ];

  // Get connectors for first branch
  const googleConnector = await prisma.connector.findFirst({
    where: { tenantId: createdBranches[0], sourceType: SourceType.GOOGLE }
  });

  if (googleConnector) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (let i = 0; i < sampleReviews.length; i++) {
      const reviewData = sampleReviews[i];
      const reviewId = `review-${createdBranches[0]}-${i + 1}`;
      
      const review = await prisma.review.upsert({
        where: { connectorId_externalReviewId: { connectorId: googleConnector.id, externalReviewId: `ext-${reviewId}` } },
        update: {},
        create: {
          tenantId: createdBranches[0],
          connectorId: googleConnector.id,
          externalReviewId: `ext-${reviewId}`,
          rating: reviewData.rating,
          title: reviewData.title,
          content: reviewData.content,
          authorName: `Reviewer ${i + 1}`,
          reviewDate: randomDate(thirtyDaysAgo, new Date()),
          detectedLanguage: 'en',
          textLength: reviewData.content.length,
        },
      });

      // Create review-theme mappings
      for (const themeName of reviewData.themes) {
        const theme = createdThemes.find(t => t.name === themeName);
        if (theme) {
          await prisma.reviewTheme.upsert({
            where: { reviewId_themeId: { reviewId: review.id, themeId: theme.id } },
            update: {},
            create: {
              reviewId: review.id,
              themeId: theme.id,
              sentiment: reviewData.sentiment,
              confidenceScore: 0.85 + Math.random() * 0.15,
            },
          });
        }
      }
    }
    console.log(`  ✓ Created ${sampleReviews.length} sample reviews with theme mappings`);
  }

  // ============================================================
  // 9. CREATE SAMPLE RECOMMENDATIONS
  // ============================================================
  console.log('\nCreating sample recommendations...');

  const serviceTheme = createdThemes.find(t => t.name === 'Service')!;
  const waitTimeTheme = createdThemes.find(t => t.name === 'Wait Time')!;
  const cleanlinessTheme = createdThemes.find(t => t.name === 'Cleanliness')!;

  const recommendations = [
    {
      id: 'rec-001',
      themeId: serviceTheme.id,
      severity: RecommendationSeverity.HIGH,
      status: RecommendationStatus.OPEN,
      category: RecommendationCategory.URGENT_ISSUE,
      title: 'Address service quality concerns',
      description: 'Multiple recent reviews mention unfriendly or inattentive staff. Consider staff training or scheduling review.',
      suggestedActions: [
        'Conduct customer service training session',
        'Review staffing levels during peak hours',
        'Implement customer feedback program'
      ],
      estimatedImpact: 'Could improve overall rating by 0.3-0.5 stars',
      autoGenerated: true,
      triggerReason: 'Negative sentiment spike in Service theme',
    },
    {
      id: 'rec-002',
      themeId: waitTimeTheme.id,
      severity: RecommendationSeverity.MEDIUM,
      status: RecommendationStatus.IN_PROGRESS,
      category: RecommendationCategory.IMPROVEMENT,
      title: 'Reduce wait times during peak hours',
      description: 'Customers frequently mention long wait times, especially on weekends.',
      suggestedActions: [
        'Analyze kitchen workflow efficiency',
        'Consider reservation system improvements',
        'Add expeditor role during busy periods'
      ],
      estimatedImpact: 'Could reduce negative wait time mentions by 40%',
      autoGenerated: true,
      triggerReason: 'Consistent negative mentions in Wait Time theme',
    },
    {
      id: 'rec-003',
      themeId: cleanlinessTheme.id,
      severity: RecommendationSeverity.CRITICAL,
      status: RecommendationStatus.OPEN,
      category: RecommendationCategory.URGENT_ISSUE,
      title: 'Immediate attention needed: Cleanliness concerns',
      description: 'Recent reviews mention cleanliness issues including dirty tables and restrooms.',
      suggestedActions: [
        'Conduct deep cleaning of all areas',
        'Review and update cleaning schedule',
        'Assign dedicated cleaning staff during service'
      ],
      estimatedImpact: 'Critical for maintaining health standards and reputation',
      autoGenerated: true,
      triggerReason: 'Multiple cleanliness complaints in last 7 days',
    },
  ];

  for (const recData of recommendations) {
    await prisma.recommendation.upsert({
      where: { id: recData.id },
      update: {},
      create: {
        id: recData.id,
        tenantId: createdBranches[0],
        themeId: recData.themeId,
        severity: recData.severity,
        status: recData.status,
        category: recData.category,
        title: recData.title,
        description: recData.description,
        suggestedActions: recData.suggestedActions,
        estimatedImpact: recData.estimatedImpact,
        autoGenerated: recData.autoGenerated,
        triggerReason: recData.triggerReason,
      },
    });
    console.log(`  ✓ Recommendation created: ${recData.title.substring(0, 40)}...`);
  }

  // ============================================================
  // 10. CREATE SAMPLE TASKS
  // ============================================================
  console.log('\nCreating sample tasks...');

  const tasks = [
    {
      id: 'task-001',
      recommendationId: 'rec-001',
      themeId: serviceTheme.id,
      title: 'Schedule customer service training',
      description: 'Organize a half-day training session focused on customer interaction, handling complaints, and upselling techniques.',
      priority: TaskPriority.HIGH,
      status: TaskStatus.PENDING,
      assignedToId: managerUser.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
    {
      id: 'task-002',
      recommendationId: 'rec-002',
      themeId: waitTimeTheme.id,
      title: 'Analyze kitchen workflow',
      description: 'Document current kitchen processes and identify bottlenecks during peak hours.',
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.IN_PROGRESS,
      assignedToId: managerUser.id,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Started 2 days ago
    },
    {
      id: 'task-003',
      recommendationId: 'rec-003',
      themeId: cleanlinessTheme.id,
      title: 'Deep clean restaurant',
      description: 'Conduct thorough deep cleaning of all areas including kitchen, dining room, and restrooms.',
      priority: TaskPriority.URGENT,
      status: TaskStatus.COMPLETED,
      assignedToId: staffUser.id,
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Completed yesterday
      impactNotes: 'Deep cleaning completed. All areas inspected and sanitized.',
    },
    {
      id: 'task-004',
      themeId: null,
      title: 'Review staffing schedule',
      description: 'Review and optimize staffing levels for weekend peak hours.',
      priority: TaskPriority.MEDIUM,
      status: TaskStatus.PENDING,
      assignedToId: ownerUser.id,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
    },
  ];

  for (const taskData of tasks) {
    await prisma.task.upsert({
      where: { id: taskData.id },
      update: {},
      create: {
        id: taskData.id,
        tenantId: createdBranches[0],
        recommendationId: taskData.recommendationId || null,
        themeId: taskData.themeId,
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        status: taskData.status,
        assignedToId: taskData.assignedToId,
        dueDate: taskData.dueDate || null,
        startedAt: taskData.startedAt || null,
        completedAt: taskData.completedAt || null,
        impactNotes: taskData.impactNotes || null,
        createdById: ownerUser.id,
      },
    });
    console.log(`  ✓ Task created: ${taskData.title.substring(0, 40)}...`);
  }

  // ============================================================
  // 11. CREATE DEFAULT PARAMETER SET
  // ============================================================
  console.log('\nCreating default parameter set...');
  
  const defaultParameters = {
    sentiment: {
      model_version: 'gpt-4-turbo',
      use_star_rating: true,
      star_sentiment_map: {
        '1': -0.9,
        '2': -0.5,
        '3': 0.0,
        '4': 0.5,
        '5': 0.9,
      },
      language_handling_mode: 'multilingual_model',
    },
    time: {
      review_half_life_days: 60,
      min_weight: 0.1,
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
      formula: 'log_scale',
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
      description: 'Initial production parameter set with balanced weighting',
      parameters: defaultParameters,
      status: ParameterStatus.ACTIVE,
      activatedAt: new Date(),
      activatedById: adminUser.id,
      createdById: adminUser.id,
    },
  });
  
  console.log('  ✓ Default parameter set created');

  // ============================================================
  // 12. CREATE AUDIT LOG ENTRIES
  // ============================================================
  console.log('\nCreating sample audit log entries...');

  await prisma.auditLog.createMany({
    data: [
      {
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorRole: UserRole.PICKD_ADMIN,
        action: AuditAction.CREATE,
        resourceType: 'Organization',
        resourceId: demoOrg.id,
        organizationId: demoOrg.id,
        newValue: { name: demoOrg.name },
      },
      {
        actorId: ownerUser.id,
        actorEmail: 'owner@demo-restaurant.co.za',
        actorRole: UserRole.OWNER,
        action: AuditAction.LOGIN,
        resourceType: 'Session',
        organizationId: demoOrg.id,
        metadata: { device: 'Desktop', browser: 'Chrome' },
      },
      {
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actorRole: UserRole.PICKD_ADMIN,
        action: AuditAction.ACTIVATE,
        resourceType: 'ParameterSetVersion',
        resourceId: 'default-params-v1',
        metadata: { version: '1.0' },
      },
    ],
    skipDuplicates: true,
  });
  console.log('  ✓ Created sample audit log entries');

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
  console.log('Pick\'d Support:');
  console.log('  Email: support@pickd.co.za');
  console.log('  Password: support123');
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
  console.log('----------------------------------------');
  console.log('\n📍 Demo Organization:');
  console.log('  Name: Coastal Eats Restaurant Group');
  console.log('  Branches: V&A Waterfront, Stellenbosch');
  console.log('----------------------------------------');
  console.log('\n📊 Sample Data:');
  console.log(`  Themes: ${createdThemes.length}`);
  console.log(`  Reviews: ${sampleReviews.length}`);
  console.log(`  Recommendations: ${recommendations.length}`);
  console.log(`  Tasks: ${tasks.length}`);
  console.log('----------------------------------------\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
