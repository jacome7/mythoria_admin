export const FISCAL_ATTENTION_THRESHOLD_MINUTES = 15;

export const FISCAL_DOCUMENT_STATUSES = [
  'draft',
  'pending',
  'issuing',
  'issued',
  'failed',
  'voided',
  'credit_note_required',
  'credit_note_issued',
] as const;

export type FiscalDocumentStatus = (typeof FISCAL_DOCUMENT_STATUSES)[number];

export const FISCAL_CUSTOMER_MODES = ['final_consumer', 'keyinvoice_client'] as const;
export type FiscalCustomerMode = (typeof FISCAL_CUSTOMER_MODES)[number];

const SECRET_KEY_PATTERN = /(apikey|api_key|token|session|authorization|password|secret|cookie)/i;

export function isFiscalDocumentStatus(value: string): value is FiscalDocumentStatus {
  return FISCAL_DOCUMENT_STATUSES.includes(value as FiscalDocumentStatus);
}

export function isFiscalCustomerMode(value: string): value is FiscalCustomerMode {
  return FISCAL_CUSTOMER_MODES.includes(value as FiscalCustomerMode);
}

export function computeNeedsAttention(params: {
  status: FiscalDocumentStatus;
  createdAt: string | Date;
  updatedAt: string | Date;
  now?: Date;
}): boolean {
  const now = params.now ?? new Date();
  if (params.status === 'failed' || params.status === 'credit_note_required') {
    return true;
  }

  if (params.status === 'pending') {
    return ageMinutes(params.createdAt, now) > FISCAL_ATTENTION_THRESHOLD_MINUTES;
  }

  if (params.status === 'issuing') {
    return ageMinutes(params.updatedAt, now) > FISCAL_ATTENTION_THRESHOLD_MINUTES;
  }

  return false;
}

export function computeRetryableNow(params: {
  status: FiscalDocumentStatus;
  nextRetryAt?: string | Date | null;
  now?: Date;
}): boolean {
  if (params.status !== 'pending' && params.status !== 'failed') {
    return false;
  }
  if (!params.nextRetryAt) {
    return true;
  }
  const now = params.now ?? new Date();
  return new Date(params.nextRetryAt).getTime() <= now.getTime();
}

export function fiscalStatusLabel(status: FiscalDocumentStatus): string {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function redactFiscalPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactFiscalPayload(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        SECRET_KEY_PATTERN.test(key) ? '[REDACTED]' : redactFiscalPayload(item),
      ]),
    );
  }

  return value;
}

function ageMinutes(value: string | Date, now: Date): number {
  const date = typeof value === 'string' ? new Date(value) : value;
  return (now.getTime() - date.getTime()) / 60000;
}
