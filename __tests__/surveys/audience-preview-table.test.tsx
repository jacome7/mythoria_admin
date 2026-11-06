import { render, screen } from '@testing-library/react';
import AudiencePreviewTable from '@/components/surveys/studies/AudiencePreviewTable';
import type { SurveyAudiencePreview } from '@/lib/surveys/study-types';

const cohort = (classified: number) => ({
  classified,
  emailEligible: classified,
  suppressed: 0,
  alreadyInvited: 0,
});

const base: SurveyAudiencePreview = {
  totalAuthors: 20,
  closedAccounts: 0,
  cohorts: { C1: cohort(10), C2: cohort(6), C3: cohort(4) },
  duplicateEmails: 0,
  reconciles: true,
};

describe('AudiencePreviewTable', () => {
  it('renders no excluded rows when the unclassified block is absent', () => {
    render(<AudiencePreviewTable preview={base} />);
    expect(screen.queryByText('U1')).toBeNull();
    expect(screen.queryByText('U2')).toBeNull();
    expect(screen.queryByText('Excluded - not invited')).toBeNull();
    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.getByText('Reconciles')).toBeTruthy();
  });

  it('renders no excluded rows for an empty unclassified object', () => {
    render(<AudiencePreviewTable preview={{ ...base, unclassified: {} }} />);
    expect(screen.queryByText('Excluded - not invited')).toBeNull();
    expect(screen.getByText('Total')).toBeTruthy();
  });

  it('still renders legacy U1/U2 if an older WebApp sends them', () => {
    render(<AudiencePreviewTable preview={{ ...base, unclassified: { U1: 4, U2: 1 } }} />);
    expect(screen.getByText('U1')).toBeTruthy();
    expect(screen.getByText('U2')).toBeTruthy();
    expect(screen.getByText('Total (incl. unclassified 5)')).toBeTruthy();
  });
});
