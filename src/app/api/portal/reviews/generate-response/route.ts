/**
 * Portal API: Generate Review Response
 *
 * Uses GPT-5-mini to generate an optimised review response
 * following the VERA framework (Validate, Empathise, Resolve, Assure).
 *
 * RBAC: User must have access to the requested tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { db } from '@/server/db';
import OpenAI from 'openai';

const VERA_SYSTEM_PROMPT = `You are an expert hospitality review response consultant. Your role is to generate the best possible owner response to a customer review, strictly following the VERA Framework.

## THE VERA FRAMEWORK

Every response MUST follow these four steps in order:

### V — VALIDATE
- Acknowledge the SPECIFIC issue(s) the customer raised — do NOT generalise.
- Use "specific mirroring": restate their exact complaint points to show you've read and understood.
- Example: "Waiting 45 minutes for mains and receiving cold food is unacceptable" (NOT "We apologise for your experience").

### E — EMPATHISE
- Apologise sincerely WITHOUT qualification, excuse, or defensiveness.
- NEVER use phrases like "this is surprising", "we always...", "this doesn't reflect our usual standards".
- NEVER use passive voice like "mistakes were made".
- The customer must feel heard, believed, and respected.
- If they are a regular/loyal customer, acknowledge that relationship specifically.

### R — RESOLVE
- Offer ONE clear, concrete recovery action.
- Make it EASY for the customer — don't ask them to jump through hoops.
- Use language like "I'd like to invite you back as my guest" (NOT "free meal" or "voucher").
- Provide a simple contact method (email or platform DM).
- NEVER publish personal phone numbers in the response.

### A — ASSURE
- Explain what specific operational change you are making to prevent recurrence.
- Be specific: "reviewing kitchen workflow", "retraining front-of-house team", "manager will be on the floor during peak".
- This is for future readers as much as the reviewer — it signals responsible management.
- Close with a warm, natural invitation to return.

## CRITICAL RULES

1. TONE: Warm, human, concise. Write like a caring person, not a corporation.
2. LENGTH: 80-150 words. Short paragraphs (2-3 sentences max). No walls of text.
3. STRUCTURE: Use the reviewer's name. Open with empathy. Close with warmth.
4. NEVER argue facts, dispute the customer's account, or question their credibility.
5. NEVER use corporate-speak: "we strive for excellence", "your feedback is valuable to us", "we take all feedback seriously".
6. NEVER start with "Dear valued guest" — use their actual name.
7. For SYSTEMIC/REPEAT complaints: explicitly acknowledge the repeat nature and state immediate corrective action.
8. For RATING-ONLY reviews (no text): thank them for the rating and invite them to share more feedback on their next visit.
9. Remember: 90% of people reading this response are FUTURE customers deciding whether to visit. The response must reassure them.
10. Sign off with a first name (the owner/manager name provided) — not "The Management" or "The Team".

## OUTPUT FORMAT

Return ONLY the response text. No preamble, no explanation, no markdown formatting, no quotes around the response. Just the response as it would be posted on the review platform.`;

function buildUserPrompt(params: {
  reviewText: string;
  reviewerName: string;
  rating: number;
  themes: string[];
  ownerName: string;
  businessName: string;
  isRepeatIssue?: boolean;
}): string {
  const { reviewText, reviewerName, rating, themes, ownerName, businessName, isRepeatIssue } = params;

  const ratingLabel = rating <= 2 ? 'very negative' : rating === 3 ? 'mixed/disappointed' : 'moderate';
  const themeList = themes.length > 0 ? themes.join(', ') : 'general dissatisfaction';

  let prompt = `Generate an owner response for this ${ratingLabel} review.

**Business:** ${businessName}
**Reviewer:** ${reviewerName}
**Rating:** ${rating}/5 stars
**Identified themes:** ${themeList}
**Owner/Manager name to sign as:** ${ownerName}`;

  if (isRepeatIssue) {
    prompt += `\n**IMPORTANT:** This review alleges a REPEAT or SYSTEMIC issue. Address the recurring nature explicitly and state immediate corrective action.`;
  }

  if (reviewText === '[Rating only - no text content]' || !reviewText.trim()) {
    prompt += `\n\n**Note:** This is a rating-only review with no text content. Thank them for the rating and invite feedback.`;
  } else {
    prompt += `\n\n**Review text:**\n${reviewText}`;
  }

  return prompt;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { reviewId, tenantId, ownerName } = body;

    if (!reviewId || !tenantId) {
      return NextResponse.json({ error: 'reviewId and tenantId are required' }, { status: 400 });
    }

    if (!hasTenantAccess(session.user, tenantId)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    const review = await db.review.findFirst({
      where: { id: reviewId, tenantId },
      select: {
        content: true,
        rating: true,
        authorName: true,
        reviewThemes: {
          select: {
            theme: { select: { name: true } },
            sentiment: true,
          },
        },
        tenant: {
          select: { name: true },
        },
      },
    });

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    const themes = review.reviewThemes.map(rt => {
      const sentimentLabel = rt.sentiment === 'NEGATIVE' ? '(negative)' : rt.sentiment === 'POSITIVE' ? '(positive)' : '(neutral)';
      return `${rt.theme.name} ${sentimentLabel}`;
    });

    const hasRepeatLanguage = /repeat|again|every time|always|same.*waiter|same.*staff|weeks? in a row|multiple times/i.test(review.content);

    const signingName = ownerName || session.user.firstName || 'The Manager';
    const businessName = review.tenant.name.replace(/ - Main$/, '');

    const userPrompt = buildUserPrompt({
      reviewText: review.content,
      reviewerName: review.authorName || 'Guest',
      rating: review.rating ?? 1,
      themes,
      ownerName: signingName,
      businessName,
      isRepeatIssue: hasRepeatLanguage,
    });

    const client = new OpenAI({ apiKey });

    console.log('[Generate Response] Calling GPT-5-mini for review:', reviewId);

    const models = ['gpt-5-mini', 'gpt-4o-mini'] as const;
    let generatedResponse: string | null = null;
    let usedModel = models[0];
    let usage: unknown = null;

    for (const model of models) {
      usedModel = model;
      console.log(`[Generate Response] Trying ${model} for review:`, reviewId);

      try {
        const createParams: Record<string, unknown> = {
          model,
          messages: [
            { role: 'system', content: VERA_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
        };

        if (model === 'gpt-5-mini') {
          createParams.max_completion_tokens = 2000;
        } else {
          createParams.max_tokens = 500;
          createParams.temperature = 0.7;
        }

        const response = await client.chat.completions.create(createParams as Parameters<typeof client.chat.completions.create>[0]);

        console.log(`[Generate Response] ${model} finish reason:`, response.choices[0]?.finish_reason);
        console.log(`[Generate Response] ${model} usage:`, JSON.stringify(response.usage));

        const content = response.choices[0]?.message?.content?.trim();
        usage = response.usage;

        if (content && content.length > 10) {
          generatedResponse = content;
          break;
        }

        console.warn(`[Generate Response] ${model} returned empty/short content, trying next model...`);
      } catch (aiError) {
        console.error(`[Generate Response] ${model} error:`, aiError);
        if (model === models[models.length - 1]) {
          const aiMessage = aiError instanceof Error ? aiError.message : 'AI service error';
          return NextResponse.json({ error: `AI service error: ${aiMessage}` }, { status: 502 });
        }
      }
    }

    if (!generatedResponse) {
      console.error('[Generate Response] All models returned empty responses');
      return NextResponse.json({ error: 'AI returned an empty response. Please try again.' }, { status: 500 });
    }

    return NextResponse.json({
      response: generatedResponse,
      model: usedModel,
      framework: 'VERA',
      tokensUsed: (usage as { total_tokens?: number })?.total_tokens ?? 0,
    });
  } catch (error) {
    console.error('[Generate Response] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate response';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
