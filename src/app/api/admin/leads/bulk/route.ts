import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { ALLOWED_DOMAINS } from '@/config/auth';

/**
 * POST /api/admin/leads/bulk
 * Perform bulk operations on leads (delete or change status).
 */
export async function POST(request: Request) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));
    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { action, ids, emailStatus } = body;

    // Validate request
    if (!action || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request. Required: action (string), ids (array)' },
        { status: 400 },
      );
    }

    // Validate IDs are strings
    if (!ids.every((id) => typeof id === 'string')) {
      return NextResponse.json({ error: 'All IDs must be strings' }, { status: 400 });
    }

    // Perform action
    switch (action) {
      case 'delete': {
        const deletedLeads = await adminService.bulkDeleteLeads(ids);
        return NextResponse.json({
          message: `Successfully deleted ${deletedLeads.length} lead(s)`,
          count: deletedLeads.length,
          leads: deletedLeads,
        });
      }

      case 'changeStatus': {
        if (!emailStatus) {
          return NextResponse.json(
            { error: 'emailStatus is required for changeStatus action' },
            { status: 400 },
          );
        }

        // Validate email status
        const validStatuses = [
          'ready',
          'sent',
          'open',
          'click',
          'soft_bounce',
          'hard_bounce',
          'unsub',
        ];
        if (!validStatuses.includes(emailStatus)) {
          return NextResponse.json(
            { error: `Invalid email status. Must be one of: ${validStatuses.join(', ')}` },
            { status: 400 },
          );
        }

        const updatedLeads = await adminService.bulkUpdateLeadStatus(ids, emailStatus);
        return NextResponse.json({
          message: `Successfully updated ${updatedLeads.length} lead(s) to status: ${emailStatus}`,
          count: updatedLeads.length,
          leads: updatedLeads,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: delete, changeStatus' },
          { status: 400 },
        );
    }
  } catch (error) {
    console.error('Error performing bulk operation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
