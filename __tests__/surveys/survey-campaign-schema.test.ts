import { createCampaignSchema, updateCampaignSchema } from '@/lib/schemas/campaigns';

const studyId = '11111111-1111-4111-8111-111111111111';

describe('survey campaign schemas', () => {
  const base = {
    title: 'Study C1 invite',
    audienceSource: 'survey_invitations' as const,
    surveyStudyId: studyId,
    surveyCohortKey: 'C1' as const,
    surveyAudienceMode: 'invite' as const,
  };

  it('accepts a complete survey campaign', () => {
    expect(createCampaignSchema.safeParse(base).success).toBe(true);
  });

  it.each(['surveyStudyId', 'surveyCohortKey', 'surveyAudienceMode'] as const)(
    'requires %s for survey campaigns',
    (field) => {
      const result = createCampaignSchema.safeParse({ ...base, [field]: undefined });
      expect(result.success).toBe(false);
    },
  );

  it('rejects unknown cohorts and modes', () => {
    expect(createCampaignSchema.safeParse({ ...base, surveyCohortKey: 'U1' }).success).toBe(false);
    expect(createCampaignSchema.safeParse({ ...base, surveyAudienceMode: 'blast' }).success).toBe(
      false,
    );
  });

  it('rejects self-print attachments on survey campaigns', () => {
    expect(createCampaignSchema.safeParse({ ...base, attachmentType: 'selfprint' }).success).toBe(
      false,
    );
  });

  it('rejects survey fields on non-survey campaigns', () => {
    const result = createCampaignSchema.safeParse({
      title: 'Normal',
      audienceSource: 'users',
      surveyStudyId: studyId,
    });
    expect(result.success).toBe(false);
  });

  it('keeps non-survey campaigns valid without survey fields', () => {
    expect(
      createCampaignSchema.safeParse({ title: 'Normal', audienceSource: 'both' }).success,
    ).toBe(true);
  });

  it('does not allow switching a campaign to the survey audience source via update', () => {
    expect(updateCampaignSchema.safeParse({ audienceSource: 'survey_invitations' }).success).toBe(
      false,
    );
    expect(updateCampaignSchema.safeParse({ audienceSource: 'users' }).success).toBe(true);
  });
});

describe('campaign schedule window', () => {
  const start = '2026-11-10T10:00:00.000Z';
  const earlier = '2026-11-01T00:00:00.000Z';

  it('rejects end <= start on update and create', () => {
    expect(updateCampaignSchema.safeParse({ startAt: start, endAt: start }).success).toBe(false);
    expect(updateCampaignSchema.safeParse({ startAt: start, endAt: earlier }).success).toBe(false);
    expect(
      createCampaignSchema.safeParse({
        title: 'T',
        audienceSource: 'leads',
        startAt: start,
        endAt: earlier,
      }).success,
    ).toBe(false);
  });

  it('accepts ordered, partial and null dates', () => {
    expect(
      updateCampaignSchema.safeParse({ startAt: start, endAt: '2026-11-11T00:00:00.000Z' }).success,
    ).toBe(true);
    expect(updateCampaignSchema.safeParse({ endAt: start }).success).toBe(true);
    expect(updateCampaignSchema.safeParse({ startAt: null, endAt: null }).success).toBe(true);
  });
});
