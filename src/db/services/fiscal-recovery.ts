import { createHash } from 'node:crypto';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { getMythoriaDb } from '@/db';
import { formatFiscalDocumentFullNumber } from '@/lib/fiscal-documents';
import {
  fiscalDocumentEvents,
  fiscalDocuments,
  recoveryTokens,
} from '@/db/schema/fiscal-documents';

const hash = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');

// Canonical JSON recursively sorts object keys; arrays preserve order.
function canonicalPayload(payload: string): string {
  const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([key, item]) => [key, canonicalize(item)]),
      );
    }
    return value;
  };
  return JSON.stringify(canonicalize(JSON.parse(payload)));
}
export async function reserveRecovery({
  id,
  orderId,
  actor,
  payload,
  token,
  expectedUpdatedAt,
}: {
  id: string;
  orderId: string;
  actor: string;
  payload: string;
  token: string;
  expectedUpdatedAt: string;
}) {
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(token))
    throw new Error('A secure caller-generated token is required');
  const expected = new Date(expectedUpdatedAt);
  if (Number.isNaN(expected.getTime())) throw new Error('Invalid expectedUpdatedAt');
  const tokenHash = hash(token);
  const payloadHash = hash(canonicalPayload(payload));
  const expiresAt = new Date(Date.now() + 15 * 60_000);
  await getMythoriaDb().transaction(async (tx) => {
    const [doc] = await tx
      .update(fiscalDocuments)
      .set({
        recoveryTokenHash: tokenHash,
        recoveryOwner: actor,
        recoveryPayloadHash: payloadHash,
        recoveryState: 'reserved',
        recoveryExpiresAt: expiresAt,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(fiscalDocuments.id, id),
          eq(fiscalDocuments.orderId, orderId),
          eq(fiscalDocuments.updatedAt, expected),
          inArray(fiscalDocuments.status, ['pending', 'failed']),
          or(isNull(fiscalDocuments.recoveryState), eq(fiscalDocuments.recoveryState, 'cancelled')),
        ),
      )
      .returning();
    if (!doc) throw new Error('Document is not eligible for recovery reservation');
    await tx
      .insert(recoveryTokens)
      .values({ tokenHash, fiscalDocumentId: id, actor, payloadHash, state: 'reserved' });
    await tx.insert(fiscalDocumentEvents).values({
      fiscalDocumentId: id,
      orderId: doc.orderId,
      eventType: 'recovery_reserved',
      requestPayload: { actor, payloadHash, expiresAt: expiresAt.toISOString() },
    });
  });
  return { expiresAt: expiresAt.toISOString(), payloadHash };
}

type Transition = 'submitted' | 'cancelled' | 'reconciled';
export async function transitionRecovery(input: {
  id: string;
  orderId: string;
  actor: string;
  token: string;
  confirm?: boolean;
  payload: string;
  state: Transition;
  identity?: {
    docType: string;
    docSeries: string;
    docNum: string;
    fullDocNumber?: string;
    atDocCodeId?: string;
    issuedAt: string;
    reason: string;
  };
}) {
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(input.token)) throw new Error('Invalid token');
  if (
    (input.state === 'reconciled') !== Boolean(input.identity) ||
    (input.state === 'reconciled' && input.confirm !== true)
  )
    throw new Error('Explicit confirmation and identity required for reconciliation');
  const tokenHash = hash(input.token);
  const payloadHash = hash(canonicalPayload(input.payload));
  return getMythoriaDb().transaction(async (tx) => {
    const [doc] = await tx
      .select()
      .from(fiscalDocuments)
      .where(eq(fiscalDocuments.id, input.id))
      .for('update');
    if (
      !doc ||
      doc.orderId !== input.orderId ||
      !['pending', 'failed', 'issued'].includes(doc.status) ||
      doc.recoveryTokenHash !== tokenHash ||
      doc.recoveryOwner !== input.actor ||
      doc.recoveryPayloadHash !== payloadHash
    )
      throw new Error('Recovery credentials or state do not match');
    const expected = input.state === 'reconciled' ? 'submitted' : 'reserved';
    if (input.state === 'reconciled' && doc.recoveryState === 'reconciled') {
      const identity = input.identity!;
      if (
        doc.status === 'issued' &&
        doc.docType === identity.docType &&
        doc.docSeries === identity.docSeries &&
        doc.docNum === identity.docNum &&
        (!identity.fullDocNumber || doc.fullDocNumber === identity.fullDocNumber) &&
        (!identity.atDocCodeId || doc.atDocCodeId === identity.atDocCodeId) &&
        doc.issuedAt?.getTime() === new Date(identity.issuedAt).getTime()
      ) {
        const [history] = await tx
          .select()
          .from(recoveryTokens)
          .where(
            and(
              eq(recoveryTokens.tokenHash, tokenHash),
              eq(recoveryTokens.fiscalDocumentId, input.id),
              eq(recoveryTokens.actor, input.actor),
              eq(recoveryTokens.payloadHash, payloadHash),
              eq(recoveryTokens.state, 'reconciled'),
            ),
          );
        if (!history) throw new Error('Recovery token history mismatch');
        return { id: input.id, state: input.state };
      }
      throw new Error('Reconciliation identity conflicts');
    }
    if (doc.recoveryState !== expected || !['pending', 'failed'].includes(doc.status))
      throw new Error('Invalid recovery transition');
    if (
      input.state === 'submitted' &&
      (!doc.recoveryExpiresAt || doc.recoveryExpiresAt <= new Date())
    )
      throw new Error('Recovery reservation expired');
    const identity = input.identity;
    if (
      identity &&
      (!identity.docType.trim() ||
        !identity.docSeries.trim() ||
        !identity.docNum.trim() ||
        !identity.reason.trim() ||
        Number.isNaN(new Date(identity.issuedAt).getTime()))
    )
      throw new Error('Invalid verified identity');
    if (input.state === 'reconciled' && !identity) throw new Error('Verified identity required');
    if (
      identity &&
      doc.docNum &&
      (doc.docType !== identity.docType ||
        doc.docSeries !== identity.docSeries ||
        doc.docNum !== identity.docNum)
    )
      throw new Error('Verified identity conflicts with existing identity');
    const [updated] = await tx
      .update(fiscalDocuments)
      .set({
        recoveryState: input.state,
        updatedAt: new Date(),
        ...(input.state === 'cancelled' ? { recoveryTokenHash: null } : {}),
        ...(identity && input.state === 'reconciled'
          ? {
              docType: identity.docType,
              docSeries: identity.docSeries,
              docNum: identity.docNum,
              fullDocNumber: identity.fullDocNumber || formatFiscalDocumentFullNumber(identity),
              ...(identity.atDocCodeId ? { atDocCodeId: identity.atDocCodeId } : {}),
              issuedAt: new Date(identity.issuedAt),
              status: 'issued' as const,
              nextRetryAt: null,
              lastError: null,
            }
          : {}),
      })
      .where(
        and(
          eq(fiscalDocuments.id, input.id),
          eq(fiscalDocuments.recoveryState, expected),
          eq(fiscalDocuments.recoveryTokenHash, tokenHash),
          eq(fiscalDocuments.orderId, input.orderId),
          eq(fiscalDocuments.recoveryOwner, input.actor),
          eq(fiscalDocuments.recoveryPayloadHash, payloadHash),
          inArray(fiscalDocuments.status, ['pending', 'failed']),
          ...(input.state === 'submitted'
            ? [sql`${fiscalDocuments.recoveryExpiresAt} > now()`]
            : []),
        ),
      )
      .returning();
    if (!updated) throw new Error('Recovery state changed');
    const [history] = await tx
      .update(recoveryTokens)
      .set({ state: input.state })
      .where(
        and(
          eq(recoveryTokens.tokenHash, tokenHash),
          eq(recoveryTokens.fiscalDocumentId, input.id),
          eq(recoveryTokens.actor, input.actor),
          eq(recoveryTokens.payloadHash, payloadHash),
          eq(recoveryTokens.state, expected),
        ),
      )
      .returning();
    if (!history) throw new Error('Recovery token history mismatch');
    await tx.insert(fiscalDocumentEvents).values({
      fiscalDocumentId: input.id,
      orderId: doc.orderId,
      eventType: `recovery_${input.state}`,
      requestPayload: { actor: input.actor, payloadHash, ...(identity ? { identity } : {}) },
    });
    if (identity && input.state === 'reconciled') {
      const fullDocNumber = identity.fullDocNumber || formatFiscalDocumentFullNumber(identity);
      const issuedAt = new Date(identity.issuedAt).toISOString();
      await tx.insert(fiscalDocumentEvents).values({
        fiscalDocumentId: input.id,
        orderId: doc.orderId,
        eventType: 'manual_status_marked_issued',
        requestPayload: {
          adminEmail: input.actor,
          source: 'mcp',
          reason: identity.reason,
          previousStatus: doc.status,
          submitted: {
            docType: identity.docType,
            docSeries: identity.docSeries,
            docNum: identity.docNum,
            fullDocNumber,
            atDocCodeId: identity.atDocCodeId || null,
            issuedAt,
          },
        },
        responsePayload: { status: 'issued', fullDocNumber, issuedAt },
      });
    }
    return { id: input.id, state: input.state };
  });
}
