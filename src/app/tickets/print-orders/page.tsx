import { Suspense } from 'react';
import { PrintOrderQueue } from '@/components/PrintOrderQueue';
import { TicketNavigation } from '@/components/TicketNavigation';

export default function PrintOrdersPage() {
  return (
    <main className="min-h-screen bg-base-200">
      <div className="container mx-auto space-y-5 p-4">
        <TicketNavigation current="/tickets/print-orders" />
        <h1 className="text-2xl font-bold md:text-3xl">Print orders</h1>
        <Suspense fallback={<p role="status">Loading print orders…</p>}>
          <PrintOrderQueue />
        </Suspense>
      </div>
    </main>
  );
}
