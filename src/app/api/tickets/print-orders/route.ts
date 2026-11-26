import { authenticateAdmin } from '@/lib/api-helpers';
import { getPrintOrderQueue, printOrderQueueQuery } from '@/services/print-order-queue';

export async function GET(request: Request) {
  const actor = await authenticateAdmin();
  if ('error' in actor) return actor.error;

  const filters = printOrderQueueQuery.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!filters.success)
    return Response.json({ error: 'Invalid print order filters' }, { status: 400 });

  try {
    const result = await getPrintOrderQueue(filters.data);
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Print order queue failed', { error });
    return Response.json({ error: 'Unable to load print orders' }, { status: 500 });
  }
}
