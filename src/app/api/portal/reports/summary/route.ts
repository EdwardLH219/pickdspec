/**
 * Customer Summary API
 * 
 * Generates AI-powered summaries of customer reviews for different time periods.
 * Uses GPT-4o-mini with strict guidelines to ensure accuracy and grounding in actual reviews.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/server/db';
import { hasTenantAccess } from '@/server/auth/rbac';
import OpenAI from 'openai';
import { CustomerSummaryPeriod } from '@prisma/client';

// ============================================================
// CONFIGURATION
// ============================================================

const SUMMARY_CONFIG = {
  model: 'gpt-4o-mini',
  maxTokens: 800,
  temperature: 0.3, // Lower temperature for more factual output
};

// Period configurations
const PERIOD_CONFIG: Record<CustomerSummaryPeriod, { label: string; days: number }> = {
  SIX_MONTHS: { label: '6 months ago', days: 180 },
  THREE_MONTHS: { label: '3 months ago', days: 90 },
  TWO_WEEKS: { label: '2 weeks ago', days: 14 },
};

// ============================================================
// SYSTEM PROMPT - STRICT GUIDELINES
// ============================================================

const SYSTEM_PROMPT = `You are an expert customer feedback analyst for a restaurant. Your task is to summarize customer reviews into a single, accurate paragraph.

## CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY:

1. **ACCURACY IS PARAMOUNT**: Only include information that is DIRECTLY stated in the reviews. Do NOT invent, assume, or extrapolate.

2. **NO FABRICATION**: If you don't have reviews mentioning something, DO NOT mention it. Never make up statistics, percentages, or specific details.

3. **GROUNDED IN EVIDENCE**: Every claim must be traceable to actual review content. Use phrases like "customers mentioned", "reviews noted", "feedback indicated".

4. **THEMATIC FOCUS**: Organize the summary around the themes present in the reviews (Service, Food Quality, Value, Ambiance, Cleanliness, etc.).

5. **BALANCED PERSPECTIVE**: Include both positive and negative feedback proportionally to how they appear in the reviews. Do not skew toward either.

6. **SPECIFIC BUT HONEST**: Include specific details from reviews (menu items, staff behaviors, etc.) but only when actually mentioned.

7. **OUTPUT FORMAT**: Write a single cohesive paragraph of 3-5 sentences. Be concise but comprehensive.

8. **IF NO REVIEWS**: If provided with zero or very few reviews, state clearly: "Insufficient review data available for this period."

9. **SENTIMENT INDICATORS**: Naturally convey the overall sentiment through your word choice without explicitly stating percentages unless you can verify them.

10. **DATE AWARENESS**: This summary is for reviews from the specified time period only.`;

// ============================================================
// OPENAI CLIENT
// ============================================================

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ============================================================
// SUMMARY GENERATION
// ============================================================

interface ReviewForSummary {
  content: string;
  rating: number | null;
  reviewDate: Date;
  themes: Array<{ theme: { name: string; category: string }; sentiment: string }>;
}

async function generateSummary(
  reviews: ReviewForSummary[],
  periodLabel: string,
  tenantName: string
): Promise<{ summary: string; tokens?: { prompt: number; total: number } }> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    return { summary: 'AI summary generation is not available. Please configure OpenAI API key.' };
  }
  
  if (reviews.length === 0) {
    return { summary: `No customer reviews available for the ${periodLabel} period.` };
  }
  
  if (reviews.length < 3) {
    return { summary: `Only ${reviews.length} review(s) available for the ${periodLabel} period - insufficient data for a meaningful summary.` };
  }

  // Extract unique themes from reviews
  const themeMap = new Map<string, { positive: number; negative: number; neutral: number }>();
  reviews.forEach(r => {
    r.themes.forEach(t => {
      const key = t.theme.name;
      if (!themeMap.has(key)) {
        themeMap.set(key, { positive: 0, negative: 0, neutral: 0 });
      }
      const stats = themeMap.get(key)!;
      if (t.sentiment === 'POSITIVE') stats.positive++;
      else if (t.sentiment === 'NEGATIVE') stats.negative++;
      else stats.neutral++;
    });
  });

  // Build theme summary for context
  const themeSummary = Array.from(themeMap.entries())
    .map(([name, stats]) => {
      const total = stats.positive + stats.negative + stats.neutral;
      return `${name}: ${total} mentions (${stats.positive} positive, ${stats.negative} negative, ${stats.neutral} neutral)`;
    })
    .join('\n');

  // Calculate overall sentiment
  const avgRating = reviews.filter(r => r.rating !== null).reduce((sum, r) => sum + (r.rating || 0), 0) / 
    reviews.filter(r => r.rating !== null).length;
  
  // Build review content for analysis
  const reviewContent = reviews
    .map((r, i) => {
      const rating = r.rating ? `[Rating: ${r.rating}/5]` : '';
      const themes = r.themes.map(t => t.theme.name).join(', ');
      return `Review ${i + 1} ${rating}${themes ? ` [Themes: ${themes}]` : ''}:\n"${r.content}"`;
    })
    .join('\n\n');

  const userPrompt = `Generate a summary paragraph for ${tenantName}'s customer feedback from the ${periodLabel} period.

## REVIEW STATISTICS:
- Total reviews: ${reviews.length}
- Average rating: ${avgRating ? avgRating.toFixed(1) + '/5' : 'N/A'}
- Date range: ${reviews[reviews.length - 1]?.reviewDate.toLocaleDateString()} to ${reviews[0]?.reviewDate.toLocaleDateString()}

## THEME BREAKDOWN:
${themeSummary || 'No specific themes identified'}

## ACTUAL REVIEWS:
${reviewContent}

## YOUR TASK:
Write a single paragraph (3-5 sentences) summarizing the customer sentiment and key themes from these reviews. Remember: ONLY include information directly from the reviews above. Do not invent or assume anything.`;

  try {
    const response = await openai.chat.completions.create({
      model: SUMMARY_CONFIG.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: SUMMARY_CONFIG.maxTokens,
      temperature: SUMMARY_CONFIG.temperature,
    });

    const summary = response.choices[0]?.message?.content?.trim() || 'Unable to generate summary.';
    
    return {
      summary,
      tokens: {
        prompt: response.usage?.prompt_tokens || 0,
        total: response.usage?.total_tokens || 0,
      },
    };
  } catch (error) {
    console.error('OpenAI API error:', error);
    return { summary: 'Failed to generate summary due to an API error.' };
  }
}

// ============================================================
// GET - Fetch existing summaries
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // Check access
    const hasAccess = await hasTenantAccess(session.user, tenantId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch existing summaries
    const summaries = await db.customerSummary.findMany({
      where: { tenantId },
      orderBy: { periodType: 'asc' },
    });

    // Transform to a map for easier frontend consumption
    const summaryMap: Record<string, {
      summary: string;
      reviewCount: number;
      dateRangeFrom: string;
      dateRangeTo: string;
      themesIncluded: string[];
      updatedAt: string;
    }> = {};

    for (const s of summaries) {
      summaryMap[s.periodType] = {
        summary: s.summary,
        reviewCount: s.reviewCount,
        dateRangeFrom: s.dateRangeFrom.toISOString(),
        dateRangeTo: s.dateRangeTo.toISOString(),
        themesIncluded: (s.themesIncluded as string[]) || [],
        updatedAt: s.updatedAt.toISOString(),
      };
    }

    return NextResponse.json({ summaries: summaryMap });
  } catch (error) {
    console.error('Error fetching summaries:', error);
    return NextResponse.json({ error: 'Failed to fetch summaries' }, { status: 500 });
  }
}

// ============================================================
// POST - Generate/refresh summaries
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tenantId, period } = body;

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    // Check access
    const hasAccess = await hasTenantAccess(session.user, tenantId);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get tenant info
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Determine which periods to generate
    const periodsToGenerate: CustomerSummaryPeriod[] = period 
      ? [period as CustomerSummaryPeriod]
      : ['SIX_MONTHS', 'THREE_MONTHS', 'TWO_WEEKS'] as CustomerSummaryPeriod[];

    const results: Record<string, {
      summary: string;
      reviewCount: number;
      dateRangeFrom: string;
      dateRangeTo: string;
      themesIncluded: string[];
      updatedAt: string;
    }> = {};

    const now = new Date();

    for (const periodType of periodsToGenerate) {
      const config = PERIOD_CONFIG[periodType];
      const dateFrom = new Date(now);
      dateFrom.setDate(dateFrom.getDate() - config.days);

      // Fetch reviews for this period
      const reviews = await db.review.findMany({
        where: {
          tenantId,
          reviewDate: {
            gte: dateFrom,
            lte: now,
          },
        },
        include: {
          reviewThemes: {
            include: {
              theme: {
                select: { name: true, category: true },
              },
            },
          },
        },
        orderBy: { reviewDate: 'desc' },
      });

      // Transform reviews for summary generation
      const reviewsForSummary: ReviewForSummary[] = reviews.map(r => ({
        content: r.content,
        rating: r.rating,
        reviewDate: r.reviewDate,
        themes: r.reviewThemes.map(rt => ({
          theme: rt.theme,
          sentiment: rt.sentiment,
        })),
      }));

      // Extract unique themes
      const uniqueThemes = [...new Set(
        reviews.flatMap(r => r.reviewThemes.map(rt => rt.theme.name))
      )];

      // Generate summary
      const { summary, tokens } = await generateSummary(
        reviewsForSummary,
        config.label,
        tenant.name
      );

      // Upsert the summary
      const savedSummary = await db.customerSummary.upsert({
        where: {
          tenantId_periodType: {
            tenantId,
            periodType,
          },
        },
        create: {
          tenantId,
          periodType,
          summary,
          reviewCount: reviews.length,
          dateRangeFrom: dateFrom,
          dateRangeTo: now,
          themesIncluded: uniqueThemes,
          model: SUMMARY_CONFIG.model,
          promptTokens: tokens?.prompt,
          totalTokens: tokens?.total,
        },
        update: {
          summary,
          reviewCount: reviews.length,
          dateRangeFrom: dateFrom,
          dateRangeTo: now,
          themesIncluded: uniqueThemes,
          model: SUMMARY_CONFIG.model,
          promptTokens: tokens?.prompt,
          totalTokens: tokens?.total,
        },
      });

      results[periodType] = {
        summary: savedSummary.summary,
        reviewCount: savedSummary.reviewCount,
        dateRangeFrom: savedSummary.dateRangeFrom.toISOString(),
        dateRangeTo: savedSummary.dateRangeTo.toISOString(),
        themesIncluded: uniqueThemes,
        updatedAt: savedSummary.updatedAt.toISOString(),
      };
    }

    return NextResponse.json({ 
      success: true, 
      summaries: results,
      message: `Generated ${periodsToGenerate.length} summary(ies)`,
    });
  } catch (error) {
    console.error('Error generating summaries:', error);
    return NextResponse.json({ error: 'Failed to generate summaries' }, { status: 500 });
  }
}
