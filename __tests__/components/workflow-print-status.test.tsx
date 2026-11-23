import React from 'react';
import { render, screen } from '@testing-library/react';
import WorkflowCard from '@/app/workflows/components/WorkflowCard';

const run = { run_id: 'run', story_id: 'story', status: 'completed', started_at: null };
it('distinguishes delivered PDFs from a failed review and an unconfirmed alert', () => {
  render(
    <WorkflowCard
      workflow={{
        ...run,
        metadata: {
          printQaStatus: 'review_failed',
          printDeliveryStatus: 'sent',
          printQaAlertSent: false,
        },
      }}
      onRetry={jest.fn()}
    />,
  );
  expect(screen.getByText('review failed')).toBeInTheDocument();
  expect(screen.getByText('sent')).toBeInTheDocument();
  expect(screen.getByText('Unconfirmed')).toBeInTheDocument();
});
it('renders older runs without print metadata', () => {
  render(<WorkflowCard workflow={run} onRetry={jest.fn()} />);
  expect(screen.queryByLabelText('Print results')).not.toBeInTheDocument();
});
