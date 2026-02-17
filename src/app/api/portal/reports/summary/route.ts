/**
 * Customer Summary API
 * 
 * Generates AI-powered summaries of customer reviews for different time periods.
 * Uses GPT-5-mini with strict guidelines to ensure accuracy and grounding in actual reviews.
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
  model: 'gpt-5-mini',
  maxCompletionTokens: 1200,
  // Note: GPT-5-mini only supports default temperature (1)
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

const SYSTEM_PROMPT = `You are an expert customer feedback analyst for a restaurant. Your task is to summarize customer reviews and score each theme.

## CRITICAL RULES - YOU MUST FOLLOW THESE EXACTLY:

1. **ACCURACY IS PARAMOUNT**: Only include information that is DIRECTLY stated in the reviews. Do NOT invent, assume, or extrapolate.

2. **NO FABRICATION**: If you don't have reviews mentioning something, DO NOT mention it. Never make up statistics, percentages, or specific details.

3. **GROUNDED IN EVIDENCE**: Every claim must be traceable to actual review content. Use phrases like "customers mentioned", "reviews noted", "feedback indicated".

4. **THEMATIC FOCUS**: Organize the summary around the themes present in the reviews (Service, Food Quality, Value, Ambiance, Cleanliness, etc.).

5. **BALANCED PERSPECTIVE**: Include both positive and negative feedback proportionally to how they appear in the reviews. Do not skew toward either.

6. **SPECIFIC BUT HONEST**: Include specific details from reviews (menu items, staff behaviors, etc.) but only when actually mentioned.

7. **SUMMARY FORMAT**: Write a single cohesive paragraph of 3-5 sentences. Be concise but comprehensive.

8. **IF NO REVIEWS**: If provided with zero or very few reviews, state clearly: "Insufficient review data available for this period."

9. **SENTIMENT INDICATORS**: Naturally convey the overall sentiment through your word choice without explicitly stating percentages unless you can verify them.

10. **DATE AWARENESS**: This summary is for reviews from the specified time period only.

## THEME SCORING RULES:

For each theme mentioned in the reviews, you must assign a score from 0-10 based SOLELY on the sentiment expressed in the reviews:
- 0-2: Very negative feedback (major complaints, serious issues)
- 3-4: Mostly negative feedback (complaints outweigh positives)
- 5: Mixed or neutral feedback (equal positive and negative)
- 6-7: Mostly positive feedback (positives outweigh negatives)
- 8-10: Very positive feedback (strong praise, exceptional comments)

**IMPORTANT**: Only score themes that are ACTUALLY mentioned in the reviews. Do not score themes with no mentions.

## "GOOD FOR" RECOMMENDATION:

Based on the reviews, suggest 1-3 occasions or types of customers this restaurant is good for. Examples:
- "Romantic dinners"
- "Business meetings"
- "Family celebrations"
- "Casual dining with friends"
- "Special occasions"
- "Quick lunch"
- "Date nights"
- "Group gatherings"
- "Scenic views"
- "Outdoor dining"

ONLY suggest occasions that are supported by evidence in the reviews (e.g., if reviews mention "great for our anniversary" or "perfect ambiance for a date", you can suggest "Romantic dinners").

If there's no clear evidence for any occasion, return an empty array.

## OUTPUT FORMAT:

You MUST respond with valid JSON in this exact format:
{
  "summary": "Your paragraph summary here...",
  "themeScores": {
    "Theme Name": 7.5,
    "Another Theme": 4.0
  },
  "goodFor": ["Romantic dinners", "Special occasions"]
}

Do not include any text outside the JSON object.`;

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

interface GenerationResult {
  summary: string;
  themeScores: Record<string, number>;
  goodFor: string[];
  tokens?: { prompt: number; total: number };
}

async function generateSummary(
  reviews: ReviewForSummary[],
  periodLabel: string,
  tenantName: string
): Promise<GenerationResult> {
  const openai = getOpenAIClient();
  
  if (!openai) {
    return { 
      summary: 'AI summary generation is not available. Please configure OpenAI API key.',
      themeScores: {},
      goodFor: [],
    };
  }
  
  if (reviews.length === 0) {
    return { 
      summary: `No customer reviews available for the ${periodLabel} period.`,
      themeScores: {},
      goodFor: [],
    };
  }
  
  if (reviews.length < 3) {
    return { 
      summary: `Only ${reviews.length} review(s) available for the ${periodLabel} period - insufficient data for a meaningful summary.`,
      themeScores: {},
      goodFor: [],
    };
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
      const themes = r.themes.map(t => `${t.theme.name}(${t.sentiment})`).join(', ');
      return `Review ${i + 1} ${rating}${themes ? ` [Themes: ${themes}]` : ''}:\n"${r.content}"`;
    })
    .join('\n\n');

  const userPrompt = `Generate a summary and theme scores for ${tenantName}'s customer feedback from the ${periodLabel} period.

## REVIEW STATISTICS:
- Total reviews: ${reviews.length}
- Average rating: ${avgRating ? avgRating.toFixed(1) + '/5' : 'N/A'}
- Date range: ${reviews[reviews.length - 1]?.reviewDate.toLocaleDateString()} to ${reviews[0]?.reviewDate.toLocaleDateString()}

## THEME BREAKDOWN (with sentiment counts):
${themeSummary || 'No specific themes identified'}

## ACTUAL REVIEWS:
${reviewContent}

## YOUR TASK:
1. Write a summary paragraph (3-5 sentences) about customer sentiment and key themes
2. Score each theme from 0-10 based on the sentiment expressed in the reviews
3. Suggest what occasions/customer types this restaurant is good for (based on review evidence only)

Remember: ONLY base your analysis on the reviews above. Do not invent or assume anything.

Respond with JSON only.`;

  try {
    const response = await openai.chat.completions.create({
      model: SUMMARY_CONFIG.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_completion_tokens: SUMMARY_CONFIG.maxCompletionTokens,
      // Note: GPT-5 models may use different structured output format
    });

    const content = response.choices[0]?.message?.content?.trim() || '{}';
    
    console.log('[Summary Generation] Raw response content:', content.substring(0, 500));
    console.log('[Summary Generation] Response usage:', response.usage);
    console.log('[Summary Generation] Finish reason:', response.choices[0]?.finish_reason);
    
    try {
      const parsed = JSON.parse(content) as { 
        summary?: string; 
        themeScores?: Record<string, number>;
        goodFor?: string[];
      };
      
      console.log('[Summary Generation] Parsed summary length:', parsed.summary?.length || 0);
      console.log('[Summary Generation] Parsed themeScores:', Object.keys(parsed.themeScores || {}));
      
      return {
        summary: parsed.summary || 'Unable to generate summary.',
        themeScores: parsed.themeScores || {},
        goodFor: parsed.goodFor || [],
        tokens: {
          prompt: response.usage?.prompt_tokens || 0,
          total: response.usage?.total_tokens || 0,
        },
      };
    } catch (parseError) {
      // If JSON parsing fails, try to extract the summary from the content
      console.error('[Summary Generation] JSON parse error:', parseError);
      console.log('[Summary Generation] Raw content that failed to parse:', content);
      return {
        summary: content,
        themeScores: {},
        goodFor: [],
        tokens: {
          prompt: response.usage?.prompt_tokens || 0,
          total: response.usage?.total_tokens || 0,
        },
      };
    }
  } catch (error) {
    console.error('[Summary Generation] OpenAI API error:', error);
    return { 
      summary: 'Failed to generate summary due to an API error.',
      themeScores: {},
      goodFor: [],
    };
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
      themeScores: Record<string, number>;
      goodFor: string[];
      updatedAt: string;
    }> = {};

    for (const s of summaries) {
      // Handle both old format (string[]) and new format (Record<string, number>)
      let themeScores: Record<string, number> = {};
      if (s.themesIncluded) {
        if (Array.isArray(s.themesIncluded)) {
          // Old format: convert to object with no scores
          (s.themesIncluded as string[]).forEach(name => {
            themeScores[name] = 0;
          });
        } else {
          // New format: already an object
          themeScores = s.themesIncluded as Record<string, number>;
        }
      }
      
      summaryMap[s.periodType] = {
        summary: s.summary,
        reviewCount: s.reviewCount,
        dateRangeFrom: s.dateRangeFrom.toISOString(),
        dateRangeTo: s.dateRangeTo.toISOString(),
        themeScores,
        goodFor: (s.goodFor as string[]) || [],
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
      themeScores: Record<string, number>;
      goodFor: string[];
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

      // Generate summary with theme scores and goodFor
      const { summary, themeScores, goodFor, tokens } = await generateSummary(
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
          themesIncluded: themeScores, // Store theme scores as JSON
          goodFor: goodFor, // Store goodFor suggestions as JSON array
          model: SUMMARY_CONFIG.model,
          promptTokens: tokens?.prompt,
          totalTokens: tokens?.total,
        },
        update: {
          summary,
          reviewCount: reviews.length,
          dateRangeFrom: dateFrom,
          dateRangeTo: now,
          themesIncluded: themeScores, // Store theme scores as JSON
          goodFor: goodFor, // Store goodFor suggestions as JSON array
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
        themeScores,
        goodFor,
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
