/** @jest-environment node */
import { POST } from '@/app/api/tickets/[id]/print-owner/route';
import { hasTrustedAdminOrigin } from '@/lib/admin-request-origin';
import { authenticateAdmin } from '@/lib/api-helpers';
import { logAdminAudit } from '@/lib/audit';
import { TicketService } from '@/lib/ticketing/service';

jest.mock('@/lib/api-helpers', () => ({ authenticateAdmin: jest.fn() }));
jest.mock('@/lib/admin-request-origin', () => ({ hasTrustedAdminOrigin: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAdminAudit: jest.fn() }));
jest.mock('@/lib/ticketing/service', () => ({ TicketService: { setPrintOwner: jest.fn() } }));

const id = '00000000-0000-4000-8000-000000000001';
function post(body: object) {
  const req = new Request('https://admin.example', { method: 'POST', body: JSON.stringify(body) });
  return POST(req, { params: Promise.resolve({ id }) });
}
beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(authenticateAdmin).mockResolvedValue({ email: 'Staff@mythoria.pt' });
  jest.mocked(hasTrustedAdminOrigin).mockReturnValue(true);
});

it('claims using the session identity and audits the assignment', async () => {
  jest.mocked(TicketService.setPrintOwner).mockResolvedValue('updated');
  const result = await post({ action: 'claim' });
  expect(await result.json()).toEqual({ owner: 'staff@mythoria.pt' });
  expect(TicketService.setPrintOwner).toHaveBeenCalledWith(id, 'Staff@mythoria.pt', true);
  expect(logAdminAudit).toHaveBeenCalledWith(
    expect.objectContaining({ action: 'print.owner.claim' }),
  );
});
it('rejects attempts to supply another owner or to mutate across origins', async () => {
  expect((await post({ action: 'claim', email: 'someone@example.com' })).status).toBe(400);
  jest.mocked(hasTrustedAdminOrigin).mockReturnValue(false);
  expect((await post({ action: 'claim' })).status).toBe(403);
  expect(TicketService.setPrintOwner).not.toHaveBeenCalled();
});
it.each(['taken', 'closed'] as const)(
  'returns a conflict for %s without recording an assignment',
  async (outcome) => {
    jest.mocked(TicketService.setPrintOwner).mockResolvedValue(outcome);
    expect((await post({ action: 'release' })).status).toBe(409);
    expect(logAdminAudit).not.toHaveBeenCalled();
  },
);
