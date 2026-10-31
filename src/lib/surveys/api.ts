import { NextResponse } from 'next/server';
import {
  requireSurveyPermission,
  surveyErrorStatus,
  type SurveyActor,
  type SurveyPermission,
} from '@/lib/surveys/permissions';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Parses `YYYY-MM-DD` or ISO timestamps. `endOfDay` makes date-only values inclusive. */
export function parseDateParam(value: string | null, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const iso = DATE_ONLY_RE.test(value)
    ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
    : value;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function optionalString(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Runs `handler` after verifying the caller holds `permission`.
 * Maps SurveyAdminError to 401/403 and everything else to a generic 500.
 */
export async function withSurveyPermission(
  permission: SurveyPermission,
  handler: (actor: SurveyActor) => Promise<Response>,
): Promise<Response> {
  try {
    const actor = await requireSurveyPermission(permission);
    return await handler(actor);
  } catch (error) {
    const mapped = surveyErrorStatus(error);
    if (mapped) return NextResponse.json({ error: mapped.message }, { status: mapped.status });
    console.error('Survey analytics request failed', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
