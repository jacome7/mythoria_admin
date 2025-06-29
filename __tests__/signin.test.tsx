import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { signIn } from 'next-auth/react';
import SignInPage from '@/app/auth/signin/page';

// Mock next-auth/react
jest.mock('next-auth/react', () => ({
  signIn: jest.fn(),
}));

const mockSignIn = signIn as jest.MockedFunction<typeof signIn>;

describe('SignIn Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders sign-in page correctly', () => {
    render(<SignInPage />);
    
    expect(screen.getByText('Mythoria Admin')).toBeInTheDocument();
    expect(screen.getByText('Administration Portal')).toBeInTheDocument();
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    expect(screen.getByText(/Access restricted to @mythoria.pt and @caravanconcierge.com/)).toBeInTheDocument();
  });

  it('calls signIn when Google sign-in button is clicked', async () => {
    mockSignIn.mockResolvedValue({} as any);
    
    render(<SignInPage />);
    
    const signInButton = screen.getByRole('button', { name: /Sign in with Google/i });
    fireEvent.click(signInButton);
    
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith('google', {
        callbackUrl: '/',
        redirect: true,
      });
    });
  });

  it('shows loading state when signing in', async () => {
    mockSignIn.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<SignInPage />);
    
    const signInButton = screen.getByRole('button', { name: /Sign in with Google/i });
    fireEvent.click(signInButton);
    
    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  it('displays domain restriction warning', () => {
    render(<SignInPage />);
    
    const warning = screen.getByText(/Access restricted to @mythoria.pt and @caravanconcierge.com/);
    expect(warning).toBeInTheDocument();
  });

  it('displays port information in development', () => {
    render(<SignInPage />);
    
    const portInfo = screen.getByText(/Dev Environment: Port 3001/);
    expect(portInfo).toBeInTheDocument();
  });
});
