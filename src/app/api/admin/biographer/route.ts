import { NextResponse } from 'next/server';
import { authenticateAdmin } from '@/lib/api-helpers';
import { biographerCommandSchema } from '@/lib/biographer-command';
import { callBiographerDomain, BiographerDomainError } from '@/services/biographer';
export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  const actor = await authenticateAdmin();
  if ('error' in actor) return actor.error;
  if (
    request.headers.get('origin') &&
    request.headers.get('origin') !== new URL(request.url).origin
  ) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const command = biographerCommandSchema.safeParse(await request.json().catch(() => null));
  if (!command.success)
    return NextResponse.json({ error: 'Invalid Biographer command' }, { status: 400 });
  try {
    const data = await callBiographerDomain(command.data.operation, command.data.input, actor);
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof BiographerDomainError ? error.message : 'Biographer service unavailable',
      },
      { status: error instanceof BiographerDomainError ? error.status : 503 },
    );
  }
}
