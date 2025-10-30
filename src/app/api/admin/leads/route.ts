import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { adminService } from '@/db/services';
import { ALLOWED_DOMAINS } from '@/config/auth';
import {
  normalizeEmail,
  normalizeName,
  isValidEmail,
  isValidLanguageCode,
} from '@/lib/lead-normalization';

/**
 * GET /api/admin/leads
 * Get paginated list of leads with search, filters, and sorting.
 */
export async function GET(request: Request) {
  try {
    // Check if user is authenticated and authorized
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));
    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '100');
    const search = searchParams.get('search') || '';
    const statusFilter = searchParams.get('status') || 'all';
    const languageFilter = searchParams.get('language') || 'all';
    const sortBy = (searchParams.get('sortBy') || 'lastEmailSentAt') as
      | 'name'
      | 'email'
      | 'language'
      | 'emailStatus'
      | 'lastEmailSentAt';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    // Get leads data
    const result = await adminService.getLeads(
      page,
      limit,
      search,
      statusFilter,
      languageFilter,
      sortBy,
      sortOrder,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/leads
 * Create a new lead.
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
    const { name, email, mobilePhone, language, emailStatus } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!language) {
      return NextResponse.json({ error: 'Language is required' }, { status: 400 });
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate language format
    if (!isValidLanguageCode(language)) {
      return NextResponse.json(
        { error: 'Invalid language format. Expected format: xx-XX (e.g., pt-PT, en-US)' },
        { status: 400 },
      );
    }

    // Normalize data
    const normalizedEmail = normalizeEmail(email);
    const normalizedName = name ? normalizeName(name) : null;

    // Create or update lead
    const lead = await adminService.upsertLead({
      name: normalizedName,
      email: normalizedEmail,
      mobilePhone: mobilePhone || null,
      language,
      emailStatus: emailStatus || 'ready',
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error('Error creating lead:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
