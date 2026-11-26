/** @jest-environment node */
import { getBackofficeDb, getMythoriaDb } from '@/db';
import { LegacyPrintConflict, TicketService } from '@/lib/ticketing/service';

jest.mock('@/db', () => ({
  getBackofficeDb: jest.fn(),
  getMythoriaDb: jest.fn(),
}));

describe('print ticket ownership', () => {
  function lockedTicket(metadata: unknown, status = 'open') {
    const lock = jest.fn().mockResolvedValue([{ metadata, status }]);
    const set = jest.fn().mockReturnValue({ where: jest.fn().mockResolvedValue([]) });
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ for: lock }) }) }),
      update: () => ({ set }),
    };
    jest.mocked(getBackofficeDb).mockReturnValue({
      transaction: (run: (db: typeof tx) => unknown) => run(tx),
    } as never);
    return { set, lock };
  }
  it('serializes claims and preserves legacy metadata', async () => {
    const { set, lock } = lockedTicket('{"storyId":"story"}');
    expect(await TicketService.setPrintOwner('ticket', 'Manager@example.com', true)).toBe(
      'updated',
    );
    expect(lock).toHaveBeenCalledWith('update');
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { storyId: 'story', printOwner: 'manager@example.com' },
      }),
    );
  });
  it('permits only the current owner to release ownership and preserves other fields', async () => {
    const { set } = lockedTicket({ storyId: 'story', printOwner: 'manager@example.com' });
    expect(await TicketService.setPrintOwner('ticket', 'other@example.com', false)).toBe('taken');
    expect(set).not.toHaveBeenCalled();
    expect(await TicketService.setPrintOwner('ticket', 'manager@example.com', false)).toBe(
      'updated',
    );
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ metadata: { storyId: 'story' } }));
  });
  it('preserves an unreadable existing record on a write', async () => {
    const { set } = lockedTicket('invalid-json');
    await expect(
      TicketService.setPrintOwner('ticket', 'manager@example.com', true),
    ).rejects.toThrow('metadata');
    expect(set).not.toHaveBeenCalled();
  });
});

describe('legacy print path reservation', () => {
  const storyId = 'story';
  const ticketId = 'ticket';
  const date = new Date('2026-11-26T10:00:00Z');
  const data = {
    storyId,
    userId: 'author',
    printRequestId: 'order',
    printFormat: 'paperback' as const,
    numberOfCopies: 1,
    orderKind: 'admin_order' as const,
    bookFormat: 'standard_a5' as const,
    requestedBy: 'staff@example.test',
    legacyTicketId: ticketId,
  };

  function serializedLegacyTicket(existingFulfillmentLink = false) {
    let row = {
      id: ticketId,
      category: 'print_request',
      status: 'open',
      createdAt: date,
      metadata: { storyId },
    };
    let tail: Promise<unknown> = Promise.resolve();
    const lock = jest.fn(async () => [row]);
    const update = jest.fn((fields: Partial<typeof row>) => {
      row = { ...row, ...fields };
      return { where: () => ({ returning: async () => [row] }) };
    });
    const tx = {
      execute: async () => [],
      select: () => ({
        from: () => ({
          where: () => ({ limit: () => Object.assign(Promise.resolve([]), { for: lock }) }),
        }),
      }),
      update: () => ({ set: update }),
    };
    jest.mocked(getBackofficeDb).mockReturnValue({
      transaction: (run: (db: typeof tx) => Promise<unknown>) => {
        const result = tail.then(() => run(tx));
        tail = result.catch(() => undefined);
        return result;
      },
    } as never);
    jest.mocked(getMythoriaDb).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => (existingFulfillmentLink ? [{ id: 'existing-paid-order' }] : []),
          }),
        }),
      }),
    } as never);
    return { lock, update };
  }

  it('blocks an upgrade and a second send after the same legacy ticket was reserved', async () => {
    const { lock, update } = serializedLegacyTicket();
    const [manual, upgrade] = await Promise.allSettled([
      TicketService.reserveLegacyPrintDispatch(ticketId, storyId, 'original-request'),
      TicketService.createOrLinkAdminPrintTicket(data),
    ]);
    expect(manual.status).toBe('fulfilled');
    expect(upgrade).toMatchObject({ status: 'rejected', reason: expect.any(LegacyPrintConflict) });
    await expect(
      TicketService.reserveLegacyPrintDispatch(ticketId, storyId, 'original-request'),
    ).rejects.toBeInstanceOf(LegacyPrintConflict);
    expect(lock).toHaveBeenCalledWith('update');
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('protects an exact paid link even when original ticket metadata is still unlinked', async () => {
    const { update } = serializedLegacyTicket(true);
    await expect(
      TicketService.reserveLegacyPrintDispatch(ticketId, storyId, 'original-request'),
    ).rejects.toBeInstanceOf(LegacyPrintConflict);
    await expect(TicketService.createOrLinkAdminPrintTicket(data)).rejects.toBeInstanceOf(
      LegacyPrintConflict,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('blocks a legacy send after the original ticket was linked to the tracked order', async () => {
    const { lock, update } = serializedLegacyTicket();
    const [upgrade, manual] = await Promise.allSettled([
      TicketService.createOrLinkAdminPrintTicket(data),
      TicketService.reserveLegacyPrintDispatch(ticketId, storyId, 'original-request'),
    ]);
    expect(upgrade).toMatchObject({
      status: 'fulfilled',
      value: { id: ticketId, metadata: { printRequestId: 'order' } },
    });
    expect(manual).toMatchObject({ status: 'rejected', reason: expect.any(LegacyPrintConflict) });
    expect(lock).toHaveBeenCalledWith('update');
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe('TicketService.getTicketById', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves authorId by email from mythoriaDb when ticket.userId is null', async () => {
    const mockBackofficeTicket = {
      id: '9dc26b78-f33a-48b4-92ee-47b7ad5a3f40',
      userId: null,
      category: 'contact',
      subject: 'Contact: Delivery',
      description: 'Acabei de fazer o livro...',
      status: 'open',
      priority: 'medium',
      metadata: {
        contactType: 'Delivery',
        name: 'Vanda Sousa',
        email: 'sousavanda1804@gmail.com',
        author: {
          name: 'Vanda Sousa',
          email: 'sousavanda1804@gmail.com',
        },
      },
      createdAt: new Date('2026-10-31T06:40:00.000Z'),
      updatedAt: new Date('2026-10-31T06:40:00.000Z'),
      resolvedAt: null,
    };

    const mockUpdate = jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue([]),
    });

    jest.mocked(getBackofficeDb).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([]),
            then: (resolve: (val: unknown) => void) => resolve([mockBackofficeTicket]),
            [Symbol.iterator]: function* () {
              yield mockBackofficeTicket;
            },
          }),
        }),
      }),
      update: () => ({
        set: mockUpdate,
      }),
    } as never);

    const mockAuthor = {
      authorId: 'vanda-author-uuid-1234',
      displayName: 'Vanda Sousa',
      email: 'sousavanda1804@gmail.com',
      mobilePhone: '+351912345678',
    };

    jest.mocked(getMythoriaDb).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([mockAuthor]),
          }),
        }),
      }),
    } as never);

    const result = await TicketService.getTicketById('9dc26b78-f33a-48b4-92ee-47b7ad5a3f40');

    expect(result).not.toBeNull();
    expect(result?.userId).toBe('vanda-author-uuid-1234');
    expect(result?.author?.id).toBe('vanda-author-uuid-1234');
    expect(result?.author?.email).toBe('sousavanda1804@gmail.com');
  });

  it('resolves author by userId when ticket.userId is present', async () => {
    const mockBackofficeTicket = {
      id: '9dc26b78-f33a-48b4-92ee-47b7ad5a3f40',
      userId: 'existing-user-uuid',
      category: 'contact',
      subject: 'Contact: Support',
      description: 'Help needed',
      status: 'open',
      priority: 'low',
      metadata: null,
      createdAt: new Date('2026-10-31T06:40:00.000Z'),
      updatedAt: new Date('2026-10-31T06:40:00.000Z'),
      resolvedAt: null,
    };

    jest.mocked(getBackofficeDb).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([]),
            then: (resolve: (val: unknown) => void) => resolve([mockBackofficeTicket]),
            [Symbol.iterator]: function* () {
              yield mockBackofficeTicket;
            },
          }),
        }),
      }),
    } as never);

    const mockAuthor = {
      authorId: 'existing-user-uuid',
      displayName: 'Existing User',
      email: 'user@example.com',
      mobilePhone: null,
    };

    jest.mocked(getMythoriaDb).mockReturnValue({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([mockAuthor]),
          }),
        }),
      }),
    } as never);

    const result = await TicketService.getTicketById('9dc26b78-f33a-48b4-92ee-47b7ad5a3f40');

    expect(result).not.toBeNull();
    expect(result?.userId).toBe('existing-user-uuid');
    expect(result?.author?.id).toBe('existing-user-uuid');
    expect(result?.author?.name).toBe('Existing User');
    expect(result?.author?.email).toBe('user@example.com');
  });
});
