import { NextRequest, NextResponse } from 'next/server';
import { apiKeyService } from '@/lib/auth/api-key-service';
import { adminService } from '@/db/services';

/**
 * POST /api/admin/leads/bounce
 * Convenience endpoint to mark a lead as bounced by email address
 * 
 * This is a service-to-service endpoint for external systems (e.g., notification engine)
 * to report email bounces without needing to know the lead UUID.
 */
export async function POST(request: NextRequest) {
  try {
    // Validate API key from Authorization header
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          error: 'Missing or invalid Authorization header',
          message: 'Expected: Bearer <api_key>',
        },
        { status: 401 },
      );
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate API key
    const keyInfo = apiKeyService.validateApiKey(apiKey);

    if (!keyInfo.isValid) {
      return NextResponse.json(
        {
          error: 'Invalid API key',
          source: keyInfo.source,
        },
        { status: 401 },
      );
    }

    // Parse request body
    const body = await request.json();
    const { email, emailStatus } = body;

    // Validate required fields
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid required field: email' },
        { status: 400 },
      );
    }

    if (!emailStatus || typeof emailStatus !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid required field: emailStatus' },
        { status: 400 },
      );
    }

    // Validate email status
    const validStatuses = ['ready', 'sent', 'open', 'click', 'soft_bounce', 'hard_bounce', 'unsub'];
    if (!validStatuses.includes(emailStatus)) {
      return NextResponse.json(
        {
          error: `Invalid email status. Must be one of: ${validStatuses.join(', ')}`,
        },
        { status: 400 },
      );
    }

    // Find lead by email using adminService
    const lead = await adminService.getLeadByEmail(email);

    if (!lead) {
      return NextResponse.json(
        { error: `Lead not found with email: ${email}` },
        { status: 404 },
      );
    }

    // Update the lead status using adminService
    const updatedLead = await adminService.updateLeadStatus(lead.id, emailStatus);

    if (!updatedLead) {
      return NextResponse.json(
        { error: 'Failed to update lead status' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Lead email status updated to: ${emailStatus}`,
      lead: updatedLead,
    });
  } catch (error) {
    console.error('Error updating lead bounce status:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
