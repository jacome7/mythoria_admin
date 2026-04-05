import { NextRequest } from 'next/server';
import crypto from 'crypto';

export function validateMcpAuth(req: NextRequest): boolean {
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
