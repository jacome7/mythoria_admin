import {
  findMissingSurveyAssetVariables,
  SurveyAssetValidationError,
} from '@/lib/surveys/asset-requirements';

const validHtml = '<a href="{{surveyLink}}">Go</a> {{unsubscribeLink}} {{{physicalAddress}}}';
const validText = 'Go: {{{surveyLink}}} Unsubscribe: {{ unsubscribeLink }}';

describe('findMissingSurveyAssetVariables', () => {
  it('returns nothing for a compliant asset (double, triple, spaced braces)', () => {
    expect(findMissingSurveyAssetVariables({ htmlBody: validHtml, textBody: validText })).toEqual(
      [],
    );
    expect(
      findMissingSurveyAssetVariables({
        htmlBody: '{{{ surveyLink }}} {{ unsubscribeLink }} {{  physicalAddress}}',
        textBody: '{{surveyLink}} {{{unsubscribeLink}}}',
      }),
    ).toEqual([]);
  });

  it('lists every missing variable per body', () => {
    expect(findMissingSurveyAssetVariables({ htmlBody: '<p>hi</p>', textBody: 'hi' })).toEqual([
      'htmlBody: {{surveyLink}}',
      'htmlBody: {{unsubscribeLink}}',
      'htmlBody: {{physicalAddress}}',
      'textBody: {{surveyLink}}',
      'textBody: {{unsubscribeLink}}',
    ]);
  });

  it('does not require physicalAddress in the text body', () => {
    expect(
      findMissingSurveyAssetVariables({ htmlBody: validHtml, textBody: validText }),
    ).not.toContain('textBody: {{physicalAddress}}');
  });

  it('does not accept lookalike variables', () => {
    const missing = findMissingSurveyAssetVariables({
      htmlBody: '{{surveyLinkX}} {{unsubscribeLink}} {{physicalAddress}}',
      textBody: '{{signUpLink}} {{unsubscribeLink}}',
    });
    expect(missing).toEqual(['htmlBody: {{surveyLink}}', 'textBody: {{surveyLink}}']);
  });
});

describe('SurveyAssetValidationError', () => {
  it('builds a clear message', () => {
    const error = new SurveyAssetValidationError(['htmlBody: {{surveyLink}}'], 'pt-PT');
    expect(error.message).toContain('htmlBody: {{surveyLink}}');
    expect(error.message).toContain('pt-PT');
    expect(error.missing).toEqual(['htmlBody: {{surveyLink}}']);
  });
});
