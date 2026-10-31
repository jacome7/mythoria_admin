/**
 * Template variables that every survey campaign email must reference. The notification-engine
 * renders survey assets with Handlebars; without these the email would have no survey link, no
 * working unsubscribe, or no postal address (CAN-SPAM / GDPR footer requirements).
 */
export const REQUIRED_SURVEY_HTML_VARIABLES = [
  'surveyLink',
  'unsubscribeLink',
  'physicalAddress',
] as const;
export const REQUIRED_SURVEY_TEXT_VARIABLES = ['surveyLink', 'unsubscribeLink'] as const;

/** Matches `{{name}}` and `{{{name}}}` with optional inner whitespace. */
function referencesVariable(body: string, variable: string): boolean {
  return new RegExp(String.raw`\{\{\{?\s*${variable}\s*\}?\}\}`).test(body);
}

/** Returns human-readable missing items, e.g. `htmlBody: {{surveyLink}}`. Empty when valid. */
export function findMissingSurveyAssetVariables(asset: {
  htmlBody: string;
  textBody: string;
}): string[] {
  const missing: string[] = [];
  for (const variable of REQUIRED_SURVEY_HTML_VARIABLES) {
    if (!referencesVariable(asset.htmlBody ?? '', variable)) {
      missing.push(`htmlBody: {{${variable}}}`);
    }
  }
  for (const variable of REQUIRED_SURVEY_TEXT_VARIABLES) {
    if (!referencesVariable(asset.textBody ?? '', variable)) {
      missing.push(`textBody: {{${variable}}}`);
    }
  }
  return missing;
}

/** Thrown when a survey campaign asset omits required template variables (mapped to HTTP 400). */
export class SurveyAssetValidationError extends Error {
  constructor(
    public readonly missing: string[],
    public readonly language?: string,
  ) {
    super(
      `Survey campaign assets must include ${missing.join(', ')}${language ? ` (${language})` : ''}.`,
    );
    this.name = 'SurveyAssetValidationError';
  }
}
