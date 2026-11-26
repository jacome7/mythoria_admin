'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiBookOpen } from 'react-icons/fi';
import { formatAdminDateTime } from '@/lib/date-utils';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import type { PrintOrderQueueResponse, PrintOrderQueueRow } from '@/lib/print-order-queue';
import { printOrderGroupLabels, printOrderGroups } from '@/lib/print-order-state';

const queuePath = '/tickets/print-orders';
const filters = ['search', 'action', 'purpose', 'sort', 'limit'] as const;
const pagingParams = ['page', 'after', 'before'] as const;

const purposeLabels = {
  customer: 'Customer order',
  staff_proof: 'Staff proof',
  admin_order: 'Admin shipment',
  legacy: 'Legacy ticket',
} satisfies Record<PrintOrderQueueRow['purpose'], string>;

const groupBadges = {
  needs_attention: 'badge-error',
  awaiting_review: 'badge-warning',
  ready: 'badge-success',
  with_supplier: 'badge-info',
  preparing: 'badge-neutral',
  legacy: 'badge-outline',
  closed: 'badge-ghost',
} satisfies Record<PrintOrderQueueRow['nextAction'], string>;

const countryNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });

function queueHref(params: URLSearchParams) {
  const query = params.toString();
  return query ? `${queuePath}?${query}` : queuePath;
}

function QueueFilters({ params }: { params: URLSearchParams }) {
  const router = useRouter();

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const updated = new URLSearchParams();
    for (const name of filters) {
      const field = values.get(name);
      if (
        typeof field === 'string' &&
        field.trim() &&
        !(name === 'sort' && field === 'updated_desc')
      ) {
        updated.set(name, field.trim());
      }
    }
    router.push(queueHref(updated), { scroll: false });
  }

  return (
    <form
      role="search"
      aria-label="Filter print orders"
      onSubmit={applyFilters}
      className="grid gap-3 rounded-box bg-base-100 p-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr_auto] xl:items-end"
    >
      <label className="space-y-1 text-sm font-medium">
        <span className="block">Title or order reference</span>
        <input
          type="search"
          className="input w-full"
          name="search"
          maxLength={255}
          defaultValue={params.get('search') ?? ''}
        />
      </label>
      <label className="space-y-1 text-sm font-medium">
        <span className="block">Next action</span>
        <select className="select w-full" name="action" defaultValue={params.get('action') ?? ''}>
          <option value="">All actions</option>
          {printOrderGroups.map((action) => (
            <option key={action} value={action}>
              {printOrderGroupLabels[action]}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium">
        <span className="block">Purpose</span>
        <select className="select w-full" name="purpose" defaultValue={params.get('purpose') ?? ''}>
          <option value="">All purposes</option>
          {Object.entries(purposeLabels).map(([purpose, label]) => (
            <option key={purpose} value={purpose}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm font-medium">
        <span className="block">Sort by</span>
        <select
          className="select w-full"
          name="sort"
          defaultValue={params.get('sort') ?? 'updated_desc'}
        >
          <option value="updated_desc">Newest update</option>
          <option value="updated_asc">Oldest update</option>
          <option value="title_asc">Title, A–Z</option>
        </select>
      </label>
      <input type="hidden" name="limit" value={params.get('limit') ?? ''} />
      <div className="flex flex-wrap items-center gap-2 md:col-span-2 xl:col-span-1">
        <button type="submit" className="btn btn-primary">
          Apply filters
        </button>
        <Link className="btn btn-ghost" href={queuePath} scroll={false}>
          Clear filters
        </Link>
      </div>
    </form>
  );
}

function CoverThumbnail({ source }: { source: string | null }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="grid h-16 w-12 shrink-0 place-items-center overflow-hidden rounded bg-base-200">
      {source && !failed ? (
        <Image
          src={source}
          width={48}
          height={64}
          unoptimized
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <FiBookOpen aria-hidden="true" className="size-5 text-base-content/50" />
      )}
    </div>
  );
}

function QueueOrder({ order }: { order: PrintOrderQueueRow }) {
  const updatedAt = formatAdminDateTime(order.updatedAt);
  const country = order.destinationCountry;

  return (
    <li className="rounded-box border border-base-300 bg-base-100 px-4 py-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start lg:gap-5">
        <div className="flex min-w-0 items-center gap-3">
          <CoverThumbnail key={order.thumbnailUrl} source={order.thumbnailUrl} />
          <div className="min-w-0">
            <Link
              href={`/tickets/${order.ticketId}`}
              prefetch={false}
              className="link link-hover [overflow-wrap:anywhere] font-semibold"
              aria-label={`${order.title}, ${order.orderReference}, open ticket`}
            >
              {order.title}
            </Link>
            <p className="font-mono text-xs break-all text-base-content/70">
              {order.orderReference}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm sm:grid-cols-3 xl:grid-cols-[1fr_auto_1fr_1.5fr_1fr_1fr]">
          <div>
            <dt className="font-medium text-base-content/70">Purpose</dt>
            <dd>{purposeLabels[order.purpose]}</dd>
          </div>
          <div>
            <dt className="font-medium text-base-content/70">Copies</dt>
            <dd>{order.copies ?? 'Unknown'}</dd>
          </div>
          <div>
            <dt className="font-medium text-base-content/70">Destination</dt>
            <dd>
              {country && /^[A-Z]{2}$/i.test(country)
                ? (countryNames.of(country) ?? country)
                : 'Unknown'}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-base-content/70">Next action</dt>
            <dd>
              <span
                className={`badge badge-soft h-auto min-h-5 whitespace-normal ${groupBadges[order.nextAction]}`}
              >
                {order.actionLabel}
              </span>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-base-content/70">Owner</dt>
            <dd className="break-words">{order.owner ?? 'Unassigned'}</dd>
          </div>
          <div>
            <dt className="font-medium text-base-content/70">Last update</dt>
            <dd>{updatedAt ? <time dateTime={order.updatedAt}>{updatedAt}</time> : 'Unknown'}</dd>
          </div>
        </dl>
      </div>
      <details className="mt-2 text-sm">
        <summary className="w-fit cursor-pointer rounded font-medium text-base-content/75">
          Order states
        </summary>
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          <div>
            <dt className="text-base-content/70">Support ticket</dt>
            <dd>{order.ticketStatus}</dd>
          </div>
          <div>
            <dt className="text-base-content/70">Fulfillment</dt>
            <dd>{order.fulfillmentStatus ?? 'Unavailable'}</dd>
          </div>
          <div>
            <dt className="text-base-content/70">Supplier</dt>
            <dd>{order.vendorStatus ?? 'Unavailable'}</dd>
          </div>
        </dl>
      </details>
    </li>
  );
}

type QueueLoad = { key: string; result: PrintOrderQueueResponse | null };

export function PrintOrderQueue() {
  const { session, loading } = useAdminAuth();
  const searchParams = useSearchParams();
  const [load, setLoad] = useState<QueueLoad>();
  const [attempt, setAttempt] = useState(0);
  const authenticated = Boolean(session?.user) && !loading;

  const filterParams = new URLSearchParams();
  for (const key of filters) {
    const value = searchParams.get(key);
    if (value) filterParams.set(key, value);
  }
  const requestParams = new URLSearchParams(filterParams);
  for (const key of pagingParams) {
    const value = searchParams.get(key);
    if (value) requestParams.set(key, value);
  }
  const query = requestParams.toString();
  const loadKey = `${attempt}:${query}`;

  useEffect(() => {
    if (!authenticated) return;
    const controller = new AbortController();
    const loadOrders = async () => {
      try {
        const url = `/api/tickets/print-orders${query ? `?${query}` : ''}`;
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Print order lookup failed');
        const result: PrintOrderQueueResponse = await response.json();
        if (!controller.signal.aborted) setLoad({ key: loadKey, result });
      } catch {
        if (!controller.signal.aborted) setLoad({ key: loadKey, result: null });
      }
    };
    void loadOrders();
    return () => controller.abort();
  }, [authenticated, loadKey, query]);

  if (loading) return <p role="status">Loading print orders…</p>;
  if (!authenticated) return null;

  const completedLoad = load?.key === loadKey ? load : undefined;
  const result = completedLoad?.result;

  function pageHref(cursor: string, direction: 'before' | 'after', page: number) {
    const params = new URLSearchParams(filterParams);
    params.set(direction, cursor);
    params.set('page', String(page));
    return queueHref(params);
  }

  return (
    <>
      <QueueFilters key={filterParams.toString()} params={filterParams} />
      {!completedLoad && <p role="status">Loading print orders…</p>}
      {completedLoad && !result && (
        <div className="alert alert-error">
          <p role="alert">Print orders could not be loaded.</p>
          <button type="button" className="btn btn-sm" onClick={() => setAttempt(attempt + 1)}>
            Try again
          </button>
          {(requestParams.has('after') || requestParams.has('before')) && (
            <Link className="btn btn-sm" href={queueHref(filterParams)}>
              First page
            </Link>
          )}
        </div>
      )}
      {result && (
        <>
          <nav aria-label="Filter by next action" className="flex flex-wrap gap-2">
            {printOrderGroups.map((action) => {
              const active = filterParams.get('action') === action;
              const params = new URLSearchParams(filterParams);
              if (active) params.delete('action');
              else params.set('action', action);
              return (
                <Link
                  key={action}
                  href={queueHref(params)}
                  scroll={false}
                  aria-current={active ? 'true' : undefined}
                  className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}`}
                >
                  {printOrderGroupLabels[action]}{' '}
                  <span className="badge badge-sm badge-ghost">{result.counts[action]}</span>
                </Link>
              );
            })}
          </nav>
          <p role="status" className="text-sm text-base-content/75">
            {result.pagination.total} {result.pagination.total === 1 ? 'order' : 'orders'}
          </p>
          {result.data.length ? (
            <ul aria-label="Print order results" className="space-y-2">
              {result.data.map((order) => (
                <QueueOrder key={order.ticketId} order={order} />
              ))}
            </ul>
          ) : (
            <p className="rounded-box bg-base-100 p-5">
              {result.pagination.total
                ? 'No print orders found on this page.'
                : 'No print orders match these filters.'}
            </p>
          )}
          {(result.pagination.hasNext ||
            result.pagination.hasPrev ||
            result.pagination.page > 1) && (
            <nav
              aria-label="Print order pages"
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <span className="text-sm">Page {result.pagination.page}</span>
              <div className="flex flex-wrap gap-2">
                {result.pagination.page > 1 && (
                  <Link className="btn btn-sm btn-ghost" href={queueHref(filterParams)}>
                    First page
                  </Link>
                )}
                {result.pagination.previousCursor && (
                  <Link
                    className="btn btn-sm btn-outline"
                    rel="prev"
                    href={pageHref(
                      result.pagination.previousCursor,
                      'before',
                      result.pagination.page - 1,
                    )}
                  >
                    Previous page
                  </Link>
                )}
                {result.pagination.nextCursor && (
                  <Link
                    className="btn btn-sm btn-outline"
                    rel="next"
                    href={pageHref(
                      result.pagination.nextCursor,
                      'after',
                      result.pagination.page + 1,
                    )}
                  >
                    Next page
                  </Link>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </>
  );
}
