import { createMcpServer } from '@/lib/mcp/server';
import { registerMcpTools } from '@/lib/mcp/tools';
import { registerReferralMcpTools } from '@/lib/mcp/referrals';

jest.mock('@/lib/mcp/tools', () => ({ registerMcpTools: jest.fn() }));
jest.mock('@/lib/mcp/referrals', () => ({ registerReferralMcpTools: jest.fn() }));

describe('recovery principal isolation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not register recovery for no principal', () => {
    createMcpServer();
    expect(registerMcpTools).toHaveBeenCalledWith(expect.anything(), undefined);
    expect(registerReferralMcpTools).not.toHaveBeenCalled();
  });

  it('does not register admin tools for a referral principal', () => {
    const actor = { type: 'admin_mcp' as const, id: 'referral-management', permissions: [] };
    createMcpServer({ id: actor.id, legacy: false, actor });
    expect(registerMcpTools).not.toHaveBeenCalled();
    expect(registerReferralMcpTools).toHaveBeenCalledWith(expect.anything(), actor);
  });

  it('registers recovery only for the authenticated legacy-admin identity', () => {
    const actor = { type: 'admin_mcp' as const, id: 'legacy-admin', permissions: [] };
    createMcpServer({ id: actor.id, legacy: true, actor });
    expect(registerMcpTools).toHaveBeenCalledWith(expect.anything(), 'legacy-admin');
    createMcpServer({ id: 'other', legacy: true, actor });
    expect(registerMcpTools).toHaveBeenLastCalledWith(expect.anything(), undefined);
  });
});
