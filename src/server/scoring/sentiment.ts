/**
 * Sentiment Model Interface
 * 
 * Provides sentiment analysis for review content.
 * Structured for real provider integration (OpenAI, AWS Comprehend, etc.)
 */

// ============================================================
// TYPES
// ============================================================

/**
 * Sentiment analysis request
 */
export interface SentimentRequest {
  /** Review text content */
  content: string;
  
  /** Detected or specified language */
  language?: string;
  
  /** Additional context for the model */
  context?: {
    /** Business type (restaurant, hotel, etc.) */
    businessType?: string;
    
    /** Star rating if available (for validation/blending) */
    starRating?: number;
  };
}

/**
 * Sentiment analysis response
 */
export interface SentimentResponse {
  /** Sentiment score in range [-1, +1] */
  score: number;
  
  /** Confidence in the analysis (0-1) */
  confidence: number;
  
  /** Detected sentiment category */
  category: 'positive' | 'neutral' | 'negative';
  
  /** Model version used */
  modelVersion: string;
  
  /** Provider name */
  provider: string;
  
  /** Raw response from provider (for debugging) */
  rawResponse?: unknown;
  
  /** Processing time in ms */
  processingTimeMs?: number;
}

/**
 * Sentiment model provider interface
 */
export interface ISentimentProvider {
  /** Provider name */
  readonly name: string;
  
  /** Current model version */
  readonly modelVersion: string;
  
  /** Analyze sentiment of text */
  analyze(request: SentimentRequest): Promise<SentimentResponse>;
  
  /** Batch analyze multiple texts */
  analyzeBatch(requests: SentimentRequest[]): Promise<SentimentResponse[]>;
  
  /** Check provider health/availability */
  healthCheck(): Promise<boolean>;
}

// ============================================================
// STUB IMPLEMENTATION
// ============================================================

/**
 * Stub sentiment provider for development/testing
 * 
 * Uses keyword matching and star rating blending to simulate
 * real sentiment analysis. Replace with real provider in production.
 */
export class StubSentimentProvider implements ISentimentProvider {
  readonly name = 'stub';
  readonly modelVersion = 'stub-1.0.0';
  
  // Positive keywords and their sentiment weights
  private positiveKeywords: Record<string, number> = {
    'excellent': 0.9,
    'amazing': 0.9,
    'fantastic': 0.9,
    'outstanding': 0.9,
    'perfect': 1.0,
    'wonderful': 0.85,
    'great': 0.7,
    'good': 0.5,
    'love': 0.8,
    'loved': 0.8,
    'best': 0.85,
    'delicious': 0.8,
    'friendly': 0.6,
    'recommend': 0.7,
    'recommended': 0.7,
    'happy': 0.7,
    'pleased': 0.65,
    'satisfied': 0.6,
    'impressive': 0.75,
    'enjoyable': 0.65,
    'fresh': 0.5,
    'clean': 0.5,
    'fast': 0.4,
    'quick': 0.4,
    'professional': 0.6,
    'helpful': 0.6,
    'nice': 0.45,
    'tasty': 0.65,
  };
  
  // Negative keywords and their sentiment weights
  private negativeKeywords: Record<string, number> = {
    'terrible': -0.9,
    'awful': -0.9,
    'horrible': -0.9,
    'worst': -1.0,
    'disgusting': -0.95,
    'bad': -0.6,
    'poor': -0.5,
    'disappointing': -0.65,
    'disappointed': -0.65,
    'hate': -0.85,
    'hated': -0.85,
    'never': -0.3,
    'rude': -0.7,
    'slow': -0.4,
    'cold': -0.3,
    'dirty': -0.6,
    'expensive': -0.3,
    'overpriced': -0.5,
    'avoid': -0.75,
    'waste': -0.6,
    'bland': -0.4,
    'stale': -0.5,
    'unfriendly': -0.55,
    'unprofessional': -0.6,
    'mediocre': -0.35,
    'underwhelming': -0.45,
    'waited': -0.2,
    'waiting': -0.2,
  };
  
  async analyze(request: SentimentRequest): Promise<SentimentResponse> {
    const startTime = Date.now();
    
    const content = request.content.toLowerCase();
    const words = content.split(/\W+/).filter(w => w.length > 2);
    
    // Calculate keyword-based sentiment
    let sentimentSum = 0;
    let matchCount = 0;
    
    for (const word of words) {
      if (this.positiveKeywords[word] !== undefined) {
        sentimentSum += this.positiveKeywords[word];
        matchCount++;
      }
      if (this.negativeKeywords[word] !== undefined) {
        sentimentSum += this.negativeKeywords[word];
        matchCount++;
      }
    }
    
    // Base sentiment from keywords
    let score = matchCount > 0 ? sentimentSum / matchCount : 0;
    
    // Blend with star rating if available (70% text, 30% rating)
    if (request.context?.starRating !== undefined) {
      const ratingNormalized = (request.context.starRating - 3) / 2; // Convert 1-5 to [-1, +1]
      score = score * 0.7 + ratingNormalized * 0.3;
    }
    
    // Clamp to [-1, +1]
    score = Math.max(-1, Math.min(1, score));
    
    // Calculate confidence based on keyword matches
    const confidence = Math.min(1, 0.5 + (matchCount * 0.1));
    
    // Determine category
    let category: 'positive' | 'neutral' | 'negative';
    if (score > 0.2) {
      category = 'positive';
    } else if (score < -0.2) {
      category = 'negative';
    } else {
      category = 'neutral';
    }
    
    return {
      score,
      confidence,
      category,
      modelVersion: this.modelVersion,
      provider: this.name,
      processingTimeMs: Date.now() - startTime,
    };
  }
  
  async analyzeBatch(requests: SentimentRequest[]): Promise<SentimentResponse[]> {
    return Promise.all(requests.map(r => this.analyze(r)));
  }
  
  async healthCheck(): Promise<boolean> {
    return true;
  }
}

// ============================================================
// OPENAI PROVIDER (STUB - Ready for implementation)
// ============================================================

/**
 * OpenAI sentiment provider configuration
 */
export interface OpenAIProviderConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * OpenAI sentiment provider
 * 
 * TODO: Implement with actual OpenAI API integration
 */
export class OpenAISentimentProvider implements ISentimentProvider {
  readonly name = 'openai';
  readonly modelVersion: string;
  
  private config: OpenAIProviderConfig;
  
  constructor(config: OpenAIProviderConfig) {
    this.config = config;
    this.modelVersion = config.model;
  }
  
  async analyze(request: SentimentRequest): Promise<SentimentResponse> {
    // TODO: Implement actual OpenAI API call
    // For now, fall back to stub
    const stub = new StubSentimentProvider();
    const result = await stub.analyze(request);
    return {
      ...result,
      provider: this.name,
      modelVersion: this.modelVersion,
    };
  }
  
  async analyzeBatch(requests: SentimentRequest[]): Promise<SentimentResponse[]> {
    // TODO: Implement batch processing with OpenAI
    return Promise.all(requests.map(r => this.analyze(r)));
  }
  
  async healthCheck(): Promise<boolean> {
    // TODO: Implement actual health check
    return true;
  }
}

// ============================================================
// SENTIMENT SERVICE
// ============================================================

/**
 * Singleton sentiment service
 */
let sentimentProvider: ISentimentProvider | null = null;

/**
 * Initialize sentiment provider
 */
export function initializeSentimentProvider(provider: ISentimentProvider): void {
  sentimentProvider = provider;
}

/**
 * Get the current sentiment provider
 */
export function getSentimentProvider(): ISentimentProvider {
  if (!sentimentProvider) {
    // Default to stub provider
    sentimentProvider = new StubSentimentProvider();
  }
  return sentimentProvider;
}

/**
 * Analyze sentiment using the configured provider
 */
export async function analyzeSentiment(request: SentimentRequest): Promise<SentimentResponse> {
  return getSentimentProvider().analyze(request);
}

/**
 * Analyze sentiment for multiple texts
 */
export async function analyzeSentimentBatch(
  requests: SentimentRequest[]
): Promise<SentimentResponse[]> {
  return getSentimentProvider().analyzeBatch(requests);
}

/**
 * Get the current model version being used
 */
export function getSentimentModelVersion(): string {
  return getSentimentProvider().modelVersion;
}
