/**
 * AI-Powered Activation Draft Generator
 * 
 * Uses OpenAI GPT-4o-mini to generate unique, engaging marketing content
 * for each restaurant based on their specific improvements and brand voice.
 */

import OpenAI from 'openai';
import type { ThemeCategory } from '@prisma/client';
import type {
  ActivationGeneratorInput,
  GeneratedDraft,
  ThemeTemplateConfig,
} from './types';
import { THEME_TEMPLATES } from './templates';

// ============================================================
// CONFIGURATION
// ============================================================

const AI_CONFIG = {
  model: 'gpt-4o-mini',
  maxTokens: 800,
  temperature: 0.7, // Higher for creative writing
};

// ============================================================
// PROMPT TEMPLATES (Guardrails)
// ============================================================

const SYSTEM_PROMPT = `You are a marketing copywriter specializing in restaurant and hospitality content. You write engaging, authentic, and brand-appropriate marketing copy.

STRICT GUIDELINES:
1. Keep content professional but warm and inviting
2. Never make false claims or exaggerate
3. Focus on genuine improvements the restaurant has made
4. Use natural, conversational language
5. Avoid clichés and generic phrases
6. Match the tone to the restaurant's brand (casual vs upscale)
7. Include relevant emojis sparingly (1-3 per post)
8. Keep posts concise and scannable
9. Never mention competitors or make comparisons
10. Always be truthful - only reference actual improvements made

OUTPUT FORMAT: Return ONLY valid JSON with no markdown formatting.`;

function buildGBPPostPrompt(input: ActivationGeneratorInput, config: ThemeTemplateConfig): string {
  return `Generate a Google Business Profile post for this restaurant:

RESTAURANT: ${input.tenantName}
IMPROVEMENT AREA: ${input.themeName} (${config.aspect})
IMPROVEMENT CONTEXT: The restaurant has made genuine improvements to their ${config.aspect} based on customer feedback.
SENTIMENT IMPROVEMENT: ${(input.deltaS * 100).toFixed(0)}% improvement in customer sentiment for this area

TONE: ${input.tenantName.toLowerCase().includes('bistro') || input.tenantName.toLowerCase().includes('fine') ? 'Upscale, sophisticated' : 'Warm, welcoming, approachable'}

REQUIREMENTS:
- 150-250 characters ideal (max 300)
- Include 1-2 relevant emojis
- End with a soft call-to-action
- Include 2-3 relevant hashtags from: ${config.hashtags.join(', ')}

Return JSON:
{
  "content": "The full post text including hashtags",
  "title": "A short 3-5 word title for internal reference"
}`;
}

function buildReviewPromptPrompt(input: ActivationGeneratorInput, config: ThemeTemplateConfig): string {
  return `Generate a review request message template for this restaurant:

RESTAURANT: ${input.tenantName}
IMPROVEMENT AREA: ${input.themeName} (${config.aspect})
CONTEXT: Send to customers after they've dined, asking them to leave a review highlighting the improved ${config.aspect}

TONE: Grateful, not pushy, personal

REQUIREMENTS:
- 2-3 short paragraphs
- Thank them for visiting
- Subtly mention the improvement area they might have noticed
- Polite request for a review (not demanding)
- Include placeholder [Review Link] where the link should go
- Keep under 500 characters

Return JSON:
{
  "content": "The full message template",
  "title": "A short 3-5 word title for internal reference"
}`;
}

function buildOfferPrompt(input: ActivationGeneratorInput, config: ThemeTemplateConfig): string {
  const offerSuggestions = config.offerSuggestions?.slice(0, 3) || [];
  
  return `Generate a promotional offer suggestion for this restaurant:

RESTAURANT: ${input.tenantName}
IMPROVEMENT AREA: ${input.themeName} (${config.aspect})
CONTEXT: Create an offer that celebrates and showcases the improvement made

EXAMPLE OFFER TYPES (for inspiration, create something unique):
${offerSuggestions.map(o => `- ${o.title}: ${o.description}`).join('\n')}

REQUIREMENTS:
- Offer should be realistic and achievable for a restaurant
- Tie it to the improvement area when possible
- Include specific details (percentages, days, conditions)
- Make it compelling but not unprofitable
- Format with emoji for visual appeal

Return JSON:
{
  "content": "Full offer description with terms",
  "title": "Catchy offer name (3-5 words)",
  "offerType": "discount" | "bundle" | "special" | "loyalty",
  "suggestedDuration": "e.g., This weekend, This month, Ongoing"
}`;
}

// ============================================================
// AI GENERATOR CLASS
// ============================================================

export class AIActivationGenerator {
  private client: OpenAI;
  private model: string;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('OpenAI API key is required for AI activation generation');
    }
    this.client = new OpenAI({ apiKey: key });
    this.model = AI_CONFIG.model;
  }

  /**
   * Generate a Google Business Profile post using AI
   */
  async generateGBPPost(input: ActivationGeneratorInput): Promise<GeneratedDraft> {
    const config = THEME_TEMPLATES[input.themeCategory];
    const prompt = buildGBPPostPrompt(input, config);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: AI_CONFIG.maxTokens,
        temperature: AI_CONFIG.temperature,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from OpenAI');

      const parsed = JSON.parse(content) as { content: string; title: string };

      return {
        draftType: 'GBP_POST',
        title: parsed.title || `GBP Post: ${config.aspect} improvement`,
        content: parsed.content,
        metadata: {
          platform: 'google_business_profile',
          characterCount: parsed.content.length,
          generatedBy: 'ai',
          model: this.model,
          themeCategory: input.themeCategory,
          deltaS: input.deltaS,
        },
      };
    } catch (error) {
      console.error('AI GBP post generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate a review prompt message using AI
   */
  async generateReviewPrompt(input: ActivationGeneratorInput): Promise<GeneratedDraft> {
    const config = THEME_TEMPLATES[input.themeCategory];
    const prompt = buildReviewPromptPrompt(input, config);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: AI_CONFIG.maxTokens,
        temperature: AI_CONFIG.temperature,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from OpenAI');

      const parsed = JSON.parse(content) as { content: string; title: string };

      return {
        draftType: 'REVIEW_PROMPT',
        title: parsed.title || `Review Request: ${config.aspect}`,
        content: parsed.content,
        metadata: {
          platform: 'email_sms',
          characterCount: parsed.content.length,
          generatedBy: 'ai',
          model: this.model,
          themeCategory: input.themeCategory,
          deltaS: input.deltaS,
        },
      };
    } catch (error) {
      console.error('AI review prompt generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate an offer suggestion using AI
   */
  async generateOfferSuggestion(input: ActivationGeneratorInput): Promise<GeneratedDraft> {
    const config = THEME_TEMPLATES[input.themeCategory];
    const prompt = buildOfferPrompt(input, config);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        max_tokens: AI_CONFIG.maxTokens,
        temperature: AI_CONFIG.temperature,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from OpenAI');

      const parsed = JSON.parse(content) as {
        content: string;
        title: string;
        offerType?: string;
        suggestedDuration?: string;
      };

      return {
        draftType: 'OFFER_SUGGESTION',
        title: parsed.title || `Offer: ${config.aspect} celebration`,
        content: parsed.content,
        metadata: {
          platform: 'promotion',
          characterCount: parsed.content.length,
          generatedBy: 'ai',
          model: this.model,
          themeCategory: input.themeCategory,
          deltaS: input.deltaS,
          offerType: parsed.offerType,
          suggestedDuration: parsed.suggestedDuration,
        },
      };
    } catch (error) {
      console.error('AI offer suggestion generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate all three draft types for a task
   */
  async generateAllDrafts(input: ActivationGeneratorInput): Promise<GeneratedDraft[]> {
    const drafts: GeneratedDraft[] = [];

    // Generate in parallel for speed
    const [gbpPost, reviewPrompt, offerSuggestion] = await Promise.all([
      this.generateGBPPost(input).catch(err => {
        console.error('GBP post generation failed:', err);
        return null;
      }),
      this.generateReviewPrompt(input).catch(err => {
        console.error('Review prompt generation failed:', err);
        return null;
      }),
      this.generateOfferSuggestion(input).catch(err => {
        console.error('Offer suggestion generation failed:', err);
        return null;
      }),
    ]);

    if (gbpPost) drafts.push(gbpPost);
    if (reviewPrompt) drafts.push(reviewPrompt);
    if (offerSuggestion) drafts.push(offerSuggestion);

    return drafts;
  }
}

// ============================================================
// FACTORY FUNCTION
// ============================================================

let aiGeneratorInstance: AIActivationGenerator | null = null;

/**
 * Get or create the AI activation generator
 * Returns null if OpenAI API key is not configured
 */
export function getAIGenerator(): AIActivationGenerator | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  if (!aiGeneratorInstance) {
    aiGeneratorInstance = new AIActivationGenerator();
  }

  return aiGeneratorInstance;
}

/**
 * Check if AI generation is available
 */
export function isAIGenerationAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
