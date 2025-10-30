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
 * GET /api/admin/leads/[id]
 * Get a single lead by ID.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;
    const lead = await adminService.getLeadById(id);

    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error('Error fetching lead:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/leads/[id]
 * Update a lead.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;

    // Check if lead exists
    const existingLead = await adminService.getLeadById(id);
    if (!existingLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { name, email, mobilePhone, language, emailStatus } = body;

    // If email is being updated, validate and normalize it
    let normalizedEmail = existingLead.email;
    if (email && email !== existingLead.email) {
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }
      normalizedEmail = normalizeEmail(email);
    }

    // If language is being updated, validate it
    if (language && !isValidLanguageCode(language)) {
      return NextResponse.json(
        { error: 'Invalid language format. Expected format: xx-XX (e.g., pt-PT, en-US)' },
        { status: 400 },
      );
    }

    // Normalize name if provided
    const normalizedName =
      name !== undefined ? (name ? normalizeName(name) : null) : existingLead.name;

    // Update lead
    const updatedLead = await adminService.upsertLead({
      name: normalizedName,
      email: normalizedEmail,
      mobilePhone: mobilePhone !== undefined ? mobilePhone : existingLead.mobilePhone,
      language: language || existingLead.language,
      emailStatus: emailStatus || existingLead.emailStatus,
    });

    return NextResponse.json(updatedLead);
  } catch (error) {
    console.error('Error updating lead:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/leads/[id]
 * Delete a lead.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;

    // Delete lead
    const deletedLead = await adminService.deleteLead(id);

    if (!deletedLead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Lead deleted successfully', lead: deletedLead });
  } catch (error) {
    console.error('Error deleting lead:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
