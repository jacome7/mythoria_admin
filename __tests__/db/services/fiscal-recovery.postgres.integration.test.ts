/** @jest-environment node */
import { randomUUID } from 'node:crypto';
import { readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql, type SQL } from 'drizzle-orm';
import { getMythoriaDb } from '@/db';
import { reserveRecovery, transitionRecovery } from '@/db/services/fiscal-recovery';
import { fiscalDocumentAdminService } from '@/db/services/fiscal-documents';
import { fiscalDocuments } from '@/db/schema/fiscal-documents';

jest.mock('@/db', () => ({ getMythoriaDb: jest.fn() }));

// Opt in ONLY to a private local Unix socket. Never read app DB environment variables.
const socket = process.env.KEYINVOICE_RECOVERY_TEST_SOCKET;
const localSuite = socket ? describe : describe.skip;
const actor = 'legacy-admin';
const payload = JSON.stringify({ method: 'insertDocument', DocType: '34', DocLines: [] });
const authorId = '00000000-0000-0000-0000-000000000001';

localSuite('KeyInvoice recovery: disposable PostgreSQL migration and concurrency', () => {
  let guards: {
    issueClaimPredicate: (id: string) => SQL | undefined;
    issueFence: (document: { id: string; attemptCount: number }) => SQL | undefined;
  };
  let pool: Pool;
  let database: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    if (
      !socket ||
      !/^\/home\/andre\/\.cache\/keyinvoice-recovery-pg-test-[a-zA-Z0-9-]+\/socket$/.test(socket)
    ) {
      throw new Error('Only an explicitly isolated test socket is permitted');
    }
    if (
      realpathSync(socket) !== socket ||
      readFileSync(join(socket, '..', 'TEST_ONLY'), 'utf8') !== 'keyinvoice-local-test-only\n'
    ) {
      throw new Error('Missing local-only test sentinel');
    }
    guards = await import(
      join(
        process.cwd(),
        '..',
        'Mythoria-webapp',
        'src',
        'db',
        'services',
        'fiscal-document-guards',
      )
    );
    pool = new Pool({
      host: socket,
      user: 'postgres',
      database: 'keyinvoice_recovery_local_test',
      port: 5432,
      ssl: false,
      max: 6,
      connectionTimeoutMillis: 3000,
    });
    database = drizzle(pool);
    jest.mocked(getMythoriaDb).mockReturnValue(database as never);
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public');
    await pool.query(
      'CREATE TABLE authors (author_id uuid PRIMARY KEY); CREATE TABLE payment_orders (order_id uuid PRIMARY KEY)',
    );
    const migrationRoot = join(process.cwd(), '..', 'Mythoria-webapp', 'drizzle');
    for (const file of [
      '0028_keyinvoice_fiscal_documents.sql',
      '0046_keyinvoice_recovery_reservation.sql',
      '0047_keyinvoice_recovery_state_check.sql',
      '0048_keyinvoice_recovery_ledger.sql',
    ]) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(readFileSync(join(migrationRoot, file), 'utf8'));
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  });

  beforeEach(async () => {
    jest.mocked(getMythoriaDb).mockReturnValue(database as never);
    await pool.query(
      'TRUNCATE recovery_tokens, fiscal_document_events, fiscal_documents, keyinvoice_customers, payment_orders, authors CASCADE',
    );
    await pool.query('INSERT INTO authors(author_id) VALUES ($1)', [authorId]);
  });
  afterAll(async () => {
    if (pool) await pool.end();
  });

  async function fixture(status = 'failed') {
    const id = randomUUID(),
      orderId = randomUUID();
    await pool.query('INSERT INTO payment_orders(order_id) VALUES ($1)', [orderId]);
    await pool.query(
      "INSERT INTO fiscal_documents(id,order_id,author_id,status,doc_type,customer_mode,updated_at) VALUES ($1,$2,$3,$4,'34','final_consumer',$5)",
      [id, orderId, authorId, status, new Date('2026-11-09T18:00:00.000Z')],
    );
    const doc = (
      await database.select().from(fiscalDocuments).where(eq(fiscalDocuments.id, id))
    )[0];
    return {
      id,
      orderId,
      actor,
      token: randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, ''),
      payload,
      expectedUpdatedAt: doc.updatedAt.toISOString(),
    };
  }
  async function state(id: string) {
    return (await database.select().from(fiscalDocuments).where(eq(fiscalDocuments.id, id)))[0];
  }
  async function workerClaim(id: string) {
    return database
      .update(fiscalDocuments)
      .set({
        status: 'issuing',
        attemptCount: sql`${fiscalDocuments.attemptCount} + 1`,
        updatedAt: new Date(),
      })
      .where(guards.issueClaimPredicate(id))
      .returning();
  }
  const identity = {
    docType: '34',
    docSeries: '23',
    docNum: '900001',
    fullDocNumber: 'FR FR26/900001',
    atDocCodeId: 'LOCAL-TEST-AT',
    issuedAt: '2026-11-09T18:00:00.000Z',
    reason: 'Verified local test only',
  };

  it('migrates and uniquely guards identities including null versus empty series', async () => {
    const first = await fixture(),
      second = await fixture();
    await pool.query("UPDATE fiscal_documents SET doc_num='12',doc_series=NULL WHERE id=$1", [
      first.id,
    ]);
    await expect(
      pool.query("UPDATE fiscal_documents SET doc_num='12',doc_series='' WHERE id=$1", [second.id]),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('fails the identity migration closed when pre-existing duplicates are present', async () => {
    const first = await fixture(),
      second = await fixture();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DROP INDEX fiscal_documents_remote_identity_unique');
      await client.query(
        "UPDATE fiscal_documents SET doc_num='duplicate', doc_series='23' WHERE id IN ($1,$2)",
        [first.id, second.id],
      );
      await expect(
        client.query(
          readFileSync(
            join(
              process.cwd(),
              '..',
              'Mythoria-webapp',
              'drizzle',
              '0048_keyinvoice_recovery_ledger.sql',
            ),
            'utf8',
          ),
        ),
      ).rejects.toMatchObject({
        code: 'P0001',
        message: expect.stringContaining('Duplicate fiscal document'),
      });
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
    expect((await state(first.id)).docNum).toBeNull();
  });

  it('serializes simultaneous reservations with exactly one winner', async () => {
    const input = await fixture();
    const outcomes = await Promise.allSettled([
      reserveRecovery(input),
      reserveRecovery({ ...input, token: 'z'.repeat(64) }),
    ]);
    expect(outcomes.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
    expect((await pool.query('SELECT * FROM recovery_tokens')).rowCount).toBe(1);
    expect((await state(input.id)).recoveryState).toBe('reserved');
  });

  it('serializes the actual production claim predicate with recovery reservation', async () => {
    const input = await fixture();
    const outcomes = await Promise.allSettled([reserveRecovery(input), workerClaim(input.id)]);
    const recovered = outcomes[0].status === 'fulfilled';
    const worker = outcomes[1];
    expect(worker.status).toBe('fulfilled');
    if (worker.status !== 'fulfilled') throw worker.reason;
    expect(Number(recovered) + Number(worker.value.length === 1)).toBe(1);
  });

  it('does not seize an issuing worker even when its timestamp is stale', async () => {
    const input = await fixture('issuing');
    await expect(reserveRecovery(input)).rejects.toThrow('not eligible');
    expect(await workerClaim(input.id)).toHaveLength(0);
  });

  it('holds an expired reservation until explicit pre-submission cancellation', async () => {
    const input = await fixture();
    await reserveRecovery(input);
    await pool.query(
      "UPDATE fiscal_documents SET recovery_expires_at=now()-interval '1 hour' WHERE id=$1",
      [input.id],
    );
    expect(await workerClaim(input.id)).toHaveLength(0);
    await expect(transitionRecovery({ ...input, state: 'submitted' })).rejects.toThrow('expired');
    await transitionRecovery({ ...input, state: 'cancelled' });
    expect(await workerClaim(input.id)).toHaveLength(1);
  });

  it('issues one submit permit and blocks cancellation and worker acquisition afterward', async () => {
    const input = await fixture();
    await reserveRecovery(input);
    const results = await Promise.allSettled([
      transitionRecovery({ ...input, state: 'submitted' }),
      transitionRecovery({ ...input, state: 'submitted' }),
    ]);
    expect(results.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
    await expect(transitionRecovery({ ...input, state: 'cancelled' })).rejects.toThrow();
    await pool.query(
      "UPDATE fiscal_documents SET recovery_expires_at=now()-interval '1 hour' WHERE id=$1",
      [input.id],
    );
    expect(await workerClaim(input.id)).toHaveLength(0);
  });

  it('rejects wrong owner, payload and token without state changes', async () => {
    const input = await fixture();
    await reserveRecovery(input);
    for (const patch of [{ actor: 'wrong' }, { token: 'z'.repeat(64) }, { payload: '{}' }]) {
      await expect(
        transitionRecovery({ ...input, ...patch, state: 'submitted' }),
      ).rejects.toThrow();
    }
    expect((await state(input.id)).recoveryState).toBe('reserved');
  });

  it('reconciles once, permits identical replay and preserves a manual-issued audit event', async () => {
    const input = await fixture();
    await reserveRecovery(input);
    await transitionRecovery({ ...input, state: 'submitted' });
    const request = { ...input, state: 'reconciled' as const, confirm: true, identity };
    await transitionRecovery(request);
    await transitionRecovery(request);
    const doc = await state(input.id);
    expect(doc.status).toBe('issued');
    expect(doc.docNum).toBe(identity.docNum);
    expect(doc.fullDocNumber).toBe(identity.fullDocNumber);
    expect(doc.atDocCodeId).toBe(identity.atDocCodeId);
    expect(doc.nextRetryAt).toBeNull();
    expect(doc.lastError).toBeNull();
    expect(
      (
        await pool.query(
          "SELECT * FROM fiscal_document_events WHERE event_type='manual_status_marked_issued'",
        )
      ).rowCount,
    ).toBe(1);
    await expect(
      transitionRecovery({ ...request, identity: { ...identity, docNum: 'other' } }),
    ).rejects.toThrow('conflicts');
  });

  it('rolls back a competing identity reconciliation and leaves the losing operation held', async () => {
    const first = await fixture(),
      second = await fixture();
    for (const input of [first, second]) {
      await reserveRecovery(input);
      await transitionRecovery({ ...input, state: 'submitted' });
    }
    const results = await Promise.allSettled(
      [first, second].map((input) =>
        transitionRecovery({ ...input, state: 'reconciled', confirm: true, identity }),
      ),
    );
    expect(results.filter((value) => value.status === 'fulfilled')).toHaveLength(1);
    const docs = await database.select().from(fiscalDocuments);
    expect(docs.filter((doc) => doc.status === 'issued')).toHaveLength(1);
    expect(docs.filter((doc) => doc.recoveryState === 'submitted')).toHaveLength(1);
  });

  it('rolls back document and token ledger if audit persistence fails', async () => {
    const input = await fixture();
    await reserveRecovery(input);
    await pool.query(
      "ALTER TABLE fiscal_document_events ADD CONSTRAINT test_reject_submission CHECK(event_type <> 'recovery_submitted')",
    );
    try {
      await expect(transitionRecovery({ ...input, state: 'submitted' })).rejects.toThrow();
    } finally {
      await pool.query('ALTER TABLE fiscal_document_events DROP CONSTRAINT test_reject_submission');
    }
    expect((await state(input.id)).recoveryState).toBe('reserved');
    expect((await pool.query('SELECT state FROM recovery_tokens')).rows[0].state).toBe('reserved');
  });

  it('retains cancelled token history and prevents replay by an old worker generation', async () => {
    const input = await fixture();
    await reserveRecovery(input);
    await transitionRecovery({ ...input, state: 'cancelled' });
    const current = await state(input.id);
    await expect(
      reserveRecovery({ ...input, expectedUpdatedAt: current.updatedAt.toISOString() }),
    ).rejects.toThrow();
    expect((await state(input.id)).recoveryState).toBe('cancelled');
    const claimed = await workerClaim(input.id);
    const stale = { id: input.id, attemptCount: claimed[0].attemptCount - 1 };
    const writes = await database
      .update(fiscalDocuments)
      .set({ lastError: 'must-not-write' })
      .where(guards.issueFence(stale))
      .returning();
    expect(writes).toHaveLength(0);
  });

  it('prevents the Admin UI manual service from bypassing an active reservation', async () => {
    const input = await fixture();
    await reserveRecovery(input);
    await expect(
      fiscalDocumentAdminService.markIssuedManually(input.id, {
        ...identity,
        issuedAt: new Date(identity.issuedAt),
        adminEmail: 'local-test@mythoria.pt',
        source: 'mythoria-admin',
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect((await state(input.id)).status).toBe('failed');
  });
});
