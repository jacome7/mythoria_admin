import { getMythoriaDb } from '@/db';
import {
  FiscalDocumentManualIssueError,
  fiscalDocumentAdminService,
} from '@/db/services/fiscal-documents';

jest.mock('@/db', () => ({
  getMythoriaDb: jest.fn(),
}));

const mockGetMythoriaDb = jest.mocked(getMythoriaDb);

function selectQuery(result: unknown[]) {
  return {
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(result),
  };
}

describe('fiscalDocumentAdminService.markIssuedManually', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks duplicate KeyInvoice document identities', async () => {
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce(
          selectQuery([
            {
              id: 'doc-id',
              orderId: 'order-id',
              status: 'failed',
              updatedAt: new Date('2026-07-01T00:00:00.000Z'),
            },
          ]),
        )
        .mockReturnValueOnce(selectQuery([{ id: 'other-doc-id' }])),
      update: jest.fn(),
      insert: jest.fn(),
    };
    mockGetMythoriaDb.mockReturnValue({
      transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    } as never);

    await expect(
      fiscalDocumentAdminService.markIssuedManually('doc-id', {
        docType: '34',
        docSeries: '23',
        docNum: '9',
        issuedAt: new Date('2026-07-01T12:00:00.000Z'),
        reason: 'Verified manually',
        adminEmail: 'admin@mythoria.pt',
        source: 'mythoria-admin',
      }),
    ).rejects.toMatchObject({
      status: 409,
      payload: { code: 'duplicate_document_identity' },
    });
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.insert).not.toHaveBeenCalled();
  });

  it('marks the document issued and writes an audit event', async () => {
    let updateValues: Record<string, unknown> | null = null;
    let eventValues: Record<string, unknown> | null = null;
    const issuedAt = new Date('2026-07-01T12:00:00.000Z');
    const updatedDocument = {
      id: 'doc-id',
      status: 'issued',
      docType: '34',
      docSeries: '23',
      docNum: '9',
      fullDocNumber: '34 23/9',
      issuedAt,
    };
    const tx = {
      select: jest
        .fn()
        .mockReturnValueOnce(
          selectQuery([
            {
              id: 'doc-id',
              orderId: 'order-id',
              status: 'failed',
              updatedAt: new Date('2026-07-01T00:00:00.000Z'),
            },
          ]),
        )
        .mockReturnValueOnce(selectQuery([])),
      update: jest.fn(() => ({
        set: jest.fn((values) => {
          updateValues = values;
          return {
            where: jest.fn().mockReturnValue({
              returning: jest.fn().mockResolvedValue([updatedDocument]),
            }),
          };
        }),
      })),
      insert: jest.fn(() => ({
        values: jest.fn((values) => {
          eventValues = values;
          return Promise.resolve();
        }),
      })),
    };
    mockGetMythoriaDb.mockReturnValue({
      transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    } as never);

    await expect(
      fiscalDocumentAdminService.markIssuedManually('doc-id', {
        docType: '34',
        docSeries: '23',
        docNum: '9',
        issuedAt,
        reason: 'Verified manually',
        adminEmail: 'admin@mythoria.pt',
        source: 'mythoria-admin',
      }),
    ).resolves.toEqual(updatedDocument);

    expect(updateValues).toEqual(
      expect.objectContaining({
        status: 'issued',
        docType: '34',
        docSeries: '23',
        docNum: '9',
        fullDocNumber: '34 23/9',
        lastError: null,
        nextRetryAt: null,
        issuedAt,
      }),
    );
    expect(eventValues).toEqual(
      expect.objectContaining({
        fiscalDocumentId: 'doc-id',
        orderId: 'order-id',
        eventType: 'manual_status_marked_issued',
        requestPayload: expect.objectContaining({
          adminEmail: 'admin@mythoria.pt',
          previousStatus: 'failed',
          reason: 'Verified manually',
        }),
        responsePayload: expect.objectContaining({
          status: 'issued',
          fullDocNumber: '34 23/9',
          issuedAt: issuedAt.toISOString(),
        }),
      }),
    );
  });

  it('returns a typed conflict when the document is not eligible', async () => {
    const tx = {
      select: jest.fn().mockReturnValueOnce(
        selectQuery([
          {
            id: 'doc-id',
            orderId: 'order-id',
            status: 'issued',
            updatedAt: new Date('2026-07-01T00:00:00.000Z'),
          },
        ]),
      ),
      update: jest.fn(),
      insert: jest.fn(),
    };
    mockGetMythoriaDb.mockReturnValue({
      transaction: jest.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    } as never);

    await expect(
      fiscalDocumentAdminService.markIssuedManually('doc-id', {
        docType: '34',
        docSeries: '23',
        docNum: '9',
        issuedAt: new Date('2026-07-01T12:00:00.000Z'),
        reason: 'Verified manually',
        adminEmail: 'admin@mythoria.pt',
        source: 'mythoria-admin',
      }),
    ).rejects.toBeInstanceOf(FiscalDocumentManualIssueError);
  });
});
