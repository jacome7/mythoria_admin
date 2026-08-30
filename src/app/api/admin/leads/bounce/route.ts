import { NextRequest, NextResponse } from 'next/server';
import { apiKeyService } from '@/lib/auth/api-key-service';
import { markEmailBounced } from '@/db/services/emailDeliverability';

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
    const { email, emailStatus, bounceType } = body;

    // Validate required fields
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid required field: email' },
        { status: 400 },
      );
    }

    const resolvedBounceType =
      bounceType === 'hard' || bounceType === 'soft'
        ? bounceType
        : emailStatus === 'hard_bounce'
          ? 'hard'
          : emailStatus === 'soft_bounce'
            ? 'soft'
            : null;

    if (!resolvedBounceType) {
      return NextResponse.json({ error: 'bounceType must be hard or soft' }, { status: 400 });
    }

    const result = await markEmailBounced(email, resolvedBounceType);

    return NextResponse.json({
      success: true,
      ...result,
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
