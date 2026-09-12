/** @jest-environment node */
import type { NextRequest } from 'next/server';
import { getMcpPrincipal } from './auth';
const request = (token: string) =>
  ({ headers: new Headers({ Authorization: `Bearer ${token}` }) }) as NextRequest;
describe('referral MCP principals', () => {
  const before = { ...process.env };
  beforeEach(() =>
    Object.assign(process.env, {
      MCP_SECRET_KEY: 'fixture-legacy',
      REFERRAL_MCP_MANAGEMENT_KEY: 'fixture-management',
      REFERRAL_MCP_FINANCE_KEY: 'fixture-finance',
    }),
  );
  afterAll(() => {
    process.env = before;
  });
  it('separates management from settlement permissions', () => {
    const manager = getMcpPrincipal(request('fixture-management'));
    expect(manager?.legacy).toBe(false);
    expect(manager?.actor.permissions).toEqual(['referrals:view', 'referrals:manage']);
    expect(getMcpPrincipal(request('fixture-finance'))?.actor.permissions).toEqual([
      'referrals:view',
      'referrals:review',
      'referrals:settle',
    ]);
  });
  it('never grants referral permissions to legacy keys', () => {
    expect(getMcpPrincipal(request('fixture-legacy'))).toMatchObject({
      legacy: true,
      actor: { permissions: [] },
    });
  });
  it('rejects unconfigured and invalid credentials', () => {
    expect(getMcpPrincipal(request('wrong'))).toBeNull();
    delete process.env.REFERRAL_MCP_FINANCE_KEY;
    expect(getMcpPrincipal(request('fixture-finance'))).toBeNull();
  });
});
