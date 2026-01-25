import { render, screen, fireEvent } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import AdminHeader from '@/components/AdminHeader';

// Mock useSession hook
const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;

describe('AdminHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the logo and basic navigation when not authenticated', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: jest.fn(),
    });

    render(<AdminHeader />);

    expect(screen.getByAltText('Mythoria Logo')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Server Status')).toBeInTheDocument();
    expect(screen.getByText('Tickets')).toBeInTheDocument();
    expect(screen.getByText('Management')).toBeInTheDocument();
    expect(screen.getByText('Financials')).toBeInTheDocument();
  });

  it('renders user avatar and dropdown when authenticated', () => {
    const mockSession = {
      user: {
        name: 'John Doe',
        email: 'john@mythoria.pt',
        image: 'https://example.com/avatar.jpg',
      },
      expires: '2025-12-31T23:59:59.999Z',
    };

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    });

    render(<AdminHeader />);

    expect(screen.getByAltText('User Avatar')).toBeInTheDocument();
  });

  it('renders user initials when no avatar image is provided', () => {
    const mockSession = {
      user: {
        name: 'Jane Smith',
        email: 'jane@mythoria.pt',
        image: null,
      },
      expires: '2025-12-31T23:59:59.999Z',
    };

    mockUseSession.mockReturnValue({
      data: mockSession,
      status: 'authenticated',
      update: jest.fn(),
    });

    render(<AdminHeader />);

    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('shows dropdown menu items when Tickets dropdown is clicked', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: jest.fn(),
    });

    render(<AdminHeader />);

    // Since Tickets is not a dropdown, we'll test Management dropdown instead
    const managementButton = screen.getByText('Management');
    fireEvent.click(managementButton);

    expect(screen.getByText('Managers')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Partners')).toBeInTheDocument();
    expect(screen.getByText('Stories')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('shows management dropdown menu items', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: jest.fn(),
    });

    render(<AdminHeader />);

    const managementButton = screen.getByText('Management');
    fireEvent.click(managementButton);

    expect(screen.getByText('Managers')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Partners')).toBeInTheDocument();
    expect(screen.getByText('Stories')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
    // Services is under Financials, not Management; ensure we don't falsely assert it here
    // Add assertion that promotion codes link appears only after opening Financials (tested below)
  });

  it('shows financials dropdown menu items', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: jest.fn(),
    });

    render(<AdminHeader />);

    const financialsButton = screen.getByText('Financials');
    fireEvent.click(financialsButton);

    expect(screen.getByText('Pricing')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('AI Usage')).toBeInTheDocument();
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('Promotion Codes')).toBeInTheDocument();
  });

  it('creates correct navigation links', () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: jest.fn(),
    });

    render(<AdminHeader />);

    const dashboardLink = screen.getByRole('link', { name: /Mythoria Logo/i });
    expect(dashboardLink).toHaveAttribute('href', '/');

    const serverStatusLink = screen.getByRole('link', { name: 'Server Status' });
    expect(serverStatusLink).toHaveAttribute('href', '/server-status');

    // Open financials to reveal promotion codes link
    const financialsButton = screen.getByText('Financials');
    fireEvent.click(financialsButton);
    const promoCodesLink = screen.getByRole('link', { name: 'Promotion Codes' });
    expect(promoCodesLink).toHaveAttribute('href', '/promotion-codes');
  });
});
