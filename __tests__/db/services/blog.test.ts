/**
 * @jest-environment node
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { blogPostTranslations } from '@/db/schema/blog/blog';

jest.mock('@/db/index', () => ({
  getMythoriaDb: jest.fn(),
}));

let adminBlogService: typeof import('@/db/services/blog').adminBlogService;
const { getMythoriaDb } = jest.requireMock('@/db/index') as {
  getMythoriaDb: jest.Mock;
};

beforeAll(async () => {
  ({ adminBlogService } = await import('@/db/services/blog'));
});

function createSelectChain<T>(rows: T[]) {
  const chain: any = {
    from: jest.fn(),
    where: jest.fn(),
    orderBy: jest.fn(),
    then: (resolve: any, reject?: any) => Promise.resolve(rows).then(resolve, reject),
  };

  chain.from.mockReturnValue(chain);
  chain.where.mockReturnValue(chain);
  chain.orderBy.mockResolvedValue(rows);

  return chain;
}

function createUpsertChain() {
  const chain: any = {
    values: jest.fn(),
    onConflictDoUpdate: jest.fn(),
  };

  chain.values.mockReturnValue(chain);
  chain.onConflictDoUpdate.mockResolvedValue(undefined);

  return chain;
}

describe('adminBlogService', () => {
  const getMythoriaDbMock = getMythoriaDb as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('upserts translations by post and locale, including contentMdx updates', async () => {
    const post = {
      id: 'post-1',
      slugBase: 'existing-slug',
      status: 'draft',
      heroImageUrl: null,
      publishedAt: null,
    };
    const translations = [
      {
        id: 'translation-1',
        postId: 'post-1',
        locale: 'pt-PT',
        slug: 'existing-slug',
        title: 'Existing title',
        summary: 'Existing summary',
        contentMdx: 'Updated content...',
      },
    ];
    const upsertChain = createUpsertChain();
    const db = {
      insert: jest.fn().mockReturnValue(upsertChain),
      select: jest
        .fn()
        .mockReturnValueOnce(createSelectChain([post]))
        .mockReturnValueOnce(createSelectChain(translations)),
    };
    getMythoriaDbMock.mockReturnValue(db as never);

    const result = await adminBlogService.upsertTranslation('post-1', {
      locale: 'pt-PT',
      slug: 'existing-slug',
      title: 'Existing title',
      summary: 'Existing summary',
      contentMdx: 'Updated content...',
    });

    expect(db.insert).toHaveBeenCalledWith(blogPostTranslations);
    expect(upsertChain.values).toHaveBeenCalledWith({
      postId: 'post-1',
      locale: 'pt-PT',
      slug: 'existing-slug',
      title: 'Existing title',
      summary: 'Existing summary',
      contentMdx: 'Updated content...',
    });

    const conflictArgs = upsertChain.onConflictDoUpdate.mock.calls[0]?.[0] as {
      target: unknown;
      set: Record<string, unknown>;
    };
    expect(conflictArgs.target).toEqual([blogPostTranslations.postId, blogPostTranslations.locale]);
    expect(conflictArgs.set).toMatchObject({
      slug: 'existing-slug',
      title: 'Existing title',
      summary: 'Existing summary',
      contentMdx: 'Updated content...',
    });
    expect(conflictArgs.set.updatedAt).toBeInstanceOf(Date);
    expect(result).toEqual({ post, translations });
  });

  it('rejects invalid slugs before issuing an upsert', async () => {
    const db = {
      insert: jest.fn(),
    };
    getMythoriaDbMock.mockReturnValue(db as never);

    await expect(
      adminBlogService.upsertTranslation('post-1', {
        locale: 'pt-PT',
        slug: 'Invalid Slug',
        title: 'Existing title',
        summary: 'Existing summary',
        contentMdx: 'Updated content...',
      }),
    ).rejects.toThrow('Invalid slug');
    expect(db.insert).not.toHaveBeenCalled();
  });
});
