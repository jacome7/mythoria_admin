import { render, screen, waitFor } from '@testing-library/react';
import FiscalDocumentsPage from '@/app/fiscal-documents/page';
import { useAdminAuth } from '@/lib/hooks/useAdminAuth';

jest.mock('@/lib/hooks/useAdminAuth', () => ({
  useAdminAuth: jest.fn(),
}));

const mockUseAdminAuth = jest.mocked(useAdminAuth);
const originalFetch = global.fetch;

describe('FiscalDocumentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAdminAuth.mockReturnValue({
      loading: false,
      session: {
        user: {
          email: 'admin@mythoria.pt',
          name: 'Admin',
        },
      },
    } as never);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders the empty state when no fiscal documents exist', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [],
          pagination: {
            page: 1,
            limit: 50,
            totalCount: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    render(<FiscalDocumentsPage />);

    expect(screen.getByText('Fiscal Documents')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('No fiscal documents found.')).toBeInTheDocument();
    });
  });
});
