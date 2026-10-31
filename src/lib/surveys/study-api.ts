import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import {
  requireSurveyPermission,
  surveyErrorStatus,
  type SurveyActor,
  type SurveyPermission,
} from '@/lib/surveys/permissions';
import { SurveyDomainError } from '@/services/surveys';

/** Same-origin check for mutating survey admin routes (mirrors the referral facade). */
export function assertSameOrigin(request: NextRequest): void {
  const origin = request.headers.get('origin');
  const expected = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  if (!origin || origin !== new URL(expected).origin) {
    throw new SurveyDomainError(403, 'Forbidden origin');
  }
}

export function surveyErrorResponse(error: unknown): NextResponse {
  const known = surveyErrorStatus(error);
  if (known) return NextResponse.json({ error: known.message }, { status: known.status });
  if (error instanceof SurveyDomainError) {
    return NextResponse.json(
      { error: error.message, ...(error.code ? { code: error.code } : {}) },
      { status: error.status },
    );
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: 'Invalid input', details: error.flatten() }, { status: 400 });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  console.error('[SurveyStudies]', {
    event: 'admin_request_failed',
    error: error instanceof Error ? error.message : String(error),
  });
  return NextResponse.json({ error: 'Request failed' }, { status: 500 });
}

/**
 * Wraps a survey admin route handler: origin check for mutations, survey permission, uniform
 * error mapping and no-store caching.
 */
export async function runSurveyRoute(
  request: NextRequest,
  permission: SurveyPermission,
  handler: (actor: SurveyActor) => Promise<unknown>,
  options: { status?: number } = {},
): Promise<NextResponse> {
  try {
    if (request.method !== 'GET') assertSameOrigin(request);
    const actor = await requireSurveyPermission(permission);
    const data = await handler(actor);
    return NextResponse.json(
      { data },
      { status: options.status ?? 200, headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return surveyErrorResponse(error);
  }
}
