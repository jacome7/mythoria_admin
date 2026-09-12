import { NextRequest } from 'next/server';
import crypto from 'crypto';
import type { ReferralActor } from '@/lib/referrals/permissions';

export interface McpPrincipal {
  id: string;
  legacy: boolean;
  actor: ReferralActor;
}
export function getMcpPrincipal(req: NextRequest): McpPrincipal | null {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  const credentials = [
    {
      key: process.env.REFERRAL_MCP_MANAGEMENT_KEY,
      id: 'referral-management',
      legacy: false,
      permissions: ['referrals:view', 'referrals:manage'] as ReferralActor['permissions'],
    },
    {
      key: process.env.REFERRAL_MCP_FINANCE_KEY,
      id: 'referral-finance',
      legacy: false,
      permissions: [
        'referrals:view',
        'referrals:review',
        'referrals:settle',
      ] as ReferralActor['permissions'],
    },
    {
      key: process.env.MCP_SECRET_KEY,
      id: 'legacy-admin',
      legacy: true,
      permissions: [] as ReferralActor['permissions'],
    },
  ];
  for (const entry of credentials) {
    if (!entry.key) continue;
    const expected = crypto.createHash('sha256').update(entry.key).digest();
    const actual = crypto.createHash('sha256').update(token).digest();
    if (crypto.timingSafeEqual(expected, actual))
      return {
        id: entry.id,
        legacy: entry.legacy,
        actor: { type: 'admin_mcp', id: entry.id, permissions: entry.permissions },
      };
  }
  return null;
}

export function validateMcpAuth(req: NextRequest): boolean {
  return getMcpPrincipal(req) !== null;
}

/* Legacy helper retained as a named implementation reference for credential rotation. */
export function validateLegacyMcpAuth(req: NextRequest): boolean {
  const secretKey = process.env.MCP_SECRET_KEY;
  if (!secretKey) {
    console.error('MCP_SECRET_KEY is not configured.');
    return false;
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.split(' ')[1];

  if (token.length !== secretKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secretKey));
}
