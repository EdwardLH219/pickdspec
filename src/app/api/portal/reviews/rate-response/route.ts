/**
 * Portal API: Rate Owner Response
 *
 * Uses AI to evaluate an existing owner response against the VERA framework.
 * Returns a score (1-10) and per-dimension feedback.
 *
 * RBAC: User must have access to the requested tenant
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { hasTenantAccess } from '@/server/auth/rbac';
import { db } from '@/server/db';
import OpenAI from 'openai';

const RATE_SYSTEM_PROMPT = `You are an expert hospitality review response analyst. Your role is to evaluate an owner's response to a customer review against the VERA Framework and provide actionable feedback.

## THE VERA FRAMEWORK

### V — Validate
Did the owner acknowledge the SPECIFIC issues raised? Did they mirror the customer's exact complaint points, or use a vague/generic acknowledgment?

### E — Empathise
Did the owner apologise sincerely WITHOUT defensiveness, excuses, or qualification? Did they avoid phrases like "this is surprising", "we always...", or passive voice?

### R — Resolve
Did the owner offer a clear, concrete recovery action? Was it easy for the customer, or did it require effort (e.g., "call us" without clear next steps)?

### A — Assure
Did the owner explain what specific changes they're making to prevent recurrence? Did they close with warmth and reassurance for future readers?

## EVALUATION RULES

1. Score each dimension 1-10 (1 = completely absent, 10 = exemplary).
2. Overall score is weighted: V=25%, E=30%, R=25%, A=20%.
3. Be specific in feedback — quote exact phrases that helped or hurt.
4. Flag critical mistakes: defensiveness, arguing facts, questioning credibility, no recovery offer, corporate-speak.
5. Keep feedback concise — 1-2 sentences per dimension.

## OUTPUT FORMAT

Return ONLY valid JSON with this exact structure (no markdown, no backticks):
{
  "overall": <number 1-10>,
  "validate": { "score": <number 1-10>, "feedback": "<string>" },
  "empathise": { "score": <number 1-10>, "feedback": "<string>" },
  "resolve": { "score": <number 1-10>, "feedback": "<string>" },
  "assure": { "score": <number 1-10>, "feedback": "<string>" },
  "keyStrengths": ["<string>", ...],
  "criticalIssues": ["<string>", ...]
}`;

function buildRatePrompt(params: {
  reviewText: string;
  reviewerName: string;
  rating: number;
  ownerResponse: string;
}): string {
  return `Evaluate this owner response against the VERA Framework.

**Reviewer:** ${params.reviewerName}
**Rating:** ${params.rating}/5 stars
**Customer Review:**
${params.reviewText}

**Owner's Response:**
${params.ownerResponse}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { reviewId, tenantId } = body;

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
        responseText: true,
      },
    });

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    if (!review.responseText) {
      return NextResponse.json({ error: 'No owner response to rate' }, { status: 400 });
    }

    const userPrompt = buildRatePrompt({
      reviewText: review.content,
      reviewerName: review.authorName || 'Guest',
      rating: review.rating ?? 1,
      ownerResponse: review.responseText,
    });

    const client = new OpenAI({ apiKey });

    // Try gpt-4o-mini directly (more reliable for structured JSON output)
    let result;
    try {
      const res = await client.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: RATE_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 600,
        temperature: 0.3,
      });

      const content = res.choices[0]?.message?.content?.trim();
      if (!content) {
        return NextResponse.json({ error: 'AI returned empty analysis' }, { status: 500 });
      }

      // Parse JSON — strip markdown fences if present
      const jsonStr = content.replace(/^```json?\n?/i, '').replace(/\n?```$/i, '').trim();
      result = JSON.parse(jsonStr);
    } catch (err) {
      console.error('[Rate Response] AI error:', err);
      const msg = err instanceof Error ? err.message : 'AI service error';
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Rate Response] Unexpected error:', error);
    const message = error instanceof Error ? error.message : 'Failed to rate response';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
