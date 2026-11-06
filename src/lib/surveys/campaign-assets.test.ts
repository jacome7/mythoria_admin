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
      // C1 states the "after your first story" condition; C1 is guaranteed to differ from C2 and C3.
      const [c1, c2, c3] = reminders;
      expect(c1.htmlBody).not.toBe(c2.htmlBody);
      expect(c1.htmlBody).not.toBe(c3.htmlBody);
      expect(c1.textBody).not.toBe(c2.textBody);
      expect(c1.textBody).not.toBe(c3.textBody);
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

  it('words C2 for one or more published stories', () => {
    const invite = getSurveyCampaignAsset('invite', 'C2', 'en-US');
    expect(invite.subject).toBe('How did your story end? Tell us, pick a gift');
    expect(invite.htmlBody).toContain(
      'A few quick questions about your stories, and a free PDF or audiobook as thanks.',
    );
    expect(invite.textBody).toContain(
      "You've written your first Mythoria story, and maybe a few more. Chapter one (at least): done.",
    );
    // Never claim exactly one story: the clause for further stories always follows.
    expect(invite.textBody).not.toContain('your first Mythoria story. Chapter one');
    expect(invite.textBody).not.toContain('about your first story');
    expect(invite.textBody).toContain(
      'pick a free print-ready PDF or narrated audiobook of one of your published stories.',
    );
    const reminder = getSurveyCampaignAsset('reminder', 'C2', 'en-US').textBody;
    expect(reminder).toContain('of one of your published stories');
    expect(reminder).not.toContain('of your story.');
  });

  it('words C3 neutrally for paying customers with zero or many published stories', () => {
    const invite = getSurveyCampaignAsset('invite', 'C3', 'en-US');
    expect(invite.subject).toBe("Help write Mythoria's next chapter, gift inside");
    expect(invite.textBody).toContain(
      'You picked up credits on Mythoria, and that means a lot. Thank you, truly.',
    );
    expect(invite.textBody).toContain(
      'what made you decide to buy, how it went, and what would make Mythoria better for you.',
    );
    expect(invite.textBody).not.toContain("You've created stories");
    expect(invite.htmlBody).not.toContain("You've created stories");
    expect(invite.textBody).not.toContain('backed us along the way');
    expect(invite.textBody).toContain('of one of your stories.');
    expect(invite.textBody).toContain('No published story yet?');
    expect(invite.textBody).toContain('the gift unlocks as soon as you publish one');
    const reminder = getSurveyCampaignAsset('reminder', 'C3', 'en-US').textBody;
    expect(reminder).toContain('the gift unlocks as soon as you publish one');
  });

  it('tells C3 recipients in every locale that the gift works without a published story', () => {
    const phrase: Record<string, string> = {
      'en-US': 'No published story yet?',
      'pt-PT': 'Ainda sem história publicada?',
      'es-ES': '¿Aún no has publicado ninguna?',
      'fr-FR': "Pas encore d'histoire publiée ?",
      'de-DE': 'Noch keine Geschichte veröffentlicht?',
    };
    for (const locale of SURVEY_ASSET_LOCALES) {
      for (const kind of ['invite', 'reminder'] as const) {
        const asset = getSurveyCampaignAsset(kind, 'C3', locale);
        expect(asset.textBody).toContain(phrase[locale]);
        expect(asset.htmlBody).toContain(phrase[locale]);
      }
    }
  });

  it('keeps the C2 gift card on the "one of your published stories" pattern in every locale', () => {
    const phrase: Record<string, string> = {
      'en-US': 'one of your published stories',
      'pt-PT': 'de uma das suas histórias publicadas',
      'es-ES': 'de una de tus historias publicadas',
      'fr-FR': "l'une de vos histoires publiées",
      'de-DE': 'einer deiner veröffentlichten Geschichten',
    };
    for (const locale of SURVEY_ASSET_LOCALES) {
      for (const kind of ['invite', 'reminder'] as const) {
        const asset = getSurveyCampaignAsset(kind, 'C2', locale);
        expect(asset.textBody).toContain(phrase[locale]);
      }
    }
  });
});
