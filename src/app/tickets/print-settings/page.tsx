'use client';

import { PrintSettings } from '@/components/PrintFulfillment';
import { TicketNavigation } from '@/components/TicketNavigation';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

export default function PrintSettingsPage() {
  const { session, loading } = useAdminAuth();

  if (!session?.user && !loading) return null;

  return (
    <main className="min-h-screen bg-base-200">
      <div className="container mx-auto max-w-4xl space-y-5 p-4">
        <TicketNavigation current="/tickets/print-settings" />
        <h1 className="text-2xl font-bold md:text-3xl">Print settings</h1>
        {loading ? <p role="status">Loading print settings…</p> : <PrintSettings />}
      </div>
    </main>
  );
}
