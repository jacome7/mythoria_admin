import { render, screen } from '@testing-library/react';
import KPICard from '@/components/KPICard';

describe('KPICard', () => {
  it('renders basic KPI card with title and value', () => {
    render(
      <KPICard 
        title="Total Users" 
        value="1,234" 
        icon="👥" 
        href="/users"
      />
    );

    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('👥')).toBeInTheDocument();
  });

  it('renders KPI card with numeric value', () => {
    render(
      <KPICard 
        title="Revenue" 
        value={12345} 
        icon="💰" 
        href="/revenue"
      />
    );

    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('12345')).toBeInTheDocument();
    expect(screen.getByText('💰')).toBeInTheDocument();
  });

  it('renders KPI card with description', () => {
    render(
      <KPICard 
        title="Active Sessions" 
        value="89" 
        icon="🔄" 
        href="/sessions"
        description="Currently online" 
      />
    );

    expect(screen.getByText('Active Sessions')).toBeInTheDocument();
    expect(screen.getByText('89')).toBeInTheDocument();
    expect(screen.getByText('🔄')).toBeInTheDocument();
    expect(screen.getByText('Currently online')).toBeInTheDocument();
  });

  it('renders KPI card with loading state', () => {
    render(
      <KPICard 
        title="Loading Data" 
        value="..." 
        icon="⏳" 
        href="/loading"
        isLoading={true} 
      />
    );

    expect(screen.getByText('Loading Data')).toBeInTheDocument();
    expect(screen.getByText('⏳')).toBeInTheDocument();
    // When loading, the value shouldn't be shown
    expect(screen.queryByText('...')).not.toBeInTheDocument();
  });

  it('creates a clickable link with correct href', () => {
    render(
      <KPICard 
        title="Analytics" 
        value="100%" 
        icon="📊" 
        href="/analytics"
      />
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/analytics');
  });
});
