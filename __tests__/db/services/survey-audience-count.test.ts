/** @jest-environment node */
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { getBackofficeDb, getMythoriaDb } from '@/db';
import { campaignService } from '@/db/services/campaigns';

jest.mock('@/db', () => ({
  getBackofficeDb: jest.fn(),
  getMythoriaDb: jest.fn(),
}));

const dialect = new PgDialect();
const studyId = '11111111-1111-4111-8111-111111111111';

describe('campaignService.getSurveyAudienceCount', () => {
  it('excludes recipients already processed in this campaign regardless of status', async () => {
    let processedWhere: SQL | undefined;
    let audienceWhere: SQL | undefined;
    jest.mocked(getBackofficeDb).mockReturnValue({
      select: () => ({
        from: () => ({
          where: (condition: SQL) => {
            processedWhere = condition;
            return Promise.resolve([{ recipientId: 'a1' }, { recipientId: 'a2' }]);
          },
        }),
      }),
    } as never);
    jest.mocked(getMythoriaDb).mockReturnValue({
      select: () => ({
        from: () => ({
          innerJoin: () => ({
            where: (condition: SQL) => {
              audienceWhere = condition;
              return Promise.resolve([{ cnt: 3 }]);
            },
          }),
        }),
      }),
    } as never);

    const total = await campaignService.getSurveyAudienceCount('camp-1', {
      studyId,
      cohortKey: 'C1',
      mode: 'invite',
    });

    expect(total).toBe(3);
    const processed = dialect.sqlToQuery(processedWhere as SQL);
    // Mirrors notification-engine getExcludedRecipientIds: no status filter on the recipient rows.
    expect(processed.sql).not.toContain('"status"');
    expect(processed.sql).toContain('"recipient_type"');
    expect(processed.params).toEqual(expect.arrayContaining(['camp-1', 'user']));
    const audience = dialect.sqlToQuery(audienceWhere as SQL);
    expect(audience.params).toEqual(expect.arrayContaining(['a1', 'a2']));
  });
});
