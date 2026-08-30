import { eq, sql } from 'drizzle-orm';
import { getMythoriaDb } from '../index';
import { authors, leads } from '../schema';

export type BounceType = 'hard' | 'soft';
type EmailStatus = 'ready' | 'sent' | 'open' | 'click' | 'soft_bounce' | 'hard_bounce' | 'unsub';

export interface MarkEmailBouncedResult {
  normalizedEmail: string;
  bounceType: BounceType;
  found: boolean;
  leadsMatched: number;
  usersMatched: number;
  updated: number;
  unchanged: number;
}

function nextBounceStatus(current: EmailStatus, bounceType: BounceType): EmailStatus {
  if (current === 'unsub' || current === 'hard_bounce') return current;
  return bounceType === 'hard' ? 'hard_bounce' : 'soft_bounce';
}

export async function markEmailBounced(
  email: string,
  bounceType: BounceType,
): Promise<MarkEmailBouncedResult> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error('email must not be empty');

  const db = getMythoriaDb();
  return db.transaction(async (tx) => {
    const [leadRows, userRows] = await Promise.all([
      tx
        .select({ id: leads.id, emailStatus: leads.emailStatus })
        .from(leads)
        .where(sql`lower(${leads.email}) = ${normalizedEmail}`),
      tx
        .select({ authorId: authors.authorId, emailStatus: authors.emailStatus })
        .from(authors)
        .where(sql`lower(${authors.email}) = ${normalizedEmail}`),
    ]);

    let updated = 0;
    let unchanged = 0;
    const now = new Date();

    for (const lead of leadRows) {
      const nextStatus = nextBounceStatus(lead.emailStatus, bounceType);
      if (nextStatus === lead.emailStatus) {
        unchanged++;
        continue;
      }
      await tx
        .update(leads)
        .set({ emailStatus: nextStatus, lastUpdatedAt: now })
        .where(eq(leads.id, lead.id));
      updated++;
    }

    for (const user of userRows) {
      const nextStatus = nextBounceStatus(user.emailStatus, bounceType);
      if (nextStatus === user.emailStatus) {
        unchanged++;
        continue;
      }
      await tx
        .update(authors)
        .set({ emailStatus: nextStatus, emailStatusUpdatedAt: now })
        .where(eq(authors.authorId, user.authorId));
      updated++;
    }

    return {
      normalizedEmail,
      bounceType,
      found: leadRows.length + userRows.length > 0,
      leadsMatched: leadRows.length,
      usersMatched: userRows.length,
      updated,
      unchanged,
    };
  });
}
