import { NextRequest } from 'next/server';
import { z } from 'zod';
import { getMythoriaDb } from '@/db';
import { partners } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { auth } from '@/auth';
import { proxyToNotificationEngine } from '@/lib/api-helpers';

const requestPrintSchema = z.object({
  partnerId: z.string().uuid('Invalid partner ID'),
  subject: z.string().min(1, 'Subject is required'),
  bodyText: z.string().min(1, 'Body is required'),
  coverPdfUri: z.string().url('Invalid Cover PDF URI'),
  interiorPdfUri: z.string().url('Invalid Interior PDF URI'),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ storyId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));
    if (!isAllowedDomain) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { storyId } = await params;
    if (!storyId) {
      return Response.json({ error: 'Story ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = requestPrintSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid payload.' },
        { status: 400 },
      );
    }

    const { partnerId, subject, bodyText, coverPdfUri, interiorPdfUri } = parsed.data;

    const db = getMythoriaDb();
    const partner = await db.select().from(partners).where(eq(partners.id, partnerId)).limit(1);

    if (!partner || partner.length === 0) {
      return Response.json({ error: 'Partner not found' }, { status: 404 });
    }

    const partnerEmail = partner[0].email;
    if (!partnerEmail) {
      return Response.json({ error: 'Partner does not have an email configured' }, { status: 400 });
    }

    // Proxy the request to the notification-engine
    const notificationPayload = {
      toEmail: partnerEmail,
      subject,
      bodyText,
      coverPdfUri,
      interiorPdfUri,
    };

    const response = await proxyToNotificationEngine('/email/admin-print-request', {
      method: 'POST',
      body: notificationPayload,
    });

    return response;
  } catch (error) {
    console.error('Error in request-print route:', error);
    return Response.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
