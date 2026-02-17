import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { db } from '@/server/db';
import { extractThemesFromContent } from '@/server/scoring/theme-extractor';
import { getActiveParameterVersion } from '@/server/parameters/service';
import { calculateTimeWeight, calculateSourceWeight, calculateEngagementWeight, calculateWeightedImpact } from '@/server/scoring/calculations';
import { analyzeSentimentWithThemes, isUsingAIProvider } from '@/server/scoring/sentiment';

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

  const { tenantId } = await request.json();
  if (!tenantId) {
    return new Response('Tenant ID required', { status: 400 });
  }

  // Check tenant access - pass the full user object
  if (!hasTenantAccess(session.user, tenantId)) {
    return new Response('Forbidden', { status: 403 });
  }

  // Create a streaming response
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

        // Check AI provider status
        const usingAI = isUsingAIProvider();
        send({ 
          type: 'info', 
          message: usingAI 
            ? '🤖 Using OpenAI for sentiment analysis & theme extraction' 
            : '📝 Using keyword-based analysis (set OPENAI_API_KEY for AI)'
        });

        // Get parameters (with fallback to defaults)
        const paramVersion = await getActiveParameterVersion();
        if (!paramVersion) {
          send({ type: 'error', message: '❌ No active parameter set found. Please configure parameters first.' });
          closeController();
          return;
        }
        const params = paramVersion.parameters;
        send({ type: 'info', message: `📋 Loaded parameter set: ${paramVersion.metadata.name || 'Default'}` });

        // Fetch reviews first to determine period
        const reviews = await db.review.findMany({
          where: { tenantId },
          include: {
            reviewThemes: true,
            connector: {
              select: { sourceType: true },
            },
          },
          orderBy: { reviewDate: 'desc' },
        });
        send({ type: 'info', message: `📥 Found ${reviews.length} reviews to process` });

        if (reviews.length === 0) {
          send({ type: 'complete', message: '✅ No reviews to process', results: { reviewsProcessed: 0, themesExtracted: 0, themesProcessed: 0 } });
          closeController();
          return;
        }

        // Calculate period from reviews
        const reviewDates = reviews
          .filter(r => r.reviewDate)
          .map(r => r.reviewDate!.getTime());
        const periodStart = reviewDates.length > 0 
          ? new Date(Math.min(...reviewDates)) 
          : new Date();
        const periodEnd = reviewDates.length > 0 
          ? new Date(Math.max(...reviewDates)) 
          : new Date();

        // Create a new ScoreRun record
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
        send({ type: 'info', message: `🆔 Created score run: ${scoreRun.id.slice(0, 8)}... (${periodStart.toLocaleDateString()} - ${periodEnd.toLocaleDateString()})` });

        // Phase 1: Theme Extraction
        send({ type: 'phase', phase: 1, message: '🏷️ Phase 1: Extracting themes from reviews...' });
        
        let themesExtracted = 0;
        const themeMap = new Map<string, string>();
        
        // Pre-fetch existing themes (themes are organization-wide, not tenant-specific)
        const existingThemes = await db.theme.findMany({ where: { isActive: true } });
        for (const theme of existingThemes) {
          themeMap.set(theme.name, theme.id);
        }

        for (let i = 0; i < reviews.length; i++) {
          const review = reviews[i];
          
          // Skip if already has themes or no content
          if (review.reviewThemes.length > 0 || !review.content) continue;

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

          // Log every 5 reviews or on theme detection
          if (matches.length > 0 || i % 5 === 0) {
            send({ 
              type: 'progress', 
              phase: 1,
              current: i + 1, 
              total: reviews.length,
              message: matches.length > 0 
                ? `📌 Review ${i + 1}: Found ${matches.length} themes (${matches.map(m => m.themeName).join(', ')})`
                : `📄 Processing review ${i + 1}/${reviews.length}...`
            });
          }
        }

        send({ type: 'phase_complete', phase: 1, message: `✅ Theme extraction complete: ${themesExtracted} theme tags created` });

        // Phase 2: Review Scoring (with parallel processing for speed)
        send({ type: 'phase', phase: 2, message: '🧮 Phase 2: Calculating review scores (parallel processing)...' });

        const asOfDate = new Date();
        const reviewScores: Array<{ reviewId: string; weightedImpact: number; sentiment: number }> = [];
        
        // Filter reviews with content
        const reviewsToProcess = reviews.filter(r => r.content);
        send({ type: 'info', message: `📊 Processing ${reviewsToProcess.length} reviews with content (${reviews.length - reviewsToProcess.length} skipped)` });

        // Process in parallel batches of 10 for speed
        const BATCH_SIZE = 10;
        const batches = [];
        for (let i = 0; i < reviewsToProcess.length; i += BATCH_SIZE) {
          batches.push(reviewsToProcess.slice(i, i + BATCH_SIZE));
        }

        let processedCount = 0;
        
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          
          // Process batch in parallel
          const batchResults = await Promise.all(
            batch.map(async (review) => {
              try {
                // Calculate sentiment (with themes if using AI)
                const sentimentResult = await analyzeSentimentWithThemes({
                  content: review.content,
                  language: review.detectedLanguage ?? undefined,
                  context: { businessType: 'restaurant', starRating: review.rating ?? undefined },
                });

                let baseSentiment = sentimentResult.score;
                const aiThemes = sentimentResult.themes || [];
                
                // Blend with star rating
                if (params.sentiment.use_star_rating && review.rating !== null) {
                  const ratingNormalized = (review.rating - 3) / 2;
                  const blendWeight = params.sentiment.star_rating_blend_weight ?? 0.3;
                  baseSentiment = sentimentResult.score * (1 - blendWeight) + ratingNormalized * blendWeight;
                }

                // Calculate weights (with null safety)
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

                // Calculate final weighted impact
                const W_r = calculateWeightedImpact(
                  baseSentiment,
                  timeWeight.value,
                  sourceWeight.value,
                  engagementWeight.value,
                  1.0 // confidence weight simplified
                );

                return {
                  reviewId: review.id,
                  weightedImpact: W_r,
                  sentiment: baseSentiment,
                  aiThemes,
                  timeWeight: timeWeight.value,
                  sourceWeight: sourceWeight.value,
                };
              } catch (error) {
                console.error('Error processing review:', error);
                return null;
              }
            })
          );

          // Collect successful results
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
          
          // Log batch progress
          const sampleResult = batchResults.find(r => r !== null);
          const themeInfo = sampleResult?.aiThemes?.length 
            ? ` [AI: ${sampleResult.aiThemes.map(t => t.name).join(', ')}]` 
            : '';
          
          send({
            type: 'calculation',
            phase: 2,
            current: processedCount,
            total: reviewsToProcess.length,
            message: `⚖️ Batch ${batchIndex + 1}/${batches.length}: Processed ${batch.length} reviews (${processedCount}/${reviewsToProcess.length})${themeInfo}`
          });
        }

        send({ type: 'phase_complete', phase: 2, message: `✅ Review scoring complete: ${reviewScores.length} reviews scored` });

        // Persist ReviewScore records to database (batch operation for speed)
        send({ type: 'info', message: '💾 Saving review scores to database...' });
        
        // Delete existing scores for this run first, then bulk create
        await db.reviewScore.deleteMany({
          where: { scoreRunId: scoreRun.id }
        });
        
        // Batch create all scores at once
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
        
        // Create in batches of 100 to avoid query size limits
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
        
        // Negative adjustment strength (0.3 = moderate adjustment to bring scores closer to AI perception)
        const NEGATIVE_ADJUSTMENT_STRENGTH = 0.3;

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
