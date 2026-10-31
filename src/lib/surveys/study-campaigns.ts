import { campaignService } from '@/db/services/campaigns';
import { callSurveyDomain } from '@/services/surveys';
import { SURVEY_AUDIENCE_SOURCE } from '@/lib/schemas/campaigns';
import {
  getSurveyCampaignAsset,
  SURVEY_ASSET_LOCALES,
  type SurveyCampaignKind,
  type SurveyCohortKey,
} from '@/lib/surveys/campaign-assets';
import {
  normalizeStudyDetail,
  SURVEY_REMINDER_DELAY_DAYS,
  SURVEY_STUDY_COHORT_KEYS,
  type SurveyStudyCohortKey,
} from '@/lib/surveys/study-types';

export const SURVEY_CAMPAIGN_DEFAULT_PREFERENCES = ['news', 'inspiration'] as const;

export { SURVEY_REMINDER_DELAY_DAYS };
const DAY_MS = 24 * 60 * 60 * 1000;

export interface CreatedSurveyCampaign {
  campaignId: string;
  /** true when this call created the campaign; false when it already existed. */
  created: boolean;
  /** true when this call (re)linked it to the study cohort in the WebApp. */
  linked: boolean;
}

export interface SurveyCohortCampaigns {
  cohortKey: SurveyStudyCohortKey;
  invite: CreatedSurveyCampaign;
  reminder: CreatedSurveyCampaign;
}

const MODES: SurveyCampaignKind[] = ['invite', 'reminder'];

function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Creates (idempotently) the invite + reminder draft campaigns for the selected cohorts of a
 * study and links them in the WebApp. Cohorts whose campaign is already linked, or which already
 * have a non-cancelled backoffice campaign for the same (study, cohort, mode), are never
 * duplicated; an existing-but-unlinked campaign is linked instead.
 */
export async function createSurveyStudyCampaigns(params: {
  studyId: string;
  cohortKeys?: string[];
  actorEmail: string;
}): Promise<SurveyCohortCampaigns[]> {
  const { studyId, actorEmail } = params;
  const actor = { email: actorEmail };
  const detail = normalizeStudyDetail(await callSurveyDomain('getStudy', { studyId }, actor));
  const { study } = detail;

  const requested = params.cohortKeys?.length ? new Set(params.cohortKeys) : null;
  const cohorts = detail.cohorts.filter(
    (cohort) =>
      (SURVEY_STUDY_COHORT_KEYS as readonly string[]).includes(cohort.cohortKey) &&
      (!requested || requested.has(cohort.cohortKey)),
  );
  if (cohorts.length === 0) {
    throw new Error('Study has no matching cohorts (C1, C2, C3) to create campaigns for');
  }

  const existing = await campaignService.listSurveyCampaigns(studyId);
  const inviteStartAt = toIso(study.opensAt);
  const reminderStartAt = inviteStartAt
    ? new Date(
        new Date(inviteStartAt).getTime() + SURVEY_REMINDER_DELAY_DAYS * DAY_MS,
      ).toISOString()
    : null;
  const endAt = toIso(study.closesAt);
  const results: SurveyCohortCampaigns[] = [];

  for (const cohort of cohorts) {
    const cohortKey = cohort.cohortKey as SurveyStudyCohortKey;
    const partial: Partial<Record<SurveyCampaignKind, CreatedSurveyCampaign>> = {};

    for (const mode of MODES) {
      const linkedId = mode === 'invite' ? cohort.inviteCampaignId : cohort.reminderCampaignId;
      if (linkedId) {
        partial[mode] = { campaignId: linkedId, created: false, linked: false };
        continue;
      }
      const found = existing.find(
        (campaign) =>
          campaign.surveyCohortKey === cohortKey &&
          campaign.surveyAudienceMode === mode &&
          campaign.status !== 'cancelled',
      );
      if (found) {
        partial[mode] = { campaignId: found.id, created: false, linked: true };
        continue;
      }

      const campaign = await campaignService.createCampaign(
        {
          title: `${study.title} - ${cohortKey} ${mode}`.slice(0, 255),
          description: `Survey study ${study.studyKey}, cohort ${cohortKey}, ${mode} email.`,
          audienceSource: SURVEY_AUDIENCE_SOURCE,
          userNotificationPreferences: [...SURVEY_CAMPAIGN_DEFAULT_PREFERENCES],
          startAt: mode === 'reminder' ? reminderStartAt : inviteStartAt,
          endAt,
          surveyStudyId: studyId,
          surveyCohortKey: cohortKey,
          surveyAudienceMode: mode,
        },
        actorEmail,
      );
      for (const locale of SURVEY_ASSET_LOCALES) {
        const asset = getSurveyCampaignAsset(mode, cohortKey as SurveyCohortKey, locale);
        await campaignService.upsertCampaignAsset(campaign.id, {
          language: locale,
          subject: asset.subject,
          htmlBody: asset.htmlBody,
          textBody: asset.textBody,
        });
      }
      existing.push(campaign);
      partial[mode] = { campaignId: campaign.id, created: true, linked: true };
    }

    const invite = partial.invite!;
    const reminder = partial.reminder!;
    if (invite.linked || reminder.linked) {
      await callSurveyDomain(
        'linkCampaigns',
        {
          studyId,
          cohortKey,
          ...(invite.linked ? { inviteCampaignId: invite.campaignId } : {}),
          ...(reminder.linked ? { reminderCampaignId: reminder.campaignId } : {}),
        },
        actor,
      );
    }
    results.push({ cohortKey, invite, reminder });
  }

  return results;
}
