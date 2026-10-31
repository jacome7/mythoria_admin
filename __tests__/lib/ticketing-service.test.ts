/** @jest-environment node */
import { getBackofficeDb, getMythoriaDb } from '@/db';
import { TicketService } from '@/lib/ticketing/service';

jest.mock('@/db', () => ({
  getBackofficeDb: jest.fn(),
  getMythoriaDb: jest.fn(),
}));

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
