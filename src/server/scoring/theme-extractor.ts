/**
 * Theme Extractor
 * 
 * Extracts themes from review content using:
 * 1. OpenAI (if API key available) - More accurate NLP-based extraction
 * 2. Keyword matching (fallback) - Simple rule-based extraction
 */

import { db } from '@/server/db';
import { Sentiment, ThemeCategory } from '@prisma/client';
import { logger } from '@/lib/logger';
import { analyzeSentimentWithThemes, isUsingAIProvider, type ExtractedTheme } from './sentiment';

// Map theme names to categories
const THEME_CATEGORY_MAP: Record<string, ThemeCategory> = {
  'Service': ThemeCategory.SERVICE,
  'Food Quality': ThemeCategory.PRODUCT,
  'Cleanliness': ThemeCategory.CLEANLINESS,
  'Value': ThemeCategory.VALUE,
  'Ambiance': ThemeCategory.AMBIANCE,
  'Wait Time': ThemeCategory.SERVICE,
};

// Theme keyword mappings (exported for stream endpoint)
export const THEME_KEYWORDS: Record<string, { positive: string[]; negative: string[]; neutral: string[] }> = {
  'Service': {
    positive: ['friendly', 'helpful', 'attentive', 'professional', 'welcoming', 'efficient', 'quick service', 'great service', 'excellent service', 'amazing staff', 'wonderful staff', 'polite', 'courteous'],
    negative: ['rude', 'slow service', 'ignored', 'unprofessional', 'unhelpful', 'poor service', 'terrible service', 'bad service', 'waited forever', 'inattentive', 'dismissive', 'impolite'],
    neutral: ['service', 'staff', 'waiter', 'waitress', 'server', 'manager', 'hostess'],
  },
  'Food Quality': {
    positive: ['delicious', 'tasty', 'fresh', 'flavorful', 'perfectly cooked', 'amazing food', 'excellent food', 'best food', 'mouthwatering', 'yummy', 'scrumptious'],
    negative: ['bland', 'tasteless', 'overcooked', 'undercooked', 'raw', 'stale', 'cold food', 'terrible food', 'inedible', 'disgusting', 'awful taste'],
    neutral: ['food', 'meal', 'dish', 'menu', 'portion', 'ingredients', 'recipe'],
  },
  'Cleanliness': {
    positive: ['clean', 'spotless', 'hygienic', 'tidy', 'well-maintained', 'pristine', 'immaculate'],
    negative: ['dirty', 'filthy', 'unhygienic', 'grimy', 'messy', 'cockroach', 'flies', 'unclean', 'disgusting', 'gross', 'sticky tables'],
    neutral: ['bathroom', 'restroom', 'toilet', 'tables', 'floor', 'kitchen'],
  },
  'Value': {
    positive: ['good value', 'worth it', 'reasonable prices', 'affordable', 'great deal', 'bang for buck', 'well priced', 'fairly priced'],
    negative: ['overpriced', 'expensive', 'rip off', 'not worth', 'too pricey', 'highway robbery', 'waste of money'],
    neutral: ['price', 'cost', 'bill', 'check', 'expensive', 'cheap', 'money'],
  },
  'Ambiance': {
    positive: ['great atmosphere', 'lovely ambiance', 'cozy', 'romantic', 'beautiful decor', 'nice view', 'relaxing', 'comfortable', 'charming'],
    negative: ['noisy', 'loud', 'cramped', 'uncomfortable', 'dark', 'dingy', 'cold', 'too hot', 'bad music'],
    neutral: ['atmosphere', 'ambiance', 'decor', 'music', 'lighting', 'seating', 'view', 'location'],
  },
  'Wait Time': {
    positive: ['quick', 'fast', 'no wait', 'prompt', 'efficient', 'speedy'],
    negative: ['long wait', 'slow', 'waited hours', 'took forever', 'delayed', 'waited too long'],
    neutral: ['wait', 'waiting', 'reservation', 'queue', 'line'],
  },
};

interface ThemeMatch {
  themeId: string;
  themeName: string;
  sentiment: Sentiment;
  confidence: number;
  matchedKeywords: string[];
}

/**
 * Extract themes from review content
 */
export function extractThemesFromContent(content: string): ThemeMatch[] {
  const contentLower = content.toLowerCase();
  const matches: ThemeMatch[] = [];

  for (const [themeName, keywords] of Object.entries(THEME_KEYWORDS)) {
    let positiveMatches: string[] = [];
    let negativeMatches: string[] = [];
    let neutralMatches: string[] = [];

    // Check positive keywords
    for (const keyword of keywords.positive) {
      if (contentLower.includes(keyword.toLowerCase())) {
        positiveMatches.push(keyword);
      }
    }

    // Check negative keywords
    for (const keyword of keywords.negative) {
      if (contentLower.includes(keyword.toLowerCase())) {
        negativeMatches.push(keyword);
      }
    }

    // Check neutral keywords (only if no positive/negative matches)
    if (positiveMatches.length === 0 && negativeMatches.length === 0) {
      for (const keyword of keywords.neutral) {
        if (contentLower.includes(keyword.toLowerCase())) {
          neutralMatches.push(keyword);
        }
      }
    }

    // Determine sentiment and add match
    if (positiveMatches.length > 0 || negativeMatches.length > 0 || neutralMatches.length > 0) {
      let sentiment: Sentiment;
      let matchedKeywords: string[];
      let confidence: number;

      if (positiveMatches.length > negativeMatches.length) {
        sentiment = Sentiment.POSITIVE;
        matchedKeywords = positiveMatches;
        confidence = Math.min(0.9, 0.5 + positiveMatches.length * 0.1);
      } else if (negativeMatches.length > positiveMatches.length) {
        sentiment = Sentiment.NEGATIVE;
        matchedKeywords = negativeMatches;
        confidence = Math.min(0.9, 0.5 + negativeMatches.length * 0.1);
      } else if (positiveMatches.length > 0) {
        // Equal positive and negative - lean toward mixed/neutral
        sentiment = Sentiment.NEUTRAL;
        matchedKeywords = [...positiveMatches, ...negativeMatches];
        confidence = 0.4;
      } else {
        // Only neutral keywords
        sentiment = Sentiment.NEUTRAL;
        matchedKeywords = neutralMatches;
        confidence = 0.3;
      }

      matches.push({
        themeId: '', // Will be set when we look up the theme
        themeName,
        sentiment,
        confidence,
        matchedKeywords,
      });
    }
  }

  return matches;
}

/**
 * Extract themes using OpenAI (when available)
 */
async function extractThemesWithAI(
  content: string,
  rating?: number | null
): Promise<ThemeMatch[]> {
  try {
    const result = await analyzeSentimentWithThemes({
      content,
      context: {
        businessType: 'restaurant',
        starRating: rating ?? undefined,
      },
    });

    // Convert OpenAI themes to ThemeMatch format
    return result.themes.map((theme: ExtractedTheme) => ({
      themeId: '',
      themeName: theme.name,
      sentiment: theme.sentiment === 'positive' ? Sentiment.POSITIVE :
                 theme.sentiment === 'negative' ? Sentiment.NEGATIVE :
                 Sentiment.NEUTRAL,
      confidence: theme.confidence,
      matchedKeywords: theme.keywords,
    }));
  } catch (error) {
    logger.warn({ error }, 'AI theme extraction failed, falling back to keywords');
    return extractThemesFromContent(content);
  }
}

/**
 * Extract and persist themes for all reviews of a tenant
 * Uses OpenAI when available, falls back to keyword matching
 */
export async function extractThemesForTenant(tenantId: string): Promise<{
  reviewsProcessed: number;
  themesExtracted: number;
  provider: string;
}> {
  const useAI = isUsingAIProvider();
  logger.info({ tenantId, useAI }, 'Starting theme extraction for tenant');

  // Get all themes from database
  const themes = await db.theme.findMany({
    select: { id: true, name: true },
  });

  const themeMap = new Map(themes.map(t => [t.name, t.id]));

  // Get all reviews for tenant that don't have theme tags
  const reviews = await db.review.findMany({
    where: {
      tenantId,
    },
    select: {
      id: true,
      content: true,
      rating: true,
      _count: {
        select: { reviewThemes: true },
      },
    },
  });

  // Filter to only reviews without themes
  const reviewsToProcess = reviews.filter(r => r._count.reviewThemes === 0 && r.content);
  
  logger.info({ 
    totalReviews: reviews.length, 
    reviewsToProcess: reviewsToProcess.length,
    provider: useAI ? 'openai' : 'keywords',
  }, 'Found reviews to process');

  let themesExtracted = 0;

  for (const review of reviewsToProcess) {
    // Use AI extraction if available, otherwise keyword matching
    const themeMatches = useAI 
      ? await extractThemesWithAI(review.content, review.rating)
      : extractThemesFromContent(review.content);

    for (const match of themeMatches) {
      let themeId = themeMap.get(match.themeName);
      
      if (!themeId) {
        // Theme doesn't exist in DB, create it
        const category = THEME_CATEGORY_MAP[match.themeName] || ThemeCategory.OTHER;
        const newTheme = await db.theme.create({
          data: {
            name: match.themeName,
            category,
            description: `Auto-created theme for ${match.themeName}`,
            isActive: true,
          },
        });
        themeMap.set(match.themeName, newTheme.id);
        themeId = newTheme.id;
      }

      // Create reviewTheme record
      await db.reviewTheme.create({
        data: {
          reviewId: review.id,
          themeId,
          sentiment: match.sentiment,
          confidenceScore: match.confidence,
          excerpt: match.matchedKeywords.join(', '),
          keywords: match.matchedKeywords,
        },
      });

      themesExtracted++;
    }
  }

  logger.info({
    tenantId,
    reviewsProcessed: reviewsToProcess.length,
    themesExtracted,
    provider: useAI ? 'openai' : 'keywords',
  }, 'Theme extraction completed');

  return {
    reviewsProcessed: reviewsToProcess.length,
    themesExtracted,
    provider: useAI ? 'openai' : 'keywords',
  };
}
