import { NextRequest, NextResponse } from 'next/server';
import { validateMcpAuth } from '@/lib/mcp/auth';

export async function POST(request: NextRequest) {
  if (!validateMcpAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json(
    { error: 'Legacy SSE transport has been retired. Use HTTP POST /api/mcp.' },
    { status: 410, headers: { 'Cache-Control': 'no-store' } },
  );
}
