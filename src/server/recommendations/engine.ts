/**
 * Recommendation Engine
 * 
 * Auto-generates recommendations based on theme scores from score runs.
 * Identifies issues and suggests actions based on severity thresholds.
 */

import { db } from '@/server/db';
import { RecommendationSeverity, RecommendationStatus, RecommendationCategory, ThemeCategory } from '@prisma/client';
import { logger } from '@/lib/logger';

// ============================================================
// TYPES
// ============================================================

interface ThemeScoreData {
  themeId: string;
  themeName: string;
  themeCategory: ThemeCategory;
  themeSentiment: number;
  themeScore010: number;
  severity: number;
  mentionCount: number;
}

interface GeneratedRecommendation {
  tenantId: string;
  themeId: string;
  severity: RecommendationSeverity;
  category: RecommendationCategory;
  title: string;
  description: string;
  suggestedActions: string[];
  evidenceReviewIds: string[];
  estimatedImpact: string;
  triggerReason: string;
  triggerThreshold: number;
}

// ============================================================
// THRESHOLDS & CONFIGURATION
// ============================================================

const SEVERITY_THRESHOLDS = {
  CRITICAL: { maxScore: 5.0, minMentions: 10 },  // Score < 5 with 10+ mentions - serious issue
  HIGH: { maxScore: 6.5, minMentions: 5 },       // Score < 6.5 with 5+ mentions - needs attention
  MEDIUM: { maxScore: 7.5, minMentions: 3 },     // Score < 7.5 with 3+ mentions - room for improvement
  LOW: { maxScore: 8.5, minMentions: 2 },        // Score < 8.5 with 2+ mentions - minor opportunity
};

// Action templates by theme category
const ACTION_TEMPLATES: Record<ThemeCategory, string[]> = {
  [ThemeCategory.SERVICE]: [
    'Review staffing levels during peak hours',
    'Conduct customer service refresher training',
    'Implement daily pre-shift briefings on service standards',
    'Set up mystery shopper program to monitor improvements',
    'Create service recovery protocol for complaints',
  ],
  [ThemeCategory.PRODUCT]: [
    'Schedule menu review meeting with head chef',
    'Audit supplier quality and freshness standards',
    'Test new recipes with focus group before launch',
    'Review food preparation SOPs and temperature checks',
    'Analyze which dishes receive most complaints',
  ],
  [ThemeCategory.CLEANLINESS]: [
    'Increase cleaning frequency during service',
    'Conduct staff training on hygiene standards',
    'Implement hourly cleaning checklists',
    'Schedule deep cleaning sessions weekly',
    'Audit restroom maintenance schedule',
  ],
  [ThemeCategory.VALUE]: [
    'Analyze competitor pricing in the area',
    'Design value-focused menu options or combos',
    'Review portion sizes versus pricing',
    'Create loyalty program or special offers',
    'Highlight value propositions in marketing',
  ],
  [ThemeCategory.LOCATION]: [
    'Review parking availability and signage',
    'Assess accessibility for customers',
    'Evaluate exterior appearance and curb appeal',
    'Consider visibility improvements or better signage',
    'Analyze foot traffic patterns and optimize entry',
  ],
  [ThemeCategory.AMBIANCE]: [
    'Conduct facility walkthrough assessment',
    'Review lighting, music, and temperature settings',
    'Get quotes for improvement projects',
    'Survey customers on specific preferences',
    'Address noise issues with acoustic solutions',
  ],
  [ThemeCategory.OTHER]: [
    'Investigate root cause with team meeting',
    'Create action plan with measurable targets',
    'Monitor customer feedback for improvements',
    'Assign owner to track progress weekly',
  ],
};

// ============================================================
// RECOMMENDATION GENERATION
// ============================================================

/**
 * Determine severity based on score and mention count
 */
function determineSeverity(score010: number, mentions: number): RecommendationSeverity | null {
  if (score010 < SEVERITY_THRESHOLDS.CRITICAL.maxScore && mentions >= SEVERITY_THRESHOLDS.CRITICAL.minMentions) {
    return RecommendationSeverity.CRITICAL;
  }
  if (score010 < SEVERITY_THRESHOLDS.HIGH.maxScore && mentions >= SEVERITY_THRESHOLDS.HIGH.minMentions) {
    return RecommendationSeverity.HIGH;
  }
  if (score010 < SEVERITY_THRESHOLDS.MEDIUM.maxScore && mentions >= SEVERITY_THRESHOLDS.MEDIUM.minMentions) {
    return RecommendationSeverity.MEDIUM;
  }
  if (score010 < SEVERITY_THRESHOLDS.LOW.maxScore && mentions >= SEVERITY_THRESHOLDS.LOW.minMentions) {
    return RecommendationSeverity.LOW;
  }
  return null; // No recommendation needed - theme is doing well
}

/**
 * Generate title based on theme and severity
 */
function generateTitle(themeName: string, severity: RecommendationSeverity): string {
  const prefixes: Record<RecommendationSeverity, string> = {
    [RecommendationSeverity.CRITICAL]: 'Urgent: Address Critical',
    [RecommendationSeverity.HIGH]: 'Priority: Improve',
    [RecommendationSeverity.MEDIUM]: 'Attention Needed:',
    [RecommendationSeverity.LOW]: 'Consider Improving',
  };
  return `${prefixes[severity]} ${themeName} Issues`;
}

/**
 * Generate description based on theme data
 */
function generateDescription(theme: ThemeScoreData, severity: RecommendationSeverity): string {
  const sentimentDesc = theme.themeSentiment < -0.5 ? 'very negative' :
                        theme.themeSentiment < 0 ? 'negative' :
                        theme.themeSentiment < 0.3 ? 'mixed' : 'below target';
  
  return `${theme.themeName} has a score of ${theme.themeScore010.toFixed(1)}/10 based on ${theme.mentionCount} reviews. ` +
         `Customer sentiment is ${sentimentDesc}. ` +
         `This ${severity.toLowerCase()} severity issue requires attention to prevent impact on overall ratings.`;
}

/**
 * Get suggested actions for a theme category
 */
function getSuggestedActions(category: ThemeCategory, severity: RecommendationSeverity): string[] {
  const actions = ACTION_TEMPLATES[category] || ACTION_TEMPLATES[ThemeCategory.OTHER];
  
  // More actions for higher severity
  const actionCount = severity === RecommendationSeverity.CRITICAL ? 4 :
                      severity === RecommendationSeverity.HIGH ? 3 :
                      severity === RecommendationSeverity.MEDIUM ? 2 : 1;
  
  return actions.slice(0, actionCount);
}

/**
 * Get evidence review IDs for a theme
 */
async function getEvidenceReviewIds(
  tenantId: string,
  themeId: string,
  limit: number = 5
): Promise<string[]> {
  const reviews = await db.reviewTheme.findMany({
    where: {
      themeId,
      review: { tenantId },
      sentiment: 'NEGATIVE',
    },
    orderBy: { confidenceScore: 'desc' },
    take: limit,
    select: { reviewId: true },
  });
  
  return reviews.map(r => r.reviewId);
}

/**
 * Estimate impact of fixing this issue
 */
function estimateImpact(theme: ThemeScoreData): string {
  const potentialGain = Math.min(10, theme.themeScore010 + 3) - theme.themeScore010;
  
  if (potentialGain >= 2.5) {
    return `Could improve ${theme.themeName} score by up to ${potentialGain.toFixed(1)} points`;
  }
  return `May improve overall customer satisfaction scores`;
}

/**
 * Generate recommendations from a score run
 */
export async function generateRecommendationsFromScoreRun(
  tenantId: string,
  scoreRunId: string
): Promise<{
  generated: number;
  skipped: number;
  recommendations: Array<{ id: string; title: string; severity: RecommendationSeverity }>;
}> {
  logger.info({ tenantId, scoreRunId }, 'Generating recommendations from score run');

  // Get theme scores from the run
  const themeScores = await db.themeScore.findMany({
    where: { scoreRunId, tenantId },
    include: { theme: true },
    orderBy: { severity: 'desc' },
  });

  if (themeScores.length === 0) {
    logger.info({ tenantId }, 'No theme scores found for recommendation generation');
    return { generated: 0, skipped: 0, recommendations: [] };
  }

  // Get existing open recommendations to avoid duplicates
  const existingRecs = await db.recommendation.findMany({
    where: {
      tenantId,
      status: { in: [RecommendationStatus.OPEN, RecommendationStatus.IN_PROGRESS] },
    },
    select: { themeId: true },
  });
  const existingThemeIds = new Set(existingRecs.map(r => r.themeId));

  const generated: Array<{ id: string; title: string; severity: RecommendationSeverity }> = [];
  let skipped = 0;

  for (const ts of themeScores) {
    // Skip if recommendation already exists for this theme
    if (existingThemeIds.has(ts.themeId)) {
      skipped++;
      continue;
    }

    const themeData: ThemeScoreData = {
      themeId: ts.themeId,
      themeName: ts.theme.name,
      themeCategory: ts.theme.category,
      themeSentiment: ts.themeSentiment,
      themeScore010: ts.themeScore010,
      severity: ts.severity,
      mentionCount: ts.mentionCount,
    };

    const severity = determineSeverity(themeData.themeScore010, themeData.mentionCount);
    
    if (!severity) {
      // Theme is performing well, no recommendation needed
      continue;
    }

    // Get evidence reviews
    const evidenceReviewIds = await getEvidenceReviewIds(tenantId, ts.themeId);

    // Create recommendation
    const rec = await db.recommendation.create({
      data: {
        tenantId,
        themeId: ts.themeId,
        severity,
        status: RecommendationStatus.OPEN,
        category: RecommendationCategory.IMPROVEMENT,
        title: generateTitle(themeData.themeName, severity),
        description: generateDescription(themeData, severity),
        suggestedActions: getSuggestedActions(themeData.themeCategory, severity),
        evidenceReviewIds,
        estimatedImpact: estimateImpact(themeData),
        triggerReason: `Score ${themeData.themeScore010.toFixed(1)}/10 with ${themeData.mentionCount} mentions`,
        triggerThreshold: SEVERITY_THRESHOLDS[severity].maxScore,
        autoGenerated: true,
      },
    });

    generated.push({
      id: rec.id,
      title: rec.title,
      severity: rec.severity,
    });

    logger.info({
      recommendationId: rec.id,
      theme: themeData.themeName,
      severity,
      score: themeData.themeScore010,
    }, 'Generated recommendation');
  }

  logger.info({
    tenantId,
    generated: generated.length,
    skipped,
  }, 'Recommendation generation complete');

  return { generated: generated.length, skipped, recommendations: generated };
}

/**
 * Get recommendations for a tenant with optional filters
 */
export async function getRecommendations(
  tenantId: string,
  options?: {
    status?: RecommendationStatus[];
    severity?: RecommendationSeverity[];
    themeId?: string;
    limit?: number;
    offset?: number;
  }
) {
  const where = {
    tenantId,
    ...(options?.status && { status: { in: options.status } }),
    ...(options?.severity && { severity: { in: options.severity } }),
    ...(options?.themeId && { themeId: options.themeId }),
  };

  const [recommendations, total] = await Promise.all([
    db.recommendation.findMany({
      where,
      include: {
        theme: { select: { id: true, name: true, category: true } },
        tasks: { select: { id: true, status: true } },
      },
      orderBy: [
        { severity: 'asc' }, // CRITICAL first (alphabetically first)
        { createdAt: 'desc' },
      ],
      take: options?.limit || 50,
      skip: options?.offset || 0,
    }),
    db.recommendation.count({ where }),
  ]);

  return { recommendations, total };
}

/**
 * Update recommendation status
 */
export async function updateRecommendationStatus(
  recommendationId: string,
  status: RecommendationStatus,
  userId: string
) {
  const update: { status: RecommendationStatus; resolvedAt?: Date } = { status };
  
  if (status === RecommendationStatus.RESOLVED || status === RecommendationStatus.DISMISSED) {
    update.resolvedAt = new Date();
  }

  const rec = await db.recommendation.update({
    where: { id: recommendationId },
    data: update,
  });

  logger.info({
    recommendationId,
    status,
    userId,
  }, 'Recommendation status updated');

  return rec;
}
