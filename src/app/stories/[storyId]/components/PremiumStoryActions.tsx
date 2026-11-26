'use client';

import Link from 'next/link';
import { AdminPrintOrderEntry } from '@/components/AdminLuluOrderForm';
import type { PremiumEditionSummary } from '@/lib/premium-edition';
import { PremiumPrintActions } from './PremiumPrintActions';

export function PremiumStoryActions({
  storyId,
  edition,
  storyPublished,
  legacyTicketId,
}: {
  storyId: string;
  edition: PremiumEditionSummary;
  storyPublished: boolean;
  legacyTicketId?: string;
}) {
  const revision =
    'revision' in edition && edition.state === 'published' ? edition.revision : undefined;

  return (
    <section className="card bg-base-100 shadow-xl">
      <div className="card-body space-y-3">
        <h2 className="card-title">Premium Edition</h2>
        {revision ? (
          <>
            <p className="text-sm break-all">Revision {revision}</p>
            <Link href={`/stories/${storyId}/read`} className="btn btn-primary">
              Read Premium Edition
            </Link>
            <PremiumPrintActions key={revision} storyId={storyId} revision={revision} />
            {storyPublished && !legacyTicketId && (
              <AdminPrintOrderEntry
                storyId={storyId}
                premiumRevision={revision}
                defaultBookFormat="premium_square"
                defaultBinding="hardcover"
              />
            )}
            {legacyTicketId && (
              <Link href={`/tickets/${legacyTicketId}`} className="btn btn-outline">
                Open print ticket
              </Link>
            )}
          </>
        ) : (
          <p role="status">
            {edition.state === 'queued'
              ? 'The premium edition is in production.'
              : 'A published edition is unavailable.'}
          </p>
        )}
      </div>
    </section>
  );
}
