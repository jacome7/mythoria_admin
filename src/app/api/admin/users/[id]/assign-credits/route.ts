import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { notificationClient } from '@/lib/notifications/client';
import { ALLOWED_DOMAINS } from '@/config/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { amount, eventType } = body as {
      amount: number;
      eventType: 'refund' | 'voucher' | 'promotion';
    };

    if (!amount || amount < 1 || amount > 200) {
      return NextResponse.json({ error: 'Amount must be between 1 and 200' }, { status: 400 });
    }

    if (!['refund', 'voucher', 'promotion'].includes(eventType)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });
    }

    const user = (await adminService.getUserById(id)) as
      | { email: string; displayName: string; preferredLocale?: string; authorId: string }
      | undefined;
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await adminService.assignCreditsToUser(id, amount, eventType);
    const newBalance = await adminService.getUserCreditBalance(id);

    let warning: string | undefined;

    if (eventType === 'refund') {
      const notifyResult = await notificationClient.sendCreditRefundNotification({
        email: user.email,
        name: user.displayName,
        credits: amount,
        preferredLocale: user.preferredLocale,
        authorId: user.authorId,
      });
      if (!notifyResult.success) {
        warning = `Credits assigned but refund email failed: ${notifyResult.error}`;
      }
    } else if (eventType === 'voucher') {
      const notifyResult = await notificationClient.sendCreditsAddedNotification({
        email: user.email,
        name: user.displayName,
        credits: amount,
        preferredLocale: user.preferredLocale,
        authorId: user.authorId,
        source: 'voucher',
        entityId: crypto.randomUUID(),
      });
      if (!notifyResult.success) {
        warning = `Credits assigned but voucher email failed: ${notifyResult.error}`;
      }
    }

    return NextResponse.json({
      success: true,
      newBalance,
      message: `Successfully assigned ${amount} credits to ${user.displayName}`,
      ...(warning ? { warning } : {}),
    });
  } catch (error) {
    console.error('Error assigning credits:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
