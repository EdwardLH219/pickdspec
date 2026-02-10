/**
 * Scoring Pipeline
 * 
 * Complete scoring system for Pick'd Review Intelligence:
 * - Review-level scoring (S_r, W_time, W_source, W_engagement, W_confidence, W_r)
 * - Theme aggregation (S_theme, theme_score_0_10, mentions, Severity)
 */

// Sentiment analysis
export {
  analyzeSentiment,
  analyzeSentimentBatch,
  analyzeSentimentWithThemes,
  getSentimentProvider,
  getSentimentModelVersion,
  initializeSentimentProvider,
  isUsingAIProvider,
  StubSentimentProvider,
  OpenAISentimentProvider,
} from './sentiment';

export type {
  SentimentRequest,
  SentimentResponse,
  SentimentWithThemes,
  ExtractedTheme,
  ISentimentProvider,
  OpenAIProviderConfig,
} from './sentiment';

// Calculations
export {
  calculateTimeWeight,
  calculateSourceWeight,
  calculateEngagementWeight,
  calculateWeightedImpact,
  calculateThemeSentiment,
  calculateThemeScore010,
  calculateSeverity,
  aggregateThemeScores,
  validateBounds,
  SCORE_BOUNDS,
} from './calculations';

export type {
  ReviewData,
  BaseSentimentResult,
  ReviewScoreComponents,
  ReviewScoreResult,
  ThemeAggregationInput,
  ThemeAggregationResult,
} from './calculations';

// Pipeline
export {
  scoreReview,
  executeScoreRun,
  getReviewScoresForRun,
  getThemeScoresForRun,
  getLatestScoreRun,
  getScoreRunDetails,
} from './pipeline';

export type {
  ScoreRunConfig,
  ScoreRunResult,
} from './pipeline';

// FixScore
export {
  calculateDeltaS,
  calculateFixScoreValue,
  computeFixScore,
  computeAndPersistFixScore,
  computeFixScoresForCompletedTasks,
  computeFixScoresForThemes,
  getFixScoreWithDetails,
  getFixScoresForTask,
  getFixScoresForTheme,
  getFixScoresForRun,
  getHighImpactFixScores,
} from './fixscore';

export type {
  FixScoreInput,
  FixScoreResult,
  FixScoreComponents,
} from './fixscore';
