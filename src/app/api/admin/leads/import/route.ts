/**
 * CSV Import API Route
 *
 * Handles bulk lead imports from CSV files.
 * Validates emails, checks for duplicates, and inserts new leads.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getMythoriaDb } from '@/db';
import { leads } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { normalizeEmail, normalizeName } from '@/lib/lead-normalization';

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Parse CSV content with proper handling of quoted fields
 */
function parseCSV(content: string): Array<Record<string, string>> {
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length < 2) {
    throw new Error('CSV file must contain a header row and at least one data row');
  }

  // Parse CSV row with support for quoted fields
  function parseCSVRow(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        // Handle escaped quotes ("")
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Push the last field
    values.push(current.trim());
    return values;
  }

  const headers = parseCSVRow(lines[0]).map((h) => h.toLowerCase());
  const emailIndex = headers.indexOf('email');

  if (emailIndex === -1) {
    throw new Error('CSV file must contain an "email" column');
  }

  const rows: Array<Record<string, string>> = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVRow(lines[i]);
    if (values.length !== headers.length) {
      continue; // Skip malformed rows
    }

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx];
    });
    rows.push(row);
  }

  return rows;
}

/**
 * POST /api/admin/leads/import
 *
 * Import leads from CSV file
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user domain
    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));
    if (!isAllowedDomain) {
      return NextResponse.json(
        { error: 'Access denied. Only authorized domains can import leads.' },
        { status: 403 },
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a CSV' }, { status: 400 });
    }

    // Read file content
    const content = await file.text();

    // Parse CSV
    let rows: Array<Record<string, string>>;
    try {
      rows = parseCSV(content);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to parse CSV' },
        { status: 400 },
      );
    }

    // Process leads
    const results = {
      success: 0,
      duplicates: 0,
      errors: [] as string[],
    };

    const db = getMythoriaDb();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because CSV is 1-indexed and has header row

      // Validate and normalize email
      const rawEmail = row.email?.trim();
      if (!rawEmail) {
        results.errors.push(`Row ${rowNum}: Missing email`);
        continue;
      }

      if (!isValidEmail(rawEmail)) {
        results.errors.push(`Row ${rowNum}: Invalid email format: ${rawEmail}`);
        continue;
      }

      const email = normalizeEmail(rawEmail);

      try {
        // Check for duplicate (using normalized email)
        const existing = await db.select().from(leads).where(eq(leads.email, email)).limit(1);

        if (existing.length > 0) {
          results.duplicates++;
          continue;
        }

        // Normalize name if provided
        const rawName = row.name?.trim();
        const name = rawName ? normalizeName(rawName) : null;

        // Insert new lead
        await db.insert(leads).values({
          email,
          name,
          mobilePhone: row.mobile_phone || row.mobilephone || row.phone || null,
          language: row.language || 'en-US',
          emailStatus: 'ready',
        });

        results.success++;
      } catch (error) {
        console.error(`Error inserting lead ${email}:`, error);
        results.errors.push(`Row ${rowNum}: Failed to insert ${email}`);
      }
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error) {
    console.error('CSV import error:', error);
    return NextResponse.json(
      {
        error: 'Failed to import CSV',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
