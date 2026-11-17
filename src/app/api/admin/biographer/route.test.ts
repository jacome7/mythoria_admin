/** @jest-environment node */
import { NextResponse } from 'next/server';
const authenticate = jest.fn();
const call = jest.fn();
jest.mock('@/lib/api-helpers', () => ({ authenticateAdmin: () => authenticate() }));
jest.mock('@/services/biographer', () => ({
  callBiographerDomain: (...args: unknown[]) => call(...args),
  BiographerDomainError: class extends Error {},
}));
import { POST } from './route';
const request = (body: unknown, origin = 'https://admin.example.com') =>
  new Request('https://admin.example.com/api/admin/biographer', {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
describe('Biographer admin boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    authenticate.mockResolvedValue({ email: 'operator@example.com' });
    call.mockResolvedValue([]);
  });
  it('rejects unauthenticated access before calling domain', async () => {
    authenticate.mockResolvedValue({ error: NextResponse.json({}, { status: 401 }) });
    expect((await POST(request({}))).status).toBe(401);
    expect(call).not.toHaveBeenCalled();
  });
  it('rejects cross-origin requests', async () => {
    expect(
      (await POST(request({ operation: 'listProjects', input: {} }, 'https://attacker.example')))
        .status,
    ).toBe(403);
    expect(call).not.toHaveBeenCalled();
  });
  it('passes authenticated actor and prevents caching', async () => {
    const response = await POST(request({ operation: 'listProjects', input: {} }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(call).toHaveBeenCalledWith(
      'listProjects',
      { limit: 50 },
      { email: 'operator@example.com' },
    );
  });
});
