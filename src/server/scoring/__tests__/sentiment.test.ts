/**
 * Sentiment Provider Tests
 * 
 * Tests for the sentiment analysis interface and stub implementation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  StubSentimentProvider,
  analyzeSentiment,
  initializeSentimentProvider,
  getSentimentModelVersion,
} from '../sentiment';

// ============================================================
// STUB PROVIDER TESTS
// ============================================================

describe('StubSentimentProvider', () => {
  let provider: StubSentimentProvider;
  
  beforeEach(() => {
    provider = new StubSentimentProvider();
  });
  
  describe('Bounds', () => {
    it('should return score in range [-1, +1]', async () => {
      const testCases = [
        'This is excellent!',
        'Terrible experience',
        'It was okay',
        'The best food ever!',
        'Worst restaurant in town',
        'Average meal',
        '',
        'xyz123',
      ];
      
      for (const content of testCases) {
        const result = await provider.analyze({ content });
        
        expect(result.score).toBeGreaterThanOrEqual(-1);
        expect(result.score).toBeLessThanOrEqual(1);
      }
    });
    
    it('should return confidence in range [0, 1]', async () => {
      const result = await provider.analyze({ content: 'Great food!' });
      
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });
  
  describe('Determinism', () => {
    it('should return identical results for identical inputs', async () => {
      const request = { content: 'The food was great and service excellent!' };
      
      const result1 = await provider.analyze(request);
      const result2 = await provider.analyze(request);
      
      expect(result1.score).toBe(result2.score);
      expect(result1.category).toBe(result2.category);
    });
  });
  
  describe('Sentiment Detection', () => {
    it('should detect positive sentiment', async () => {
      const result = await provider.analyze({
        content: 'The food was excellent, amazing service, and the best experience!',
      });
      
      expect(result.score).toBeGreaterThan(0);
      expect(result.category).toBe('positive');
    });
    
    it('should detect negative sentiment', async () => {
      const result = await provider.analyze({
        content: 'Terrible food, awful service, worst restaurant ever.',
      });
      
      expect(result.score).toBeLessThan(0);
      expect(result.category).toBe('negative');
    });
    
    it('should detect neutral sentiment', async () => {
      const result = await provider.analyze({
        content: 'It was an ordinary meal at an ordinary place.',
      });
      
      // Without strong keywords, should be near neutral
      expect(result.score).toBeGreaterThan(-0.3);
      expect(result.score).toBeLessThan(0.3);
    });
  });
  
  describe('Star Rating Blending', () => {
    it('should blend with star rating when provided', async () => {
      const withoutRating = await provider.analyze({
        content: 'Average food.',
      });
      
      const with5Star = await provider.analyze({
        content: 'Average food.',
        context: { starRating: 5 },
      });
      
      const with1Star = await provider.analyze({
        content: 'Average food.',
        context: { starRating: 1 },
      });
      
      // 5-star should push score higher
      expect(with5Star.score).toBeGreaterThan(withoutRating.score);
      
      // 1-star should push score lower
      expect(with1Star.score).toBeLessThan(withoutRating.score);
    });
    
    it('should handle mixed signals (positive text, low rating)', async () => {
      const result = await provider.analyze({
        content: 'The food was excellent and amazing!',
        context: { starRating: 1 },
      });
      
      // Should be moderated by low rating
      expect(result.score).toBeLessThan(0.8); // Less positive than without rating
    });
  });
  
  describe('Batch Analysis', () => {
    it('should analyze multiple requests', async () => {
      const requests = [
        { content: 'Great food!' },
        { content: 'Terrible service.' },
        { content: 'Average experience.' },
      ];
      
      const results = await provider.analyzeBatch(requests);
      
      expect(results).toHaveLength(3);
      expect(results[0].score).toBeGreaterThan(0); // Positive
      expect(results[1].score).toBeLessThan(0); // Negative
    });
  });
  
  describe('Metadata', () => {
    it('should include model version and provider', async () => {
      const result = await provider.analyze({ content: 'Test review' });
      
      expect(result.modelVersion).toBe('stub-1.0.0');
      expect(result.provider).toBe('stub');
    });
    
    it('should track processing time', async () => {
      const result = await provider.analyze({ content: 'Test review' });
      
      expect(result.processingTimeMs).toBeDefined();
      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
  
  describe('Health Check', () => {
    it('should return true', async () => {
      const result = await provider.healthCheck();
      
      expect(result).toBe(true);
    });
  });
});

// ============================================================
// SENTIMENT SERVICE TESTS
// ============================================================

describe('Sentiment Service', () => {
  beforeEach(() => {
    // Reset to stub provider
    initializeSentimentProvider(new StubSentimentProvider());
  });
  
  it('should analyze sentiment using configured provider', async () => {
    const result = await analyzeSentiment({
      content: 'Great food and excellent service!',
    });
    
    expect(result.score).toBeGreaterThan(0);
  });
  
  it('should return model version', () => {
    const version = getSentimentModelVersion();
    
    expect(version).toBe('stub-1.0.0');
  });
  
  it('should allow provider initialization', async () => {
    // Create custom provider for testing
    const customProvider = new StubSentimentProvider();
    initializeSentimentProvider(customProvider);
    
    const result = await analyzeSentiment({
      content: 'Test content',
    });
    
    expect(result.provider).toBe('stub');
  });
});

// ============================================================
// EDGE CASES
// ============================================================

describe('Edge Cases', () => {
  let provider: StubSentimentProvider;
  
  beforeEach(() => {
    provider = new StubSentimentProvider();
  });
  
  describe('Empty Content', () => {
    it('should handle empty string', async () => {
      const result = await provider.analyze({ content: '' });
      
      expect(result.score).toBe(0);
    });
    
    it('should handle whitespace only', async () => {
      const result = await provider.analyze({ content: '   ' });
      
      expect(result.score).toBe(0);
    });
  });
  
  describe('Special Characters', () => {
    it('should handle emojis', async () => {
      const result = await provider.analyze({ content: '😀 Great! 👍' });
      
      expect(result.score).toBeGreaterThan(0); // "great" keyword
    });
    
    it('should handle special characters', async () => {
      const result = await provider.analyze({
        content: '!!!??? @#$% ^&*()',
      });
      
      // Should not crash, return neutral
      expect(result.score).toBe(0);
    });
  });
  
  describe('Long Content', () => {
    it('should handle very long text', async () => {
      const longContent = 'Great '.repeat(1000) + 'food';
      const result = await provider.analyze({ content: longContent });
      
      expect(result.score).toBeGreaterThan(0);
    });
  });
  
  describe('Case Sensitivity', () => {
    it('should be case-insensitive', async () => {
      const lower = await provider.analyze({ content: 'excellent' });
      const upper = await provider.analyze({ content: 'EXCELLENT' });
      const mixed = await provider.analyze({ content: 'ExCeLlEnT' });
      
      expect(lower.score).toBe(upper.score);
      expect(lower.score).toBe(mixed.score);
    });
  });
  
  describe('Extreme Ratings', () => {
    it('should handle rating out of expected range', async () => {
      const result = await provider.analyze({
        content: 'Average',
        context: { starRating: 10 }, // Invalid high rating
      });
      
      // Should still be within bounds
      expect(result.score).toBeGreaterThanOrEqual(-1);
      expect(result.score).toBeLessThanOrEqual(1);
    });
    
    it('should handle zero rating', async () => {
      const result = await provider.analyze({
        content: 'Average',
        context: { starRating: 0 },
      });
      
      expect(result.score).toBeGreaterThanOrEqual(-1);
      expect(result.score).toBeLessThanOrEqual(1);
    });
  });
});
