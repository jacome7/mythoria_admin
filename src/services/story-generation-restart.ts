import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { getMythoriaDb } from '@/db';
import { stories, storyGenerationRequests } from '@/db/schema';
import { publishStoryRequest } from '@/lib/pubsub';

export type StoryGenerationRestartSource = 'mythoria-admin' | 'mythoria-admin-mcp';

export interface RestartStoryGenerationInput {
  storyId: string;
  source: StoryGenerationRestartSource;
  requestedBy?: string;
}

export interface RestartStoryGenerationResult {
  storyId: string;
  runId: string;
  status: 'published' | 'publishing' | 'retrying';
  messageId?: string;
  dispatchError?: string;
}

export class StoryGenerationRestartError extends Error {
  constructor(
    readonly status: 404 | 409,
    readonly code: 'story_not_found' | 'story_not_restartable',
    message: string,
  ) {
    super(message);
    this.name = 'StoryGenerationRestartError';
  }
}

const retryAt = (attempts: number): Date => {
  const delayMinutes = Math.min(60, 2 ** Math.max(0, attempts));
  return new Date(Date.now() + delayMinutes * 60_000);
};

/**
 * Queue and immediately attempt one durable story restart dispatch.
 *
 * The shared mythoria_db request row is authoritative. The WebApp outbox drain
 * retries rows left in `retrying`; SGW creates or claims the workflows_db run.
 */
export async function restartStoryGeneration(
  input: RestartStoryGenerationInput,
): Promise<RestartStoryGenerationResult> {
  const db = getMythoriaDb();
  const runId = randomUUID();

  await db.transaction(async (tx) => {
    const [story] = await tx
      .select({
        storyId: stories.storyId,
        authorId: stories.authorId,
        status: stories.status,
      })
      .from(stories)
      .where(eq(stories.storyId, input.storyId));

    if (!story) {
      throw new StoryGenerationRestartError(404, 'story_not_found', 'Story not found');
    }

    if (story.status !== 'writing' && story.status !== 'published') {
      throw new StoryGenerationRestartError(
        409,
        'story_not_restartable',
        'Only stories in "writing" or "published" status can be restarted',
      );
    }

    await tx.insert(storyGenerationRequests).values({
      runId,
      storyId: story.storyId,
      authorId: story.authorId,
      idempotencyKey: `${input.source}:story-restart:${runId}`,
      creditsSpent: 0,
      status: 'queued',
    });

    await tx
      .update(stories)
      .set({ storyGenerationStatus: 'queued', updatedAt: new Date() })
      .where(eq(stories.storyId, story.storyId));
  });

  const claimTime = new Date();
  const [claimed] = await db
    .update(storyGenerationRequests)
    .set({ status: 'publishing', updatedAt: claimTime })
    .where(
      and(eq(storyGenerationRequests.runId, runId), eq(storyGenerationRequests.status, 'queued')),
    )
    .returning();

  if (!claimed) {
    const [request] = await db
      .select()
      .from(storyGenerationRequests)
      .where(eq(storyGenerationRequests.runId, runId));
    if (!request) {
      throw new Error(`Restart request disappeared before dispatch: ${runId}`);
    }

    console.info('Story generation restart queued for another dispatcher', {
      storyId: input.storyId,
      runId,
      source: input.source,
      requestedBy: input.requestedBy,
      status: request.status,
    });

    return {
      storyId: input.storyId,
      runId,
      status: request.status === 'published' ? 'published' : 'publishing',
      ...(request.messageId ? { messageId: request.messageId } : {}),
    };
  }

  try {
    const messageId = await publishStoryRequest({ storyId: input.storyId, runId });
    await db
      .update(storyGenerationRequests)
      .set({
        status: 'published',
        messageId,
        publishedAt: new Date(),
        publishAttempts: claimed.publishAttempts + 1,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(storyGenerationRequests.runId, runId),
          eq(storyGenerationRequests.status, 'publishing'),
        ),
      );

    console.info('Story generation restart published', {
      storyId: input.storyId,
      runId,
      messageId,
      source: input.source,
      requestedBy: input.requestedBy,
    });

    return { storyId: input.storyId, runId, status: 'published', messageId };
  } catch (error) {
    const dispatchError = (error instanceof Error ? error.message : String(error)).slice(0, 2000);
    const attempts = claimed.publishAttempts + 1;

    await db
      .update(storyGenerationRequests)
      .set({
        status: 'retrying',
        publishAttempts: attempts,
        availableAt: retryAt(attempts),
        lastError: dispatchError,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(storyGenerationRequests.runId, runId),
          eq(storyGenerationRequests.status, 'publishing'),
        ),
      );

    console.error('Story generation restart dispatch failed; retry scheduled', {
      storyId: input.storyId,
      runId,
      source: input.source,
      requestedBy: input.requestedBy,
      error: dispatchError,
    });

    return { storyId: input.storyId, runId, status: 'retrying', dispatchError };
  }
}
