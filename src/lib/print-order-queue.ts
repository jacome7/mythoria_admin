import type { PrintOrderGroup } from '@/lib/print-order-state';
import type { TicketStatus } from '@/db/schema/tickets';

export const printOrderPurposes = ['customer', 'staff_proof', 'admin_order', 'legacy'] as const;
export const printOrderSorts = ['updated_desc', 'updated_asc', 'title_asc'] as const;

export type PrintOrderPurpose = (typeof printOrderPurposes)[number];
export type PrintOrderSort = (typeof printOrderSorts)[number];

export interface PrintOrderQueueRow {
  ticketId: string;
  ticketStatus: TicketStatus;
  printRequestId: string | null;
  orderReference: string;
  title: string;
  purpose: PrintOrderPurpose;
  thumbnailUrl: string | null;
  copies: number | null;
  destinationCountry: string | null;
  nextAction: PrintOrderGroup;
  actionLabel: string;
  owner: string | null;
  updatedAt: string;
  fulfillmentStatus: string | null;
  provider: string | null;
  vendorStatus: string | null;
}

export interface PrintOrderQueueResponse {
  data: PrintOrderQueueRow[];
  counts: Record<PrintOrderGroup, number>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
    nextCursor: string | null;
    previousCursor: string | null;
  };
}
