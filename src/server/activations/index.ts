/**
 * Activation Drafts Module
 * 
 * Generates and manages marketing activation content for completed tasks.
 * Uses AI (GPT-4o-mini) when available, falls back to templates.
 */

export * from './types';
export * from './templates';
export * from './generator';
export { isAIGenerationAvailable, getAIGenerator, AIActivationGenerator } from './ai-generator';
