/**
 * Activation Draft Generator
 * 
 * Generates marketing content drafts for completed high-impact tasks.
 */

import { db } from '@/server/db';
import type { ActivationDraftType } from '@prisma/client';
import type {
  ActivationGeneratorInput,
  GeneratedDraft,
  ActivationGenerationResult,
  TemplateVariables,
} from './types';
import { ACTIVATION_THRESHOLDS } from './types';
import {
  THEME_TEMPLATES,
  GBP_POST_TEMPLATES,
  REVIEW_PROMPT_TEMPLATES,
  OFFER_TEMPLATES,
  pickRandom,
  formatHashtags,
} from './templates';
import { getAIGenerator, isAIGenerationAvailable } from './ai-generator';

/**
 * Check if a task qualifies for activation generation
 */
export function qualifiesForActivation(deltaS: number, fixScore: number): boolean {
  return (
    deltaS >= ACTIVATION_THRESHOLDS.MIN_DELTA_S &&
    fixScore >= ACTIVATION_THRESHOLDS.MIN_FIX_SCORE
  );
}

/**
 * Generate template variables from input
 */
function generateTemplateVariables(input: ActivationGeneratorInput): TemplateVariables {
  const config = THEME_TEMPLATES[input.themeCategory];
  
  return {
    tenantName: input.tenantName,
    themeName: input.themeName,
    themeCategory: input.themeCategory,
    improvement: pickRandom(config.improvements),
    improvementVerb: pickRandom(['improve', 'enhance', 'upgrade', 'refine']),
    aspect: config.aspect,
    positiveAdjective: pickRandom(config.positiveAdjectives),
    callToAction: pickRandom(config.callToActions),
    hashtags: config.hashtags,
  };
}

/**
 * Fill template with variables
 */
function fillTemplate(template: string, vars: TemplateVariables): string {
  return template
    .replace(/{tenantName}/g, vars.tenantName)
    .replace(/{themeName}/g, vars.themeName)
    .replace(/{aspect}/g, vars.aspect)
    .replace(/{improvement}/g, vars.improvement)
    .replace(/{improvementVerb}/g, vars.improvementVerb)
    .replace(/{positiveAdjective}/g, vars.positiveAdjective)
    .replace(/{callToAction}/g, vars.callToAction)
    .replace(/{hashtags}/g, formatHashtags(vars.hashtags));
}

/**
 * Generate Google Business Profile post draft
 */
function generateGBPPost(input: ActivationGeneratorInput, vars: TemplateVariables): GeneratedDraft {
  const template = pickRandom(GBP_POST_TEMPLATES);
  const content = fillTemplate(template, vars);
  
  return {
    draftType: 'GBP_POST',
    title: `GBP Post: ${vars.aspect} improvement`,
    content,
    metadata: {
      characterCount: content.length,
      hashtags: vars.hashtags,
      suggestedPostTime: 'weekday 11am-1pm or 5pm-7pm',
    },
  };
}

/**
 * Generate review prompt message template
 */
function generateReviewPrompt(input: ActivationGeneratorInput, vars: TemplateVariables): GeneratedDraft {
  const template = pickRandom(REVIEW_PROMPT_TEMPLATES);
  const content = fillTemplate(template, vars);
  
  return {
    draftType: 'REVIEW_PROMPT',
    title: `Review Request: ${vars.aspect}`,
    content,
    metadata: {
      suggestedChannel: 'SMS, Email, or WhatsApp',
      suggestedTiming: '24-48 hours after visit',
      mentionTheme: input.themeName,
    },
  };
}

/**
 * Generate offer suggestion based on theme and impact
 */
function generateOfferSuggestion(
  input: ActivationGeneratorInput,
  vars: TemplateVariables
): GeneratedDraft | null {
  const config = THEME_TEMPLATES[input.themeCategory];
  
  // Filter offers that meet the deltaS threshold
  const eligibleOffers = config.offerSuggestions.filter(
    offer => input.deltaS >= offer.relevanceThreshold
  );
  
  if (eligibleOffers.length === 0) {
    return null;
  }
  
  // Pick a random eligible offer
  const offer = pickRandom(eligibleOffers);
  const template = OFFER_TEMPLATES[offer.type];
  
  const content = template
    .replace(/{title}/g, offer.title)
    .replace(/{description}/g, offer.description);
  
  return {
    draftType: 'OFFER_SUGGESTION',
    title: `Offer Idea: ${offer.title}`,
    content,
    metadata: {
      offerType: offer.type,
      offerTitle: offer.title,
      offerDescription: offer.description,
      deltaSTrigger: offer.relevanceThreshold,
      suggestedDuration: '1-2 weeks',
    },
  };
}

/**
 * Generate all activation drafts for a completed task
 * Uses AI (GPT-4o-mini) when available, falls back to templates
 */
export async function generateActivationDrafts(
  input: ActivationGeneratorInput
): Promise<ActivationGenerationResult> {
  try {
    // Validate input qualifies
    if (!qualifiesForActivation(input.deltaS, input.fixScore)) {
      return {
        success: false,
        drafts: [],
        error: `Task does not meet thresholds (deltaS: ${input.deltaS}, fixScore: ${input.fixScore})`,
      };
    }

    // Try AI generation first (unique content per restaurant)
    if (isAIGenerationAvailable()) {
      try {
        const aiGenerator = getAIGenerator();
        if (aiGenerator) {
          console.log(`[Activations] Using AI generation for ${input.tenantName}`);
          const drafts = await aiGenerator.generateAllDrafts(input);
          
          if (drafts.length > 0) {
            return {
              success: true,
              drafts,
              generatedBy: 'ai',
            };
          }
        }
      } catch (aiError) {
        console.error('AI generation failed, falling back to templates:', aiError);
        // Fall through to template generation
      }
    }

    // Fall back to template-based generation
    console.log(`[Activations] Using template generation for ${input.tenantName}`);
    const vars = generateTemplateVariables(input);
    const drafts: GeneratedDraft[] = [];

    // Generate GBP post
    drafts.push(generateGBPPost(input, vars));

    // Generate review prompt
    drafts.push(generateReviewPrompt(input, vars));

    // Generate offer suggestion (if applicable)
    const offerDraft = generateOfferSuggestion(input, vars);
    if (offerDraft) {
      drafts.push(offerDraft);
    }

    return {
      success: true,
      drafts,
      generatedBy: 'template',
    };
  } catch (error) {
    console.error('Failed to generate activation drafts:', error);
    return {
      success: false,
      drafts: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Generate and save activation drafts to the database
 */
export async function createActivationDrafts(
  input: ActivationGeneratorInput
): Promise<{ success: boolean; draftIds: string[]; error?: string }> {
  const result = await generateActivationDrafts(input);
  
  if (!result.success || result.drafts.length === 0) {
    return {
      success: false,
      draftIds: [],
      error: result.error || 'No drafts generated',
    };
  }

  try {
    // Save all drafts to database
    const createdDrafts = await Promise.all(
      result.drafts.map(draft =>
        db.activationDraft.create({
          data: {
            tenantId: input.tenantId,
            taskId: input.taskId,
            themeId: input.themeId,
            draftType: draft.draftType,
            title: draft.title,
            content: draft.content,
            metadata: (draft.metadata || {}) as object,
            deltaS: input.deltaS,
            fixScore: input.fixScore,
            themeCategory: input.themeCategory,
            status: 'DRAFT',
          },
        })
      )
    );

    return {
      success: true,
      draftIds: createdDrafts.map(d => d.id),
    };
  } catch (error) {
    console.error('Failed to save activation drafts:', error);
    return {
      success: false,
      draftIds: [],
      error: error instanceof Error ? error.message : 'Database error',
    };
  }
}

/**
 * Generate drafts for an existing completed task
 * Looks up the task and its FixScore data to generate appropriate content
 */
export async function generateDraftsForTask(taskId: string): Promise<{
  success: boolean;
  draftIds: string[];
  error?: string;
}> {
  // Fetch task with related data
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: {
      tenant: true,
      theme: true,
      fixScores: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!task) {
    return { success: false, draftIds: [], error: 'Task not found' };
  }

  if (task.status !== 'COMPLETED') {
    return { success: false, draftIds: [], error: 'Task is not completed' };
  }

  if (!task.theme) {
    return { success: false, draftIds: [], error: 'Task has no associated theme' };
  }

  const latestFixScore = task.fixScores[0];
  if (!latestFixScore) {
    return { success: false, draftIds: [], error: 'No FixScore found for task' };
  }

  if (latestFixScore.deltaS <= 0) {
    return { success: false, draftIds: [], error: 'Task has no positive sentiment improvement' };
  }

  // Check if drafts already exist for this task
  const existingDrafts = await db.activationDraft.count({
    where: { taskId },
  });

  if (existingDrafts > 0) {
    return { success: false, draftIds: [], error: 'Drafts already exist for this task' };
  }

  // Generate drafts
  return createActivationDrafts({
    taskId: task.id,
    tenantId: task.tenantId,
    themeId: task.themeId!,
    themeCategory: task.theme.category,
    themeName: task.theme.name,
    deltaS: latestFixScore.deltaS,
    fixScore: latestFixScore.fixScore,
    taskTitle: task.title,
    taskDescription: task.description,
    impactNotes: task.impactNotes,
    tenantName: task.tenant.name,
  });
}
