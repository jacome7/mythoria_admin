import {
  computeNeedsAttention,
  computeRetryableNow,
  redactFiscalPayload,
} from '@/lib/fiscal-documents';

describe('fiscal document utilities', () => {
  const now = new Date('2026-06-14T12:00:00.000Z');

  it('marks failed and credit-note-required documents as needing attention', () => {
    expect(
      computeNeedsAttention({
        status: 'failed',
        createdAt: now,
        updatedAt: now,
        now,
      }),
    ).toBe(true);
    expect(
      computeNeedsAttention({
        status: 'credit_note_required',
        createdAt: now,
        updatedAt: now,
        now,
      }),
    ).toBe(true);
  });

  it('marks old pending and stale issuing documents as needing attention', () => {
    expect(
      computeNeedsAttention({
        status: 'pending',
        createdAt: '2026-06-14T11:44:00.000Z',
        updatedAt: now,
        now,
      }),
    ).toBe(true);
    expect(
      computeNeedsAttention({
        status: 'issuing',
        createdAt: now,
        updatedAt: '2026-06-14T11:44:00.000Z',
        now,
      }),
    ).toBe(true);
  });

  it('only allows pending or failed documents due now to be retried', () => {
    expect(computeRetryableNow({ status: 'pending', nextRetryAt: null, now })).toBe(true);
    expect(
      computeRetryableNow({
        status: 'failed',
        nextRetryAt: '2026-06-14T11:59:00.000Z',
        now,
      }),
    ).toBe(true);
    expect(
      computeRetryableNow({
        status: 'failed',
        nextRetryAt: '2026-06-14T12:01:00.000Z',
        now,
      }),
    ).toBe(false);
    expect(computeRetryableNow({ status: 'issued', nextRetryAt: null, now })).toBe(false);
  });

  it('recursively redacts likely secret payload fields', () => {
    expect(
      redactFiscalPayload({
        apiKey: 'secret',
        nested: {
          sessionId: 'session',
          safe: 'visible',
          items: [{ authorization: 'bearer token' }],
        },
      }),
    ).toEqual({
      apiKey: '[REDACTED]',
      nested: {
        sessionId: '[REDACTED]',
        safe: 'visible',
        items: [{ authorization: '[REDACTED]' }],
      },
    });
  });
});
