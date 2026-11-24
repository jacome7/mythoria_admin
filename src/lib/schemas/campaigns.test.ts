import { describe, expect, it } from '@jest/globals';
import { createCampaignSchema } from './campaigns';

describe('unfinished story draft campaign input', () => {
  it('requires the explicit news email preference', () => {
    expect(
      createCampaignSchema.safeParse({
        title: 'Synthetic draft reminder',
        audienceSource: 'unfinished_story_drafts',
        userNotificationPreferences: ['news'],
      }).success,
    ).toBe(true);
    expect(
      createCampaignSchema.safeParse({
        title: 'Synthetic draft reminder',
        audienceSource: 'unfinished_story_drafts',
        userNotificationPreferences: ['inspiration'],
      }).success,
    ).toBe(false);
  });
});
