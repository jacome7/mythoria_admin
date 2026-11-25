/** @jest-environment node */
import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { GET as costs } from '@/app/api/admin/printing-costs/route';
import { GET as requests } from '@/app/api/admin/printing-costs/requests/route';
import { getPrintingCosts, getPrintingCostRequests } from '@/db/services/printing-costs';

jest.mock('@/auth', () => ({ auth: jest.fn() }));
jest.mock('@/config/auth', () => ({ ALLOWED_DOMAINS: ['@mythoria.pt'] }));
jest.mock('@/db/services/printing-costs', () => ({
  getPrintingCosts: jest.fn(),
  getPrintingCostRequests: jest.fn(),
}));
const req = (query = '') => new NextRequest(`http://localhost/api/admin/printing-costs${query}`);
beforeEach(() => jest.clearAllMocks());

it('enforces session and allowed-domain authorization before querying', async () => {
  jest
    .mocked(auth)
    .mockResolvedValueOnce(null as never)
    .mockResolvedValueOnce({ user: { email: 'outsider@example.com' } } as never);
  expect((await costs(req())).status).toBe(401);
  expect((await requests(req())).status).toBe(403);
  expect(getPrintingCosts).not.toHaveBeenCalled();
  expect(getPrintingCostRequests).not.toHaveBeenCalled();
});

it('rejects invalid pages and passes valid range and page to the service', async () => {
  jest.mocked(auth).mockResolvedValue({ user: { email: 'admin@mythoria.pt' } } as never);
  expect((await requests(req('?page=1.5'))).status).toBe(400);
  expect(getPrintingCostRequests).not.toHaveBeenCalled();
  jest
    .mocked(getPrintingCostRequests)
    .mockResolvedValue({ requests: [], page: 2, pageSize: 25, total: 0 });
  expect((await requests(req('?range=7d&page=2'))).status).toBe(200);
  expect(getPrintingCostRequests).toHaveBeenCalledWith('7d', 2);
});
