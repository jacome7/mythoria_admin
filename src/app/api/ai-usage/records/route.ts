import { NextRequest, NextResponse } from 'next/server';
import { getWorkflowsDb } from '@/db';
import { tokenUsageTracking } from '@/db/schema/workflows/token-usage';
import { and, gte, lte, desc, asc, eq, like, or, count } from 'drizzle-orm';
import { auth } from '@/auth';
import { ALLOWED_DOMAINS } from '@/config/auth';

// Type for valid AI action types
type AIActionType = 'story_structure' | 'story_outline' | 'chapter_writing' | 'image_generation' | 'story_review' | 'character_generation' | 'story_enhancement' | 'audio_generation' | 'content_validation' | 'image_edit' | 'test';

export interface TokenUsageRecord {
  tokenUsageId: string;
  authorId: string;
  storyId: string;
  action: string;
  aiModel: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostInEuros: string;
  createdAt: string;
}

export interface TokenUsageListResponse {
  records: TokenUsageRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function getDateRange(period: string): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case '1d':
      startDate.setDate(endDate.getDate() - 1);
      break;
    case '7d':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(endDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(endDate.getDate() - 90);
      break;
    default:
      startDate.setDate(endDate.getDate() - 30);
  }

  return { startDate, endDate };
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has access (domain validation)
    const isAllowedDomain = ALLOWED_DOMAINS.some(domain => 
      session.user?.email?.endsWith(domain)
    );

    if (!isAllowedDomain) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const model = searchParams.get('model') || '';
    const action = searchParams.get('action') || '';

    const { startDate, endDate } = getDateRange(period);
    const offset = (page - 1) * pageSize;

    const db = getWorkflowsDb();

    // Build where conditions
    const conditions = [
      gte(tokenUsageTracking.createdAt, startDate.toISOString()),
      lte(tokenUsageTracking.createdAt, endDate.toISOString())
    ];

    // Add search filter
    if (search) {
      conditions.push(
        or(
          like(tokenUsageTracking.aiModel, `%${search}%`),
          like(tokenUsageTracking.action, `%${search}%`),
          like(tokenUsageTracking.authorId, `%${search}%`),
          like(tokenUsageTracking.storyId, `%${search}%`)
        )!
      );
    }

    // Add model filter
    if (model) {
      conditions.push(eq(tokenUsageTracking.aiModel, model));
    }

    // Add action filter
    if (action) {
      conditions.push(eq(tokenUsageTracking.action, action as AIActionType));
    }

    const whereCondition = and(...conditions);

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(tokenUsageTracking)
      .where(whereCondition);

    // Determine sort column and order
    let orderByColumn;
    switch (sortBy) {
      case 'aiModel':
        orderByColumn = tokenUsageTracking.aiModel;
        break;
      case 'action':
        orderByColumn = tokenUsageTracking.action;
        break;
      case 'inputTokens':
        orderByColumn = tokenUsageTracking.inputTokens;
        break;
      case 'outputTokens':
        orderByColumn = tokenUsageTracking.outputTokens;
        break;
      case 'estimatedCostInEuros':
        orderByColumn = tokenUsageTracking.estimatedCostInEuros;
        break;
      case 'createdAt':
      default:
        orderByColumn = tokenUsageTracking.createdAt;
        break;
    }

    const orderByFunc = sortOrder === 'asc' ? asc : desc;

    // Get paginated records
    const records = await db
      .select({
        tokenUsageId: tokenUsageTracking.tokenUsageId,
        authorId: tokenUsageTracking.authorId,
        storyId: tokenUsageTracking.storyId,
        action: tokenUsageTracking.action,
        aiModel: tokenUsageTracking.aiModel,
        inputTokens: tokenUsageTracking.inputTokens,
        outputTokens: tokenUsageTracking.outputTokens,
        estimatedCostInEuros: tokenUsageTracking.estimatedCostInEuros,
        createdAt: tokenUsageTracking.createdAt,
      })
      .from(tokenUsageTracking)
      .where(whereCondition)
      .orderBy(orderByFunc(orderByColumn))
      .limit(pageSize)
      .offset(offset);

    // Calculate total tokens for each record
    const enhancedRecords: TokenUsageRecord[] = records.map(record => ({
      ...record,
      totalTokens: record.inputTokens + record.outputTokens
    }));

    const totalPages = Math.ceil(total / pageSize);

    const response: TokenUsageListResponse = {
      records: enhancedRecords,
      total,
      page,
      pageSize,
      totalPages
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching token usage records:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
