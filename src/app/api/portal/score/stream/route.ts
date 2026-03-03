import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { db } from '@/server/db';
import { extractThemesFromContent } from '@/server/scoring/theme-extractor';
import { getActiveParameterVersion } from '@/server/parameters/service';
import { calculateTimeWeight, calculateSourceWeight, calculateEngagementWeight, calculateWeightedImpact } from '@/server/scoring/calculations';
import { analyzeSentimentWithThemes, isUsingAIProvider } from '@/server/scoring/sentiment';

export const maxDuration = 300;

// Theme category values (matches Prisma enum)
type ThemeCategoryValue = 'SERVICE' | 'PRODUCT' | 'CLEANLINESS' | 'VALUE' | 'AMBIANCE' | 'OTHER';
type SourceTypeValue = 'GOOGLE' | 'HELLOPETER' | 'FACEBOOK' | 'TRIPADVISOR' | 'YELP' | 'ZOMATO' | 'OPENTABLE' | 'WEBSITE';

// Theme category mapping
const THEME_CATEGORY_MAP: Record<string, ThemeCategoryValue> = {
  'Service': 'SERVICE',
  'Food Quality': 'PRODUCT',
  'Cleanliness': 'CLEANLINESS',
  'Value': 'VALUE',
  'Ambiance': 'AMBIANCE',
  'Wait Time': 'SERVICE',
};

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await request.json();
  const { tenantId, forceRescore } = body;
  if (!tenantId) {
    return new Response('Tenant ID required', { status: 400 });
  }

  if (!hasTenantAccess(session.user, tenantId)) {
    return new Response('Forbidden', { status: 403 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;
      
      const send = (data: object) => {
        if (!isClosed) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }
      };
      
      const closeController = () => {
        if (!isClosed) {
          isClosed = true;
          controller.close();
        }
      };

      try {
        send({ type: 'start', message: '🚀 Starting scoring pipeline...' });

        const usingAI = isUsingAIProvider();
        send({ 
          type: 'info', 
          message: usingAI 
            ? '🤖 Using OpenAI for sentiment analysis & theme extraction' 
            : '📝 Using keyword-based analysis (set OPENAI_API_KEY for AI)'
        });

        const paramVersion = await getActiveParameterVersion();
        if (!paramVersion) {
          send({ type: 'error', message: '❌ No active parameter set found. Please configure parameters first.' });
          closeController();
          return;
        }
        const params = paramVersion.parameters;
        send({ type: 'info', message: `📋 Loaded parameter set: ${paramVersion.metadata.name || 'Default'}` });

        // Fetch all reviews
        const reviews = await db.review.findMany({
          where: { tenantId },
          include: {
            reviewThemes: true,
            connector: { select: { sourceType: true } },
          },
          orderBy: { reviewDate: 'desc' },
        });
        send({ type: 'info', message: `📥 Found ${reviews.length} total reviews` });

        if (reviews.length === 0) {
          send({ type: 'complete', message: '✅ No reviews to process', results: { reviewsProcessed: 0, themesExtracted: 0, themesProcessed: 0 } });
          closeController();
          return;
        }

        // ---- Incremental scoring: find reviews that already have scores ----
        const existingScores = forceRescore ? [] : await db.reviewScore.findMany({
          where: {
            review: { tenantId },
            scoreRun: { status: 'COMPLETED' },
          },
          orderBy: { createdAt: 'desc' },
          distinct: ['reviewId'],
          select: {
            reviewId: true,
            baseSentiment: true,
            weightedImpact: true,
          },
        });

        const cachedScoreMap = new Map(
          existingScores.map(s => [s.reviewId, { sentiment: s.baseSentiment, weightedImpact: s.weightedImpact }])
        );

        const reviewDates = reviews.filter(r => r.reviewDate).map(r => r.reviewDate!.getTime());
        const periodStart = reviewDates.length > 0 ? new Date(Math.min(...reviewDates)) : new Date();
        const periodEnd = reviewDates.length > 0 ? new Date(Math.max(...reviewDates)) : new Date();

        const scoreRun = await db.scoreRun.create({
          data: {
            tenantId,
            status: 'RUNNING',
            runType: 'MANUAL',
            parameterVersionId: paramVersion.versionId,
            periodStart,
            periodEnd,
            reviewsProcessed: 0,
            themesProcessed: 0,
            startedAt: new Date(),
          },
        });
        send({ type: 'info', message: `🆔 Score run: ${scoreRun.id.slice(0, 8)}... (${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()})` });

        // Phase 1: Theme Extraction (only for reviews without themes)
        send({ type: 'phase', phase: 1, message: '🏷️ Phase 1: Extracting themes from reviews...' });
        
        let themesExtracted = 0;
        const themeMap = new Map<string, string>();
        
        const existingThemes = await db.theme.findMany({ where: { isActive: true } });
        for (const theme of existingThemes) {
          themeMap.set(theme.name, theme.id);
        }

        const reviewsNeedingThemes = reviews.filter(r => r.reviewThemes.length === 0 && r.content);
        send({ type: 'info', message: `🏷️ ${reviewsNeedingThemes.length} reviews need theme extraction (${reviews.length - reviewsNeedingThemes.length} already tagged)` });

        for (let i = 0; i < reviewsNeedingThemes.length; i++) {
          const review = reviewsNeedingThemes[i];

          const matches = extractThemesFromContent(review.content);
          
          for (const match of matches) {
            let themeId = themeMap.get(match.themeName);
            
            if (!themeId) {
              const category = THEME_CATEGORY_MAP[match.themeName] || 'OTHER';
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

          if (matches.length > 0 || i % 10 === 0) {
            send({ 
              type: 'progress', 
              phase: 1,
              current: i + 1, 
              total: reviewsNeedingThemes.length,
              message: matches.length > 0 
                ? `📌 Review ${i + 1}: Found ${matches.length} themes (${matches.map(m => m.themeName).join(', ')})`
                : `📄 Processing review ${i + 1}/${reviewsNeedingThemes.length}...`
            });
          }
        }

        send({ type: 'phase_complete', phase: 1, message: `✅ Theme extraction complete: ${themesExtracted} theme tags created` });

        // Phase 2: Review Scoring (incremental — only score new reviews via AI)
        send({ type: 'phase', phase: 2, message: '🧮 Phase 2: Calculating review scores...' });

        const asOfDate = new Date();
        const reviewScores: Array<{ reviewId: string; weightedImpact: number; sentiment: number }> = [];
        
        const reviewsWithContent = reviews.filter(r => r.content);
        const newReviews = reviewsWithContent.filter(r => !cachedScoreMap.has(r.id));
        const cachedReviews = reviewsWithContent.filter(r => cachedScoreMap.has(r.id));

        // Reuse cached scores immediately
        for (const review of cachedReviews) {
          const cached = cachedScoreMap.get(review.id)!;
          reviewScores.push({
            reviewId: review.id,
            weightedImpact: cached.weightedImpact,
            sentiment: cached.sentiment,
          });
        }

        if (cachedReviews.length > 0) {
          send({ type: 'info', message: `⚡ Reused ${cachedReviews.length} cached scores from previous runs` });
        }
        send({ type: 'info', message: `🆕 ${newReviews.length} new reviews need AI scoring` });

        // Process only new reviews in batches
        const BATCH_SIZE = 10;
        const batches = [];
        for (let i = 0; i < newReviews.length; i += BATCH_SIZE) {
          batches.push(newReviews.slice(i, i + BATCH_SIZE));
        }

        let processedCount = 0;
        
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          
          const batchResults = await Promise.all(
            batch.map(async (review) => {
              try {
                const sentimentResult = await analyzeSentimentWithThemes({
                  content: review.content,
                  language: review.detectedLanguage ?? undefined,
                  context: { businessType: 'restaurant', starRating: review.rating ?? undefined },
                });

                let baseSentiment = sentimentResult.score;
                const aiThemes = sentimentResult.themes || [];
                
                if (params.sentiment.use_star_rating && review.rating !== null) {
                  const ratingNormalized = (review.rating - 3) / 2;
                  const blendWeight = params.sentiment.star_rating_blend_weight ?? 0.3;
                  baseSentiment = sentimentResult.score * (1 - blendWeight) + ratingNormalized * blendWeight;
                }

                const sourceType = review.connector?.sourceType ?? 'WEBSITE';
                const reviewDate = review.reviewDate ?? new Date();
                const timeWeight = calculateTimeWeight(reviewDate, asOfDate, params.time.review_half_life_days);
                const sourceWeight = calculateSourceWeight(sourceType, params);
                const engagementWeight = calculateEngagementWeight(
                  review.likesCount ?? 0,
                  review.repliesCount ?? 0,
                  review.helpfulCount ?? 0,
                  sourceType,
                  params
                );

                const W_r = calculateWeightedImpact(
                  baseSentiment,
                  timeWeight.value,
                  sourceWeight.value,
                  engagementWeight.value,
                  1.0
                );

                return {
                  reviewId: review.id,
                  weightedImpact: W_r,
                  sentiment: baseSentiment,
                  aiThemes,
                };
              } catch (error) {
                console.error('Error processing review:', error);
                return null;
              }
            })
          );

          for (const result of batchResults) {
            if (result) {
              reviewScores.push({
                reviewId: result.reviewId,
                weightedImpact: result.weightedImpact,
                sentiment: result.sentiment,
              });
            }
          }

          processedCount += batch.length;
          
          const sampleResult = batchResults.find(r => r !== null);
          const themeInfo = sampleResult?.aiThemes?.length 
            ? ` [AI: ${sampleResult.aiThemes.map(t => t.name).join(', ')}]` 
            : '';
          
          send({
            type: 'calculation',
            phase: 2,
            current: processedCount,
            total: newReviews.length,
            message: `⚖️ Batch ${batchIndex + 1}/${batches.length}: Scored ${batch.length} new reviews (${processedCount}/${newReviews.length})${themeInfo}`
          });
        }

        send({ type: 'phase_complete', phase: 2, message: `✅ Scoring complete: ${newReviews.length} new + ${cachedReviews.length} cached = ${reviewScores.length} total` });

        // Persist all scores for this run
        send({ type: 'info', message: '💾 Saving review scores to database...' });
        
        await db.reviewScore.deleteMany({ where: { scoreRunId: scoreRun.id } });
        
        const scoreData = reviewScores.map(rs => ({
          reviewId: rs.reviewId,
          scoreRunId: scoreRun.id,
          baseSentiment: rs.sentiment,
          timeWeight: 1.0,
          sourceWeight: 1.0,
          engagementWeight: 1.0,
          confidenceWeight: 1.0,
          weightedImpact: rs.weightedImpact,
          components: { sentiment: rs.sentiment, impact: rs.weightedImpact },
        }));
        
        const SCORE_BATCH_SIZE = 100;
        let savedScores = 0;
        for (let i = 0; i < scoreData.length; i += SCORE_BATCH_SIZE) {
          const batch = scoreData.slice(i, i + SCORE_BATCH_SIZE);
          await db.reviewScore.createMany({ data: batch });
          savedScores += batch.length;
        }
        
        send({ type: 'info', message: `💾 Saved ${savedScores} review scores` });

        // Phase 3: Theme Aggregation
        send({ type: 'phase', phase: 3, message: '📊 Phase 3: Aggregating theme scores...' });

        // Get all review-theme associations
        const reviewThemes = await db.reviewTheme.findMany({
          where: { review: { tenantId } },
          include: { theme: true, review: true },
        });

        // Group by theme
        const themeGroups = new Map<string, { name: string; impacts: number[] }>();
        
        for (const rt of reviewThemes) {
          const scoreData = reviewScores.find(rs => rs.reviewId === rt.reviewId);
          if (!scoreData) continue;

          if (!themeGroups.has(rt.themeId)) {
            themeGroups.set(rt.themeId, { name: rt.theme.name, impacts: [] });
          }
          themeGroups.get(rt.themeId)!.impacts.push(scoreData.weightedImpact);
        }

        // Calculate theme scores and persist them
        const themeScores: Array<{ name: string; sentiment: number; score010: number; mentions: number }> = [];
        
        // Negative adjustment strength (1.2 = aggressive adjustment to bring scores closer to AI perception)
        const NEGATIVE_ADJUSTMENT_STRENGTH = 1.2;

        for (const [themeId, data] of themeGroups) {
          const sumWr = data.impacts.reduce((a, b) => a + b, 0);
          const sumAbsWr = data.impacts.reduce((a, b) => a + Math.abs(b), 0);
          const themeSentiment = sumAbsWr > 0 ? sumWr / sumAbsWr : 0;
          
          // Count sentiment types from the impacts
          const positiveCount = data.impacts.filter(i => i > 0).length;
          const negativeCount = data.impacts.filter(i => i < 0).length;
          const neutralCount = data.impacts.filter(i => i === 0).length;
          const mentionCount = data.impacts.length;
          
          // Calculate negative ratio for volume adjustment
          const negativeRatio = mentionCount > 0 ? negativeCount / mentionCount : 0;
          
          // Apply negative volume adjustment to bring scores closer to AI/human perception
          // Base score: 5 * (themeSentiment + 1)
          // Adjustment penalizes themes with significant negative mention counts
          const baseScore = 5 * (themeSentiment + 1);
          const scoreAboveNeutral = Math.max(0, baseScore - 5);
          const penalty = negativeRatio * negativeRatio * NEGATIVE_ADJUSTMENT_STRENGTH * scoreAboveNeutral;
          const score010 = Math.max(0, Math.min(10, baseScore - penalty));

          themeScores.push({
            name: data.name,
            sentiment: themeSentiment,
            score010,
            mentions: mentionCount,
          });
          
          // Period for this run (use review date range)
          const now = new Date();
          const thirtyDaysAgo = new Date(now);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          // Persist ThemeScore to database
          try {
            await db.themeScore.upsert({
              where: {
                themeId_scoreRunId: {
                  themeId: themeId,
                  scoreRunId: scoreRun.id,
                },
              },
              create: {
                scoreRunId: scoreRun.id,
                tenantId,
                themeId,
                periodStart: thirtyDaysAgo,
                periodEnd: now,
                themeSentiment,
                themeScore010: score010,
                mentionCount: data.impacts.length,
                positiveCount,
                neutralCount,
                negativeCount,
                severity: score010 < 4 ? 3 : score010 < 6 ? 2 : score010 < 8 ? 1 : 0,
                sumWeightedImpact: sumWr,
                sumAbsWeightedImpact: sumAbsWr,
              },
              update: {
                periodStart: thirtyDaysAgo,
                periodEnd: now,
                themeSentiment,
                themeScore010: score010,
                mentionCount: data.impacts.length,
                positiveCount,
                neutralCount,
                negativeCount,
                severity: score010 < 4 ? 3 : score010 < 6 ? 2 : score010 < 8 ? 1 : 0,
                sumWeightedImpact: sumWr,
                sumAbsWeightedImpact: sumAbsWr,
              },
            });
          } catch (e) {
            console.error('Error saving theme score:', e);
          }

          send({
            type: 'theme_score',
            phase: 3,
            theme: data.name,
            mentions: data.impacts.length,
            calculation: {
              sumWr: sumWr.toFixed(3),
              sumAbsWr: sumAbsWr.toFixed(3),
              S_theme: themeSentiment.toFixed(3),
              score010: score010.toFixed(1),
            },
            message: `📈 ${data.name}: ${data.impacts.length} mentions → S_theme=${themeSentiment.toFixed(2)} → Score=${score010.toFixed(1)}/10`
          });
        }

        send({ type: 'phase_complete', phase: 3, message: `✅ Theme aggregation complete: ${themeScores.length} themes scored and saved` });

        // Mark the score run as COMPLETED before Phase 4
        const completedAt = new Date();
        await db.scoreRun.update({
          where: { id: scoreRun.id },
          data: {
            status: 'COMPLETED',
            completedAt,
            reviewsProcessed: reviewScores.length,
            themesProcessed: themeScores.length,
            durationMs: completedAt.getTime() - scoreRun.startedAt!.getTime(),
          },
        });
        send({ type: 'info', message: `✅ Score run ${scoreRun.id.slice(0, 8)}... marked as COMPLETED` });

        // ========== PHASE 4: Generate Recommendations ==========
        send({ type: 'phase_start', phase: 4, message: '💡 Generating recommendations from theme scores...' });
        
        let recommendationsGenerated = 0;
        try {
          // Import dynamically to avoid circular dependencies
          const { generateRecommendationsFromScoreRun } = await import('@/server/recommendations/engine');
          
          // Use the current score run (now COMPLETED)
          const recResult = await generateRecommendationsFromScoreRun(tenantId, scoreRun.id);
          recommendationsGenerated = recResult.generated;
          
          for (const rec of recResult.recommendations) {
            send({
              type: 'recommendation',
              phase: 4,
              severity: rec.severity,
              message: `💡 [${rec.severity}] ${rec.title}`
            });
          }
          
          send({ 
            type: 'phase_complete', 
            phase: 4, 
            message: `✅ Generated ${recResult.generated} recommendations (${recResult.skipped} already exist)` 
          });
        } catch (recError) {
          send({ type: 'log', phase: 4, message: `⚠️ Recommendation generation failed: ${recError instanceof Error ? recError.message : 'Unknown'}` });
        }

        // Final summary
        const avgScore = themeScores.length > 0 
          ? themeScores.reduce((sum, t) => sum + t.score010, 0) / themeScores.length 
          : 5;

        send({
          type: 'complete',
          message: '🎉 Scoring pipeline complete!',
          results: {
            reviewsProcessed: reviewScores.length,
            themesExtracted,
            themesProcessed: themeScores.length,
            avgScore: avgScore.toFixed(1),
            recommendationsGenerated,
            topThemes: themeScores
              .sort((a, b) => b.score010 - a.score010)
              .slice(0, 3)
              .map(t => `${t.name}: ${t.score010.toFixed(1)}`),
          }
        });

      } catch (error) {
        send({ type: 'error', message: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}` });
      } finally {
        closeController();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
