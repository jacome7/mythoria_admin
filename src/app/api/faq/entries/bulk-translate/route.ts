import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';
import { translateFaqEntryById } from '@/lib/faq/translation';

type JobStatus = 'pending' | 'in-progress' | 'completed' | 'failed';
type JobItemStatus = 'pending' | 'translating' | 'completed' | 'skipped' | 'error';

type JobItem = {
  entryId: string;
  faqKey?: string;
  sourceLocale?: string;
  status: JobItemStatus;
  message?: string;
  createdTranslations?: number;
  targetLocales?: string[];
  errors?: string[];
};

type JobSummary = {
  total: number;
  completed: number;
  skipped: number;
  errors: number;
  translationsCreated: number;
};

type Job = {
  id: string;
  status: JobStatus;
  requestedBy: string;
  createdAt: string;
  updatedAt: string;
  items: JobItem[];
  summary: JobSummary;
};

const translationJobs = new Map<string, Job>();

function updateJob(jobId: string, updates: Partial<Job>) {
  const job = translationJobs.get(jobId);

  if (!job) return;

  const nextJob = {
    ...job,
    ...updates,
    updatedAt: new Date().toISOString(),
  } satisfies Job;

  translationJobs.set(jobId, nextJob);
}

async function processJob(jobId: string, entryIds: string[], requestedBy: string) {
  updateJob(jobId, { status: 'in-progress' });

  for (const entryId of entryIds) {
    const job = translationJobs.get(jobId);

    if (!job) {
      break;
    }

    const itemIndex = job.items.findIndex((item) => item.entryId === entryId);
    if (itemIndex === -1) {
      continue;
    }

    const item = job.items[itemIndex];
    job.items[itemIndex] = { ...item, status: 'translating' };
    translationJobs.set(jobId, { ...job, updatedAt: new Date().toISOString() });

    try {
      const result = await translateFaqEntryById(entryId, requestedBy);

      if (result.outcome === 'not_found') {
        job.items[itemIndex] = {
          ...item,
          status: 'error',
          message: 'FAQ entry not found',
        };
        job.summary.errors += 1;
        translationJobs.set(jobId, { ...job, updatedAt: new Date().toISOString() });
        continue;
      }

      if (result.outcome === 'nothing_to_translate') {
        job.items[itemIndex] = {
          ...item,
          status: 'skipped',
          message: 'All locales already translated',
          faqKey: result.sourceEntry.faqKey,
          sourceLocale: result.sourceEntry.locale,
          targetLocales: result.targetLocales,
        };
        job.summary.skipped += 1;
        translationJobs.set(jobId, { ...job, updatedAt: new Date().toISOString() });
        continue;
      }

      job.summary.completed += 1;
      job.summary.translationsCreated += result.createdEntries.length;

      job.items[itemIndex] = {
        ...item,
        status: result.errors?.length ? 'error' : 'completed',
        faqKey: result.sourceEntry.faqKey,
        sourceLocale: result.sourceEntry.locale,
        targetLocales: result.targetLocales,
        createdTranslations: result.createdEntries.length,
        errors: result.errors?.map((e) => `${e.locale}: ${e.error}`),
        message: result.errors?.length
          ? `Created ${result.createdEntries.length} translations with ${result.errors.length} errors`
          : `Created ${result.createdEntries.length} translations`,
      };

      if (result.errors?.length) {
        job.summary.errors += 1;
      }

      translationJobs.set(jobId, { ...job, updatedAt: new Date().toISOString() });
    } catch (error) {
      console.error('Bulk translation worker error:', error);
      job.items[itemIndex] = {
        ...item,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unexpected error during translation',
      };
      job.summary.errors += 1;
      translationJobs.set(jobId, { ...job, updatedAt: new Date().toISOString() });
    }
  }

  const finalJob = translationJobs.get(jobId);

  if (!finalJob) return;

  const hasOnlyErrors =
    finalJob.summary.completed === 0 && finalJob.summary.skipped === 0 && finalJob.summary.errors > 0;

  translationJobs.set(jobId, {
    ...finalJob,
    status: hasOnlyErrors ? 'failed' : 'completed',
    updatedAt: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  }

  const job = translationJobs.get(jobId);

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({ job });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAllowedDomain = ALLOWED_DOMAINS.some((domain) => session.user?.email?.endsWith(domain));

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const entryIds = (body.entryIds as string[])?.filter(Boolean) || [];

    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json({ error: 'entryIds is required' }, { status: 400 });
    }

    const jobId = randomUUID();
    const createdAt = new Date().toISOString();
    const job: Job = {
      id: jobId,
      status: 'pending',
      requestedBy: session.user.email,
      createdAt,
      updatedAt: createdAt,
      items: entryIds.map((entryId) => ({
        entryId,
        status: 'pending',
      })),
      summary: {
        total: entryIds.length,
        completed: 0,
        skipped: 0,
        errors: 0,
        translationsCreated: 0,
      },
    };

    translationJobs.set(jobId, job);

    processJob(jobId, entryIds, session.user.email).catch((error) => {
      console.error('Bulk translation job failed to start:', error);
      updateJob(jobId, { status: 'failed' });
    });

    return NextResponse.json({
      job,
      message: 'Bulk translation queued',
    });
  } catch (error) {
    console.error('Error starting bulk translation job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
