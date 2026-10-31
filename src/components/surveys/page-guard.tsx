import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import {
  SurveyAdminError,
  requireSurveyPermission,
  type SurveyActor,
  type SurveyPermission,
} from '@/lib/surveys/permissions';
import { SurveyAccessDenied } from './SurveyUi';

/**
 * Server-side page guard. Returns the actor on success, or a ready-to-render 403 element.
 * Unauthenticated users are redirected to sign-in (callbackUrl = `returnTo`).
 */
export async function guardSurveyPage(
  permission: SurveyPermission,
  returnTo: string,
  heading = 'Surveys',
): Promise<
  { actor: SurveyActor; denied?: undefined } | { actor?: undefined; denied: ReactElement }
> {
  try {
    return { actor: await requireSurveyPermission(permission) };
  } catch (error) {
    if (!(error instanceof SurveyAdminError)) throw error;
    if (error.status === 401) redirect(`/auth/signin?callbackUrl=${encodeURIComponent(returnTo)}`);
    return { denied: <SurveyAccessDenied heading={heading} /> };
  }
}
