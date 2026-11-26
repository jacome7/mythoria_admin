import { fireEvent, render, screen } from '@testing-library/react';
import { PremiumPrintActions } from '@/app/stories/[storyId]/components/PremiumPrintActions';

const storyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const revision = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const runId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const originalFetch = globalThis.fetch;
const fetch = jest.fn();

beforeEach(() => {
  fetch.mockReset();
  globalThis.fetch = fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

it('shows the available RGB and CMYK part links for the current edition', async () => {
  fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      data: {
        status: 'ready',
        runId,
        source: 'self-print',
        parts: ['interior', 'cover', 'interiorCmyk', 'coverCmyk'],
      },
    }),
  } as Response);
  render(<PremiumPrintActions storyId={storyId} revision={revision} />);
  expect(await screen.findByRole('link', { name: 'Download RGB interior' })).toHaveAttribute(
    'href',
    `/api/admin/stories/${storyId}/premium-print/${runId}/interior?revision=${revision}`,
  );
  expect(screen.getByRole('link', { name: 'Download RGB cover' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Download CMYK interior' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Download CMYK cover' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Generate PDFs' })).not.toBeInTheDocument();
});

it('shows the queued state after retrying a failed export', async () => {
  const result = (status: string) =>
    ({ ok: true, json: async () => ({ data: { status, runId } }) }) as Response;
  fetch.mockResolvedValueOnce(result('failed')).mockResolvedValueOnce(result('queued'));
  render(<PremiumPrintActions storyId={storyId} revision={revision} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry PDF export' }));
  expect(await screen.findByText('PDF export queued…')).toBeInTheDocument();
  expect(fetch).toHaveBeenLastCalledWith(
    `/api/admin/stories/${storyId}/premium-print?revision=${revision}`,
    expect.objectContaining({ method: 'POST' }),
  );
});

it('offers to produce the full set while keeping legacy RGB downloads available', async () => {
  fetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      data: { status: 'ready', runId, source: 'self-print', parts: ['interior', 'cover'] },
    }),
  } as Response);
  render(<PremiumPrintActions storyId={storyId} revision={revision} />);
  expect(await screen.findByRole('link', { name: 'Download RGB interior' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Generate full PDF set' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Download CMYK cover' })).not.toBeInTheDocument();
});
