import { render, screen, waitFor } from '@testing-library/react';
import TicketDetailPage from '@/app/tickets/[id]/page';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';
import { useParams, useRouter } from 'next/navigation';

jest.mock('@/lib/hooks/useAdminAuth', () => ({
  useAdminAuth: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}));

const mockUseAdminAuth = jest.mocked(useAdminAuth);
const mockUseParams = jest.mocked(useParams);
const mockUseRouter = jest.mocked(useRouter);
const originalFetch = global.fetch;

describe('TicketDetailPage - User Email Link', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAdminAuth.mockReturnValue({
      session: { user: { name: 'Admin', email: 'admin@mythoria.pt' } },
      loading: false,
    } as never);
    mockUseParams.mockReturnValue({ id: '9dc26b78-f33a-48b4-92ee-47b7ad5a3f40' });
    mockUseRouter.mockReturnValue({ push: jest.fn() } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders a link to /users/{userId} on the customer email when userId is present', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url === '/api/tickets/9dc26b78-f33a-48b4-92ee-47b7ad5a3f40') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: '9dc26b78-f33a-48b4-92ee-47b7ad5a3f40',
            userId: 'user-vanda-123',
            category: 'contact',
            subject: 'Contact: Delivery',
            description: 'Acabei de fazer o livro...',
            status: 'open',
            priority: 'medium',
            createdAt: '2026-10-31T06:40:00.000Z',
            updatedAt: '2026-10-31T06:40:00.000Z',
            author: {
              id: 'user-vanda-123',
              name: 'Vanda Sousa',
              email: 'sousavanda1804@gmail.com',
            },
            metadata: {
              contactType: 'Delivery',
              name: 'Vanda Sousa',
              email: 'sousavanda1804@gmail.com',
            },
            comments: [],
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    render(<TicketDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Customer Information')).toBeInTheDocument();
    });

    // Check that the email in Customer Information has a link to /users/user-vanda-123
    const emailLinks = screen.getAllByRole('link', { name: 'sousavanda1804@gmail.com' });
    expect(emailLinks.length).toBeGreaterThanOrEqual(1);

    const customerInfoEmailLink = emailLinks[0];
    expect(customerInfoEmailLink).toHaveAttribute('href', '/users/user-vanda-123');
  });

  it('resolves userId via fallback search when author.id is missing and links to /users/{userId}', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url === '/api/tickets/9dc26b78-f33a-48b4-92ee-47b7ad5a3f40') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: '9dc26b78-f33a-48b4-92ee-47b7ad5a3f40',
            userId: null,
            category: 'contact',
            subject: 'Contact: Delivery',
            description: 'Acabei de fazer o livro...',
            status: 'open',
            priority: 'medium',
            createdAt: '2026-10-31T06:40:00.000Z',
            updatedAt: '2026-10-31T06:40:00.000Z',
            author: {
              id: '',
              name: 'Vanda Sousa',
              email: 'sousavanda1804@gmail.com',
            },
            metadata: {
              contactType: 'Delivery',
              name: 'Vanda Sousa',
              email: 'sousavanda1804@gmail.com',
            },
            comments: [],
          }),
        });
      }

      if (url.startsWith('/api/admin/users?search=')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [
              {
                authorId: 'user-resolved-789',
                email: 'sousavanda1804@gmail.com',
                displayName: 'Vanda Sousa',
              },
            ],
          }),
        });
      }

      return Promise.resolve({ ok: false, status: 404 });
    });

    render(<TicketDetailPage />);

    await waitFor(() => {
      const emailLinks = screen.getAllByRole('link', { name: 'sousavanda1804@gmail.com' });
      expect(emailLinks.length).toBeGreaterThanOrEqual(1);
      expect(emailLinks[0]).toHaveAttribute('href', '/users/user-resolved-789');
    });
  });

  it('renders plain text when no userId can be resolved for an anonymous customer', async () => {
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url === '/api/tickets/9dc26b78-f33a-48b4-92ee-47b7ad5a3f40') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            id: '9dc26b78-f33a-48b4-92ee-47b7ad5a3f40',
            userId: null,
            category: 'contact',
            subject: 'Contact: Delivery',
            description: 'Acabei de fazer o livro...',
            status: 'open',
            priority: 'medium',
            createdAt: '2026-10-31T06:40:00.000Z',
            updatedAt: '2026-10-31T06:40:00.000Z',
            author: {
              id: '',
              name: 'Anonymous',
              email: 'anonymous@example.com',
            },
            metadata: {
              email: 'anonymous@example.com',
            },
            comments: [],
          }),
        });
      }

      if (url.startsWith('/api/admin/users?search=')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            data: [],
          }),
        });
      }

      return Promise.resolve({ ok: false, status: 404 });
    });

    render(<TicketDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('Customer Information')).toBeInTheDocument();
    });

    expect(screen.queryByRole('link', { name: 'anonymous@example.com' })).not.toBeInTheDocument();
    expect(screen.getAllByText('anonymous@example.com').length).toBeGreaterThanOrEqual(1);
  });
});
