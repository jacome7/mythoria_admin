import { NextResponse, type NextRequest } from 'next/server';
import { authenticateAdmin } from '@/lib/api-helpers';
import { readFile } from 'fs/promises';
import { join } from 'path';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const SGW_URL = process.env.STORY_GENERATION_WORKFLOW_URL || '';
const SGW_API_KEY = process.env.STORY_GENERATION_WORKFLOW_API_KEY || '';

/** Map of template names to filesystem paths (relative to project root). */
const TEMPLATE_MAP: Record<string, string> = {
  default: join(process.cwd(), 'src', 'templates', 'email', 'template.html.hbs'),
  'story-launch': join(process.cwd(), 'src', 'templates', 'email', 'story-launch.html.hbs'),
  'enchanted-scroll': join(process.cwd(), 'src', 'templates', 'email', 'enchanted-scroll.html.hbs'),
  'minimal-ink': join(process.cwd(), 'src', 'templates', 'email', 'minimal-ink.html.hbs'),
  'aurora-split': join(process.cwd(), 'src', 'templates', 'email', 'aurora-split.html.hbs'),
};

/**
 * POST /api/email-campaigns/[id]/generate-assets
 * Trigger an async email asset generation job on the Story Generation Workflow.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const result = await authenticateAdmin();
    if ('error' in result) return result.error;

    const { id: campaignId } = await params;
    const body = await request.json();

    const { sourceLocale, subject, bodyDescription, templateName } = body;

    // Validate required fields
    if (!sourceLocale || !subject || !bodyDescription) {
      return NextResponse.json(
        { error: 'sourceLocale, subject, and bodyDescription are required' },
        { status: 400 },
      );
    }

    // Resolve the template
    const resolvedTemplateName = templateName || 'default';
    const templatePath = TEMPLATE_MAP[resolvedTemplateName];
    if (!templatePath) {
      return NextResponse.json(
        { error: `Unknown template: ${resolvedTemplateName}` },
        { status: 400 },
      );
    }

    let templateHtml: string;
    try {
      templateHtml = await readFile(templatePath, 'utf-8');
    } catch {
      console.error(`Failed to read email template at ${templatePath}`);
      return NextResponse.json({ error: 'Failed to load email template' }, { status: 500 });
    }

    // Forward to SGW async job API
    const sgwResponse = await fetch(`${SGW_URL}/api/jobs/generate-email-assets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': SGW_API_KEY,
      },
      body: JSON.stringify({
        sourceLocale,
        subject,
        bodyDescription,
        templateHtml,
        campaignId,
      }),
    });

    const sgwData = await sgwResponse.json();

    if (!sgwResponse.ok) {
      console.error('SGW generate-email-assets error:', sgwData);
      return NextResponse.json(
        { error: sgwData.error || 'Failed to start email asset generation' },
        { status: sgwResponse.status },
      );
    }

    return NextResponse.json(sgwData);
  } catch (error) {
    console.error('Error in generate-assets POST:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/email-campaigns/[id]/generate-assets?jobId=xxx
 * Poll the async job status on the Story Generation Workflow.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const result = await authenticateAdmin();
    if ('error' in result) return result.error;

    // params.id is the campaign id — available for logging but not used directly
    await params;

    const jobId = request.nextUrl.searchParams.get('jobId');
    if (!jobId) {
      return NextResponse.json({ error: 'jobId query parameter is required' }, { status: 400 });
    }

    const sgwResponse = await fetch(`${SGW_URL}/api/jobs/${jobId}`, {
      method: 'GET',
      headers: {
        'x-api-key': SGW_API_KEY,
      },
    });

    const sgwData = await sgwResponse.json();

    if (!sgwResponse.ok) {
      return NextResponse.json(
        { error: sgwData.error || 'Failed to fetch job status' },
        { status: sgwResponse.status },
      );
    }

    return NextResponse.json(sgwData);
  } catch (error) {
    console.error('Error in generate-assets GET:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
