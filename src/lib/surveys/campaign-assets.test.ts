import Handlebars from 'handlebars';
import { findMissingSurveyAssetVariables } from './asset-requirements';
import {
  getSurveyCampaignAsset,
  SURVEY_ASSET_LOCALES,
  type SurveyCampaignKind,
  type SurveyCohortKey,
} from './campaign-assets';

const KINDS: SurveyCampaignKind[] = ['invite', 'reminder'];
const COHORTS: SurveyCohortKey[] = ['C1', 'C2', 'C3'];

const VARIABLES = {
  firstName: 'Ana',
  surveyLink: 'https://mythoria.pt/en-US/survey/abc?x=1&y=2',
  surveyDeadline: 'November 30, 2026',
  surveyMinutes: '3',
  rewardDeadline: 'December 31, 2026',
  privacyLink: 'https://mythoria.pt/en-US/privacy-policy',
  unsubscribeLink: 'https://mythoria.pt/api/e/unsub/user/123',
  physicalAddress: 'Mythoria Lda. | Porto, Portugal',
};

describe('survey campaign assets', () => {
  for (const kind of KINDS) {
    for (const cohort of COHORTS) {
      for (const locale of SURVEY_ASSET_LOCALES) {
        describe(`${kind} / ${cohort} / ${locale}`, () => {
          const asset = getSurveyCampaignAsset(kind, cohort, locale);

          it('has a subject and required footer variables', () => {
            expect(asset.subject.trim()).not.toBe('');
            for (const variable of [
              '{{surveyLink}}',
              '{{unsubscribeLink}}',
              '{{privacyLink}}',
              '{{physicalAddress}}',
            ]) {
              expect(asset.htmlBody).toContain(variable);
            }
            expect(asset.htmlBody).toContain('support@mythoria.pt');
            expect(asset.htmlBody).toContain('{{rewardDeadline}}');
            expect(asset.htmlBody).toContain('{{surveyDeadline}}');
            expect(asset.htmlBody).toContain('{{surveyMinutes}}');
            expect(asset.textBody).toContain('{{{surveyDeadline}}}');
            expect(asset.textBody).toContain('{{{surveyMinutes}}}');
            expect(asset.textBody).toContain('{{{surveyLink}}}');
            expect(asset.textBody).toContain('{{{unsubscribeLink}}}');
          });

          it('passes the survey asset validation rule', () => {
            expect(findMissingSurveyAssetVariables(asset)).toEqual([]);
          });

          it('highlights the gift in a card above the call-to-action', () => {
            const giftIndex = asset.htmlBody.indexOf("data-gift-card='true'");
            const ctaIndex = asset.htmlBody.indexOf("<a href='{{surveyLink}}'");
            expect(giftIndex).toBeGreaterThan(-1);
            expect(giftIndex).toBeLessThan(ctaIndex);
          });

          it('never hard-codes the survey duration', () => {
            const html = Handlebars.compile(asset.htmlBody)({ ...VARIABLES, surveyMinutes: '' });
            expect(html).not.toMatch(/\d\s*(minutes|minutos|Minuten)/i);
          });

          it('compiles and renders with Handlebars', () => {
            const html = Handlebars.compile(asset.htmlBody)(VARIABLES);
            const text = Handlebars.compile(asset.textBody)(VARIABLES);
            expect(html).not.toContain('{{');
            expect(text).not.toContain('{{');
            expect(html).toContain('Ana');
            expect(html).toContain('December 31, 2026');
            expect(text).toContain('https://mythoria.pt/en-US/survey/abc?x=1&y=2');
            expect(text).toContain(VARIABLES.unsubscribeLink);
          });

          it('renders without optional firstName and rewardDeadline', () => {
            const vars = { ...VARIABLES, firstName: '', rewardDeadline: '' };
            const html = Handlebars.compile(asset.htmlBody)(vars);
            const text = Handlebars.compile(asset.textBody)(vars);
            expect(html).not.toContain('{{');
            expect(html).not.toContain('Ana');
            expect(html).not.toContain('December 31, 2026');
            expect(text).not.toContain('undefined');
          });
        });
      }
    }
  }

  it('uses a shared reminder subject but a cohort-specific gift card', () => {
    for (const locale of SURVEY_ASSET_LOCALES) {
      const reminders = COHORTS.map((c) => getSurveyCampaignAsset('reminder', c, locale));
      expect(new Set(reminders.map((r) => r.subject)).size).toBe(1);
      expect(new Set(reminders.map((r) => r.htmlBody)).size).toBe(3);
      expect(new Set(reminders.map((r) => r.textBody)).size).toBe(3);
    }
  });

  it('uses distinct invite copy per cohort', () => {
    for (const locale of SURVEY_ASSET_LOCALES) {
      const subjects = COHORTS.map((c) => getSurveyCampaignAsset('invite', c, locale).subject);
      expect(new Set(subjects).size).toBe(3);
    }
    expect(getSurveyCampaignAsset('invite', 'C1', 'en-US').subject).toBe(
      'Every story needs a first page (and a gift)',
    );
  });

  it('tells C1 the gift unlocks after publishing a first story', () => {
    const c1 = getSurveyCampaignAsset('invite', 'C1', 'en-US').textBody;
    const c2 = getSurveyCampaignAsset('invite', 'C2', 'en-US').textBody;
    expect(c1).toContain('once you publish your first story');
    expect(c2).not.toContain('once you publish your first story');
  });
});
