import { describe, expect, it } from '@jest/globals';
import { buildUnfinishedDraftReminderAssets } from './unfinished-draft-assets';

describe('unfinished story reminder assets', () => {
  it('provides a localized email asset for every supported campaign locale', () => {
    const assets = buildUnfinishedDraftReminderAssets();

    expect(assets.map((asset) => asset.language).sort()).toEqual([
      'de-DE',
      'en-US',
      'es-ES',
      'fr-FR',
      'pt-PT',
    ]);
    for (const asset of assets) {
      expect(asset.subject).not.toContain('{{');
      expect(asset.htmlBody).toContain('{{unfinishedStoryLink}}');
      expect(asset.htmlBody).toContain('{{unsubscribeLink}}');
      expect(asset.textBody).toContain('{{physicalAddress}}');
    }
  });
});
