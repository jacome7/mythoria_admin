import { getMythoriaDb, getWorkflowsDb } from './index';
import { count, desc, eq, like, asc, sql, or, inArray, and, gte, lt } from 'drizzle-orm';
import {
  authors,
  stories,
  printRequests,
  creditLedger,
  authorCreditBalances,
  creditPackages,
  pricing,
  leads,
  emailStatusEnum,
  paymentOrders,
  faqSections,
  faqEntries,
} from './schema';
import { promotionCodes, promotionCodeRedemptions } from './schema/promotion-codes';
import { storyGenerationRuns, storyGenerationSteps } from './schema/workflows';
import type { RegistrationAggregation, RegistrationRange } from '@/lib/analytics/registrations';
import type { RevenueAggregation } from '@/lib/analytics/revenue';
import type { ServiceUsageAggregation, ServiceUsageEventType } from '@/lib/analytics/service-usage';
import { SERVICE_USAGE_EVENT_TYPES } from '@/lib/analytics/service-usage';
export { adminBlogService } from './services/blog';

type EmailStatus = (typeof emailStatusEnum.enumValues)[number];

const REGISTRATION_RANGE_TO_DAYS: Record<Exclude<RegistrationRange, 'forever'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

const toIsoString = (value: string | Date) => new Date(value).toISOString();

const startOfUtcDay = (date: Date) => {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
};

const startOfUtcMonth = (date: Date) => {
  const copy = startOfUtcDay(date);
  copy.setUTCDate(1);
  return copy;
};

export const adminService = {
  // ---------------------------------------------------------------------------
  // Promotion Codes
  // ---------------------------------------------------------------------------
  async getPromotionCodes(
    page: number = 1,
    limit: number = 50,
    searchTerm?: string,
    typeFilter?: string,
    activeFilter?: string,
  ) {
    const db = getMythoriaDb();
    const offset = (page - 1) * limit;

    // Build where conditions dynamically
    type Condition = ReturnType<typeof like> | ReturnType<typeof eq>;
    const conditions: Condition[] = [];
    if (searchTerm && searchTerm.trim()) {
      const pattern = `%${searchTerm.trim().toUpperCase()}%`;
      conditions.push(like(sql`UPPER(${promotionCodes.code})`, pattern));
    }
    if (typeFilter && typeFilter !== 'all') {
      conditions.push(eq(promotionCodes.type, typeFilter));
    }
    if (activeFilter === 'true') {
      conditions.push(eq(promotionCodes.active, true));
    } else if (activeFilter === 'false') {
      conditions.push(eq(promotionCodes.active, false));
    }

    const whereClause: Condition | undefined = conditions.length
      ? conditions
          .slice(1)
          .reduce<Condition>((acc, cur) => and(acc, cur) as Condition, conditions[0])
      : undefined;

    // Total count (separate query for accurate pagination)
    const totalCountResult = await db
      .select({ value: count() })
      .from(promotionCodes)
      .where(whereClause ?? sql`true`);
    const totalCount = totalCountResult[0]?.value || 0;

    // Fetch base rows
    const baseSelect = db.select().from(promotionCodes);
    const rows = await (whereClause ? baseSelect.where(whereClause) : baseSelect)
      .orderBy(desc(promotionCodes.createdAt))
      .limit(limit)
      .offset(offset);

    if (rows.length === 0) {
      return {
        data: [],
        pagination: { page, limit, totalCount, totalPages: 0, hasNext: false, hasPrev: page > 1 },
      };
    }

    // Get redemption counts in batch
    const codeIds = rows.map((r) => r.promotionCodeId);
    const redemptionCounts = await db
      .select({ promotionCodeId: promotionCodeRedemptions.promotionCodeId, value: count() })
      .from(promotionCodeRedemptions)
      .where(inArray(promotionCodeRedemptions.promotionCodeId, codeIds))
      .groupBy(promotionCodeRedemptions.promotionCodeId);
    const redemptionMap = new Map(redemptionCounts.map((rc) => [rc.promotionCodeId, rc.value]));

    const data = rows.map((r) => {
      const totalRedemptions = redemptionMap.get(r.promotionCodeId) || 0;
      const remainingGlobal =
        r.maxGlobalRedemptions != null
          ? Math.max(r.maxGlobalRedemptions - totalRedemptions, 0)
          : null;
      return {
        ...r,
        totalRedemptions,
        remainingGlobal,
      };
    });

    return {
      data,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: offset + rows.length < totalCount,
        hasPrev: page > 1,
      },
    };
  },

  async getPromotionCodeById(promotionCodeId: string) {
    const db = getMythoriaDb();
    const [row] = await db
      .select()
      .from(promotionCodes)
      .where(eq(promotionCodes.promotionCodeId, promotionCodeId));
    if (!row) return null;

    const [aggregate] = await db
      .select({
        totalRedemptions: count(promotionCodeRedemptions.promotionCodeRedemptionId),
      })
      .from(promotionCodeRedemptions)
      .where(eq(promotionCodeRedemptions.promotionCodeId, promotionCodeId));

    const [uniqueUsersResult] = await db
      .select({ value: count(sql`DISTINCT ${promotionCodeRedemptions.authorId}`) })
      .from(promotionCodeRedemptions)
      .where(eq(promotionCodeRedemptions.promotionCodeId, promotionCodeId));

    const totalRedemptions = aggregate?.totalRedemptions || 0;
    const uniqueUsers = uniqueUsersResult?.value || 0;
    const remainingGlobal =
      row.maxGlobalRedemptions != null
        ? Math.max(row.maxGlobalRedemptions - totalRedemptions, 0)
        : null;

    return {
      ...row,
      totalRedemptions,
      uniqueUsers,
      remainingGlobal,
    };
  },

  async getPromotionCodeRedemptions(promotionCodeId: string, page: number = 1, limit: number = 50) {
    const db = getMythoriaDb();
    const offset = (page - 1) * limit;

    const totalCountResult = await db
      .select({ value: count() })
      .from(promotionCodeRedemptions)
      .where(eq(promotionCodeRedemptions.promotionCodeId, promotionCodeId));
    const totalCount = totalCountResult[0]?.value || 0;

    if (totalCount === 0) {
      return {
        data: [],
        pagination: {
          page,
          limit,
          totalCount: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: page > 1,
        },
      };
    }

    const rows = await db
      .select({
        promotionCodeRedemptionId: promotionCodeRedemptions.promotionCodeRedemptionId,
        promotionCodeId: promotionCodeRedemptions.promotionCodeId,
        authorId: promotionCodeRedemptions.authorId,
        creditsGranted: promotionCodeRedemptions.creditsGranted,
        redeemedAt: promotionCodeRedemptions.redeemedAt,
        authorDisplayName: authors.displayName,
        authorEmail: authors.email,
      })
      .from(promotionCodeRedemptions)
      .innerJoin(authors, eq(promotionCodeRedemptions.authorId, authors.authorId))
      .where(eq(promotionCodeRedemptions.promotionCodeId, promotionCodeId))
      .orderBy(desc(promotionCodeRedemptions.redeemedAt))
      .limit(limit)
      .offset(offset);

    return {
      data: rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: offset + rows.length < totalCount,
        hasPrev: page > 1,
      },
    };
  },

  async createPromotionCode(input: {
    code: string;
    type: string;
    creditAmount: number;
    maxGlobalRedemptions?: number | null;
    maxRedemptionsPerUser?: number;
    validFrom?: string | null;
    validUntil?: string | null;
    active?: boolean;
  }) {
    const db = getMythoriaDb();

    // Normalize & validate
    const code = input.code.trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,64}$/.test(code)) {
      throw Object.assign(new Error('invalid_code_format'), { code: 'invalid_code_format' });
    }
    if (input.creditAmount <= 0) {
      throw Object.assign(new Error('invalid_credit_amount'), { code: 'invalid_credit_amount' });
    }
    if (input.validFrom && input.validUntil) {
      const from = new Date(input.validFrom);
      const until = new Date(input.validUntil);
      if (from >= until) {
        throw Object.assign(new Error('invalid_validity_window'), {
          code: 'invalid_validity_window',
        });
      }
    }

    try {
      const [created] = await db
        .insert(promotionCodes)
        .values({
          code,
          type: input.type || 'partner',
          creditAmount: input.creditAmount,
          maxGlobalRedemptions: input.maxGlobalRedemptions ?? null,
          maxRedemptionsPerUser: input.maxRedemptionsPerUser ?? 1,
          validFrom: input.validFrom ? new Date(input.validFrom) : undefined,
          validUntil: input.validUntil ? new Date(input.validUntil) : undefined,
          active: input.active ?? true,
        })
        .returning();
      return created;
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'message' in e) {
        const msg = String((e as { message?: string }).message).toLowerCase();
        if (msg.includes('duplicate') || msg.includes('unique')) {
          throw Object.assign(new Error('code_exists'), { code: 'code_exists' });
        }
      }
      throw e;
    }
  },

  async togglePromotionCodeActive(promotionCodeId: string) {
    const db = getMythoriaDb();
    const [existing] = await db
      .select({ active: promotionCodes.active })
      .from(promotionCodes)
      .where(eq(promotionCodes.promotionCodeId, promotionCodeId));
    if (!existing) return null;
    const [updated] = await db
      .update(promotionCodes)
      .set({ active: !existing.active, updatedAt: new Date() })
      .where(eq(promotionCodes.promotionCodeId, promotionCodeId))
      .returning();
    return updated;
  },
  // KPI operations
  async getTotalAuthorsCount() {
    const db = getMythoriaDb();
    // This assumes the authors table exists in the schema
    // We'll need to import the actual schema
    const result = await db.select({ value: count() }).from(authors);
    return result[0]?.value || 0;
  },

  async getTotalStoriesCount() {
    const db = getMythoriaDb();
    const result = await db.select({ value: count() }).from(stories);
    return result[0]?.value || 0;
  },

  async getTotalPrintRequestsCount() {
    const db = getMythoriaDb();
    const result = await db.select({ value: count() }).from(printRequests);
    return result[0]?.value || 0;
  },

  async getAuthorRegistrations(range: RegistrationRange): Promise<RegistrationAggregation> {
    const db = getMythoriaDb();
    const today = startOfUtcDay(new Date());

    if (range === 'forever') {
      const rows = await db
        .select({
          bucketStart: sql<string>`date_trunc('month', ${authors.createdAt})`,
          registrations: count(authors.authorId),
        })
        .from(authors)
        .groupBy(sql`date_trunc('month', ${authors.createdAt})`)
        .orderBy(sql`date_trunc('month', ${authors.createdAt})`);

      const normalizedBuckets = rows.map((row) => ({
        bucketStart: toIsoString(row.bucketStart),
        registrations: Number(row.registrations) || 0,
      }));

      const defaultMonth = startOfUtcMonth(today).toISOString();
      const startDate = normalizedBuckets.length ? normalizedBuckets[0].bucketStart : defaultMonth;
      const endDate = normalizedBuckets.length
        ? normalizedBuckets[normalizedBuckets.length - 1].bucketStart
        : defaultMonth;

      return {
        range,
        granularity: 'month',
        startDate,
        endDate,
        buckets: normalizedBuckets,
      };
    }

    const days = REGISTRATION_RANGE_TO_DAYS[range];
    const startDate = startOfUtcDay(new Date(today));
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

    const rows = await db
      .select({
        bucketStart: sql<string>`date_trunc('day', ${authors.createdAt})`,
        registrations: count(authors.authorId),
      })
      .from(authors)
      .where(gte(authors.createdAt, startDate))
      .groupBy(sql`date_trunc('day', ${authors.createdAt})`)
      .orderBy(sql`date_trunc('day', ${authors.createdAt})`);

    const normalizedBuckets = rows.map((row) => ({
      bucketStart: toIsoString(row.bucketStart),
      registrations: Number(row.registrations) || 0,
    }));

    return {
      range,
      granularity: 'day',
      startDate: startDate.toISOString(),
      endDate: today.toISOString(),
      buckets: normalizedBuckets,
    };
  },

  async getServiceUsage(range: RegistrationRange): Promise<ServiceUsageAggregation> {
    const db = getMythoriaDb();
    const today = startOfUtcDay(new Date());

    if (range === 'forever') {
      const rows = await db
        .select({
          bucketStart: sql<string>`date_trunc('month', ${creditLedger.createdAt})`,
          eventType: creditLedger.creditEventType,
          actionCount: count(creditLedger.id),
          creditsSpent: sql<number>`SUM(${creditLedger.amount})`,
        })
        .from(creditLedger)
        .where(
          and(
            lt(creditLedger.amount, 0),
            inArray(creditLedger.creditEventType, SERVICE_USAGE_EVENT_TYPES),
          ),
        )
        .groupBy(sql`date_trunc('month', ${creditLedger.createdAt})`, creditLedger.creditEventType)
        .orderBy(sql`date_trunc('month', ${creditLedger.createdAt})`);

      const normalizedRows = rows.map((row) => ({
        bucketStart: toIsoString(row.bucketStart),
        eventType: row.eventType as ServiceUsageEventType,
        actionCount: Number(row.actionCount) || 0,
        creditsSpent: Math.abs(Number(row.creditsSpent) || 0),
      }));

      const defaultMonth = startOfUtcMonth(today).toISOString();
      const startDate = normalizedRows.length ? normalizedRows[0].bucketStart : defaultMonth;
      const endDate = normalizedRows.length
        ? normalizedRows[normalizedRows.length - 1].bucketStart
        : defaultMonth;

      return {
        range,
        granularity: 'month',
        startDate,
        endDate,
        rows: normalizedRows,
      };
    }

    const days = REGISTRATION_RANGE_TO_DAYS[range];
    const startDate = startOfUtcDay(new Date(today));
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

    const rows = await db
      .select({
        bucketStart: sql<string>`date_trunc('day', ${creditLedger.createdAt})`,
        eventType: creditLedger.creditEventType,
        actionCount: count(creditLedger.id),
        creditsSpent: sql<number>`SUM(${creditLedger.amount})`,
      })
      .from(creditLedger)
      .where(
        and(
          gte(creditLedger.createdAt, startDate),
          lt(creditLedger.amount, 0),
          inArray(creditLedger.creditEventType, SERVICE_USAGE_EVENT_TYPES),
        ),
      )
      .groupBy(sql`date_trunc('day', ${creditLedger.createdAt})`, creditLedger.creditEventType)
      .orderBy(sql`date_trunc('day', ${creditLedger.createdAt})`);

    const normalizedRows = rows.map((row) => ({
      bucketStart: toIsoString(row.bucketStart),
      eventType: row.eventType as ServiceUsageEventType,
      actionCount: Number(row.actionCount) || 0,
      creditsSpent: Math.abs(Number(row.creditsSpent) || 0),
    }));

    return {
      range,
      granularity: 'day',
      startDate: startDate.toISOString(),
      endDate: today.toISOString(),
      rows: normalizedRows,
    };
  },

  async getRevenueSnapshot(range: RegistrationRange): Promise<RevenueAggregation> {
    const db = getMythoriaDb();
    const today = startOfUtcDay(new Date());

    if (range === 'forever') {
      const rows = await db
        .select({
          bucketStart: sql<string>`date_trunc('month', ${paymentOrders.createdAt})`,
          revenueCents: sql<number>`COALESCE(SUM(${paymentOrders.amount}), 0)`,
          transactions: count(paymentOrders.orderId),
        })
        .from(paymentOrders)
        .where(eq(paymentOrders.status, 'completed'))
        .groupBy(sql`date_trunc('month', ${paymentOrders.createdAt})`)
        .orderBy(sql`date_trunc('month', ${paymentOrders.createdAt})`);

      const normalizedRows = rows.map((row) => ({
        bucketStart: toIsoString(row.bucketStart),
        revenueCents: Number(row.revenueCents) || 0,
        transactions: Number(row.transactions) || 0,
      }));

      const defaultMonth = startOfUtcMonth(today).toISOString();
      const startDate = normalizedRows.length ? normalizedRows[0].bucketStart : defaultMonth;
      const endDate = normalizedRows.length
        ? normalizedRows[normalizedRows.length - 1].bucketStart
        : defaultMonth;

      return {
        range,
        granularity: 'month',
        startDate,
        endDate,
        buckets: normalizedRows,
      };
    }

    const days = REGISTRATION_RANGE_TO_DAYS[range];
    const startDate = startOfUtcDay(new Date(today));
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

    const rows = await db
      .select({
        bucketStart: sql<string>`date_trunc('day', ${paymentOrders.createdAt})`,
        revenueCents: sql<number>`COALESCE(SUM(${paymentOrders.amount}), 0)`,
        transactions: count(paymentOrders.orderId),
      })
      .from(paymentOrders)
      .where(and(gte(paymentOrders.createdAt, startDate), eq(paymentOrders.status, 'completed')))
      .groupBy(sql`date_trunc('day', ${paymentOrders.createdAt})`)
      .orderBy(sql`date_trunc('day', ${paymentOrders.createdAt})`);

    const normalizedRows = rows.map((row) => ({
      bucketStart: toIsoString(row.bucketStart),
      revenueCents: Number(row.revenueCents) || 0,
      transactions: Number(row.transactions) || 0,
    }));

    return {
      range,
      granularity: 'day',
      startDate: startDate.toISOString(),
      endDate: today.toISOString(),
      buckets: normalizedRows,
    };
  },

  // User operations
  async getUsers(
    page: number = 1,
    limit: number = 100,
    searchTerm?: string,
    sortBy: 'displayName' | 'email' | 'createdAt' | 'lastLoginAt' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const db = getMythoriaDb();
    const offset = (page - 1) * limit;

    let whereCondition = undefined;
    if (searchTerm && searchTerm.trim()) {
      const searchPattern = `%${searchTerm.trim().toLowerCase()}%`;
      whereCondition = or(
        like(sql`LOWER(${authors.displayName})`, searchPattern),
        like(sql`LOWER(${authors.email})`, searchPattern),
        like(sql`LOWER(${authors.mobilePhone})`, searchPattern),
      );
    }

    const orderColumn =
      sortBy === 'displayName'
        ? authors.displayName
        : sortBy === 'email'
          ? authors.email
          : sortBy === 'lastLoginAt'
            ? authors.lastLoginAt
            : authors.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);

    const query = db.select().from(authors);
    if (whereCondition) {
      query.where(whereCondition);
    }

    const results = await query.orderBy(orderDirection).limit(limit).offset(offset);

    return results;
  },

  async getUserById(authorId: string) {
    const db = getMythoriaDb();
    const [user] = await db.select().from(authors).where(eq(authors.authorId, authorId));
    return user;
  },

  // Credit operations
  async getUserCreditBalance(authorId: string) {
    const db = getMythoriaDb();
    const [balance] = await db
      .select()
      .from(authorCreditBalances)
      .where(eq(authorCreditBalances.authorId, authorId));
    return balance?.totalCredits || 0;
  },

  async getUserCreditHistory(authorId: string) {
    const db = getMythoriaDb();
    const history = await db
      .select({
        id: creditLedger.id,
        amount: creditLedger.amount,
        creditEventType: creditLedger.creditEventType,
        createdAt: creditLedger.createdAt,
        storyId: creditLedger.storyId,
        purchaseId: creditLedger.purchaseId,
      })
      .from(creditLedger)
      .where(eq(creditLedger.authorId, authorId))
      .orderBy(desc(creditLedger.createdAt));

    // Calculate balance after each transaction
    const historyWithBalance = [];
    let runningBalance = 0;

    // Calculate each entry's balance after
    for (let i = history.length - 1; i >= 0; i--) {
      runningBalance += history[i].amount;
      historyWithBalance.unshift({
        ...history[i],
        balanceAfter: runningBalance,
      });
    }

    return historyWithBalance;
  },

  // User stories (for admin user detail page)
  async getUserStories(authorId: string) {
    const db = getMythoriaDb();
    const results = await db
      .select({
        storyId: stories.storyId,
        title: stories.title,
        status: stories.status,
        createdAt: stories.createdAt,
      })
      .from(stories)
      .where(eq(stories.authorId, authorId))
      .orderBy(desc(stories.createdAt));
    return results;
  },

  async assignCreditsToUser(
    authorId: string,
    amount: number,
    eventType: 'refund' | 'voucher' | 'promotion',
  ) {
    const db = getMythoriaDb();

    try {
      // Insert credit ledger entry
      await db.insert(creditLedger).values({
        authorId,
        amount,
        creditEventType: eventType,
        // createdAt is automatically set by defaultNow()
      });

      // Update author credit balance (or insert if doesn't exist)
      await db
        .insert(authorCreditBalances)
        .values({
          authorId,
          totalCredits: amount,
          // lastUpdated is automatically set by defaultNow()
        })
        .onConflictDoUpdate({
          target: authorCreditBalances.authorId,
          set: {
            totalCredits: sql`${authorCreditBalances.totalCredits} + ${amount}`,
            // lastUpdated is automatically updated
          },
        });

      return true;
    } catch (error) {
      console.error('Error assigning credits:', error);
      throw error;
    }
  },

  // Story operations
  async getStories(
    page: number = 1,
    limit: number = 100,
    searchTerm?: string,
    sortBy: 'title' | 'createdAt' | 'status' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const db = getMythoriaDb();
    const offset = (page - 1) * limit;

    let whereCondition = undefined;
    if (searchTerm && searchTerm.trim()) {
      const searchPattern = `%${searchTerm.trim().toLowerCase()}%`;
      whereCondition = like(stories.title, searchPattern);
    }

    const orderColumn =
      sortBy === 'title' ? stories.title : sortBy === 'status' ? stories.status : stories.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);

    const query = db.select().from(stories);
    if (whereCondition) {
      query.where(whereCondition);
    }

    const results = await query.orderBy(orderDirection).limit(limit).offset(offset);

    return results;
  },

  async getStoriesWithAuthors(
    page: number = 1,
    limit: number = 100,
    searchTerm?: string,
    statusFilter?: string,
    featuredFilter?: string,
    sortBy: 'title' | 'createdAt' | 'status' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const db = getMythoriaDb();
    const offset = (page - 1) * limit;

    const whereConditions = [];

    // Search filter
    if (searchTerm && searchTerm.trim()) {
      const searchPattern = `%${searchTerm.trim().toLowerCase()}%`;
      whereConditions.push(
        sql`(LOWER(${stories.title}) LIKE ${searchPattern} OR 
             LOWER(${authors.displayName}) LIKE ${searchPattern} OR 
             LOWER(${authors.email}) LIKE ${searchPattern})`,
      );
    }

    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      whereConditions.push(eq(stories.status, statusFilter as 'draft' | 'writing' | 'published'));
    }

    // Featured filter
    if (featuredFilter && featuredFilter !== 'all') {
      const isFeatured = featuredFilter === 'featured';
      whereConditions.push(eq(stories.isFeatured, isFeatured));
    }

    const orderColumn =
      sortBy === 'title' ? stories.title : sortBy === 'status' ? stories.status : stories.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);

    // Build the query with conditional where clause
    const baseQuery = db
      .select({
        storyId: stories.storyId,
        title: stories.title,
        status: stories.status,
        chapterCount: stories.chapterCount,
        createdAt: stories.createdAt,
        updatedAt: stories.updatedAt,
        isPublic: stories.isPublic,
        isFeatured: stories.isFeatured,
        interiorPdfUri: stories.interiorPdfUri,
        coverPdfUri: stories.coverPdfUri,
        // htmlUri/pdfUri removed
        author: {
          authorId: authors.authorId,
          displayName: authors.displayName,
          email: authors.email,
        },
      })
      .from(stories)
      .innerJoin(authors, eq(stories.authorId, authors.authorId));

    // Execute query with or without where conditions
    let results;
    if (whereConditions.length > 0) {
      let combinedCondition = whereConditions[0];
      for (let i = 1; i < whereConditions.length; i++) {
        combinedCondition = sql`${combinedCondition} AND ${whereConditions[i]}`;
      }

      results = await db
        .select({
          storyId: stories.storyId,
          title: stories.title,
          status: stories.status,
          chapterCount: stories.chapterCount,
          createdAt: stories.createdAt,
          updatedAt: stories.updatedAt,
          isPublic: stories.isPublic,
          isFeatured: stories.isFeatured,
          interiorPdfUri: stories.interiorPdfUri,
          coverPdfUri: stories.coverPdfUri,
          // htmlUri/pdfUri removed
          author: {
            authorId: authors.authorId,
            displayName: authors.displayName,
            email: authors.email,
          },
        })
        .from(stories)
        .innerJoin(authors, eq(stories.authorId, authors.authorId))
        .where(combinedCondition)
        .orderBy(orderDirection)
        .limit(limit)
        .offset(offset);
    } else {
      results = await baseQuery.orderBy(orderDirection).limit(limit).offset(offset);
    }

    return results;
  },

  async getStoryById(storyId: string) {
    const db = getMythoriaDb();
    const [story] = await db.select().from(stories).where(eq(stories.storyId, storyId));
    return story;
  },

  async getStoryByIdWithAuthor(storyId: string) {
    const db = getMythoriaDb();
    const [story] = await db
      .select({
        storyId: stories.storyId,
        title: stories.title,
        status: stories.status,
        chapterCount: stories.chapterCount,
        createdAt: stories.createdAt,
        updatedAt: stories.updatedAt,
        isPublic: stories.isPublic,
        isFeatured: stories.isFeatured,
        interiorPdfUri: stories.interiorPdfUri,
        coverPdfUri: stories.coverPdfUri,
        coverUri: stories.coverUri,
        backcoverUri: stories.backcoverUri,
        // htmlUri/pdfUri removed
        plotDescription: stories.plotDescription,
        synopsis: stories.synopsis,
        place: stories.place,
        additionalRequests: stories.additionalRequests,
        targetAudience: stories.targetAudience,
        novelStyle: stories.novelStyle,
        graphicalStyle: stories.graphicalStyle,
        featureImageUri: stories.featureImageUri,
        author: {
          authorId: authors.authorId,
          displayName: authors.displayName,
          email: authors.email,
        },
      })
      .from(stories)
      .innerJoin(authors, eq(stories.authorId, authors.authorId))
      .where(eq(stories.storyId, storyId));

    return story;
  },

  async updateStory(storyId: string, updates: Partial<typeof stories.$inferSelect>) {
    const db = getMythoriaDb();
    const [updatedStory] = await db
      .update(stories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(stories.storyId, storyId))
      .returning();

    return updatedStory;
  },

  async featureStory(storyId: string, featureImageUri: string) {
    const db = getMythoriaDb();
    const [updatedStory] = await db
      .update(stories)
      .set({
        isFeatured: true,
        featureImageUri: featureImageUri,
        updatedAt: new Date(),
      })
      .where(eq(stories.storyId, storyId))
      .returning();

    // Return the story with author information
    if (updatedStory) {
      return await this.getStoryByIdWithAuthor(storyId);
    }

    return null;
  },

  async unfeatureStory(storyId: string) {
    const db = getMythoriaDb();
    const [updatedStory] = await db
      .update(stories)
      .set({
        isFeatured: false,
        updatedAt: new Date(),
        // Note: We keep the featureImageUri for future reference
      })
      .where(eq(stories.storyId, storyId))
      .returning();

    // Return the story with author information
    if (updatedStory) {
      return await this.getStoryByIdWithAuthor(storyId);
    }

    return null;
  },

  // Print Request operations
  async getPrintRequests(
    page: number = 1,
    limit: number = 100,
    searchTerm?: string,
    sortBy: 'requestedAt' | 'status' = 'requestedAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const db = getMythoriaDb();
    const offset = (page - 1) * limit;

    // Search functionality can be implemented later
    // const whereCondition = undefined;
    // if (searchTerm && searchTerm.trim()) {
    //   const searchPattern = `%${searchTerm.trim().toLowerCase()}%`;
    //   // Search in multiple fields as appropriate
    // }

    const orderColumn = sortBy === 'status' ? printRequests.status : printRequests.requestedAt;
    const orderDirection = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);

    const query = db.select().from(printRequests);
    // if (whereCondition) {
    //   query.where(whereCondition);
    // }

    const results = await query.orderBy(orderDirection).limit(limit).offset(offset);

    return results;
  },

  // Credit Package operations
  async getCreditPackages(
    page: number = 1,
    limit: number = 100,
    sortBy: 'credits' | 'price' | 'createdAt' = 'price',
    sortOrder: 'asc' | 'desc' = 'asc',
  ) {
    const db = getMythoriaDb();
    const offset = (page - 1) * limit;

    const orderColumn =
      sortBy === 'credits'
        ? creditPackages.credits
        : sortBy === 'createdAt'
          ? creditPackages.createdAt
          : creditPackages.price;
    const orderDirection = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);

    const results = await db
      .select()
      .from(creditPackages)
      .orderBy(orderDirection)
      .limit(limit)
      .offset(offset);

    return results;
  },

  async getCreditPackageById(packageId: string) {
    const db = getMythoriaDb();
    const [creditPackage] = await db
      .select()
      .from(creditPackages)
      .where(eq(creditPackages.id, packageId));
    return creditPackage;
  },

  async updateCreditPackage(
    packageId: string,
    updates: Partial<typeof creditPackages.$inferSelect>,
  ) {
    const db = getMythoriaDb();
    const [updatedPackage] = await db
      .update(creditPackages)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(creditPackages.id, packageId))
      .returning();

    return updatedPackage;
  },

  async toggleCreditPackageStatus(packageId: string) {
    const db = getMythoriaDb();
    const currentPackage = await this.getCreditPackageById(packageId);
    if (!currentPackage) return null;

    const [updatedPackage] = await db
      .update(creditPackages)
      .set({
        isActive: !currentPackage.isActive,
        updatedAt: new Date(),
      })
      .where(eq(creditPackages.id, packageId))
      .returning();

    return updatedPackage;
  },

  async createCreditPackage(packageData: typeof creditPackages.$inferInsert) {
    const db = getMythoriaDb();
    const [newPackage] = await db
      .insert(creditPackages)
      .values({
        ...packageData,
        // createdAt and updatedAt are automatically set by defaultNow()
      })
      .returning();

    return newPackage;
  },

  async deleteCreditPackage(packageId: string) {
    const db = getMythoriaDb();
    await db.delete(creditPackages).where(eq(creditPackages.id, packageId));
    return true;
  },

  // Pricing Services operations
  async getPricingServices(
    page: number = 1,
    limit: number = 100,
    searchTerm?: string,
    sortBy: 'serviceCode' | 'credits' | 'isActive' | 'createdAt' = 'serviceCode',
    sortOrder: 'asc' | 'desc' = 'asc',
  ) {
    const db = getMythoriaDb();
    const offset = (page - 1) * limit;

    let whereCondition = undefined;
    if (searchTerm && searchTerm.trim()) {
      const searchPattern = `%${searchTerm.trim().toLowerCase()}%`;
      whereCondition = like(sql`LOWER(${pricing.serviceCode})`, searchPattern);
    }

    const orderColumn =
      sortBy === 'credits'
        ? pricing.credits
        : sortBy === 'isActive'
          ? pricing.isActive
          : sortBy === 'createdAt'
            ? pricing.createdAt
            : pricing.serviceCode;
    const orderDirection = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);

    const results = await db
      .select()
      .from(pricing)
      .where(whereCondition)
      .orderBy(orderDirection)
      .limit(limit)
      .offset(offset);

    return results;
  },

  async getPricingServiceById(serviceId: string) {
    const db = getMythoriaDb();
    const [service] = await db.select().from(pricing).where(eq(pricing.id, serviceId));
    return service;
  },

  async updatePricingService(serviceId: string, updates: Partial<typeof pricing.$inferSelect>) {
    const db = getMythoriaDb();
    const [updatedService] = await db
      .update(pricing)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(pricing.id, serviceId))
      .returning();

    return updatedService;
  },

  async togglePricingServiceStatus(serviceId: string) {
    const db = getMythoriaDb();
    const currentService = await this.getPricingServiceById(serviceId);
    if (!currentService) return null;

    const [updatedService] = await db
      .update(pricing)
      .set({
        isActive: !currentService.isActive,
        updatedAt: new Date(),
      })
      .where(eq(pricing.id, serviceId))
      .returning();

    return updatedService;
  },

  async createPricingService(serviceData: typeof pricing.$inferInsert) {
    const db = getMythoriaDb();
    const [newService] = await db
      .insert(pricing)
      .values({
        ...serviceData,
        // createdAt and updatedAt are automatically set by defaultNow()
      })
      .returning();

    return newService;
  },

  async deletePricingService(serviceId: string) {
    const db = getMythoriaDb();
    await db.delete(pricing).where(eq(pricing.id, serviceId));
    return true;
  },

  // Workflow operations
  async getWorkflowRuns(
    page: number = 1,
    limit: number = 100,
    status?: 'queued' | 'running' | 'failed' | 'completed' | 'cancelled',
    searchTerm?: string,
    sortBy: 'createdAt' | 'startedAt' | 'endedAt' = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const workflowsDb = getWorkflowsDb();
    const mythoriaDb = getMythoriaDb();
    const offset = (page - 1) * limit;

    const orderColumn =
      sortBy === 'startedAt'
        ? storyGenerationRuns.startedAt
        : sortBy === 'endedAt'
          ? storyGenerationRuns.endedAt
          : storyGenerationRuns.createdAt;
    const orderDirection = sortOrder === 'asc' ? asc(orderColumn) : desc(orderColumn);

    // First, get workflow runs from workflows database
    let workflowQuery = workflowsDb
      .select({
        runId: storyGenerationRuns.runId,
        storyId: storyGenerationRuns.storyId,
        gcpWorkflowExecution: storyGenerationRuns.gcpWorkflowExecution,
        status: storyGenerationRuns.status,
        currentStep: storyGenerationRuns.currentStep,
        errorMessage: storyGenerationRuns.errorMessage,
        startedAt: storyGenerationRuns.startedAt,
        endedAt: storyGenerationRuns.endedAt,
        metadata: storyGenerationRuns.metadata,
        createdAt: storyGenerationRuns.createdAt,
        updatedAt: storyGenerationRuns.updatedAt,
      })
      .from(storyGenerationRuns);

    // Apply status filter
    if (status) {
      workflowQuery = workflowQuery.where(
        eq(storyGenerationRuns.status, status),
      ) as typeof workflowQuery;
    }

    // Apply ordering and pagination
    const workflowRuns = await workflowQuery.orderBy(orderDirection).limit(limit).offset(offset);

    // If no workflows found, return empty result
    if (workflowRuns.length === 0) {
      return [];
    }

    // Get story IDs to fetch story details from mythoria database
    const storyIds = workflowRuns.map((run) => run.storyId);

    // Fetch story and author details from mythoria database
    const storyDetails = await mythoriaDb
      .select({
        storyId: stories.storyId,
        title: stories.title,
        authorName: authors.displayName,
        authorEmail: authors.email,
      })
      .from(stories)
      .innerJoin(authors, eq(stories.authorId, authors.authorId))
      .where(inArray(stories.storyId, storyIds));

    // Create a map for quick lookup
    const storyMap = new Map(storyDetails.map((story) => [story.storyId, story]));

    // Combine workflow runs with story details
    const results = workflowRuns.map((run) => {
      const story = storyMap.get(run.storyId);
      return {
        run_id: run.runId,
        story_id: run.storyId,
        story_title: story?.title || 'Unknown Story',
        status: run.status,
        started_at: run.startedAt,
        ended_at: run.endedAt,
        user_id: story?.authorEmail || 'Unknown Email',
        error_message: run.errorMessage,
        current_step: run.currentStep,
        step_details: undefined,
        story_details: undefined,
        gcpWorkflowExecution: run.gcpWorkflowExecution,
        // Additional fields that might be useful
        authorName: story?.authorName || 'Unknown Author',
        authorEmail: story?.authorEmail || 'Unknown Email',
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        metadata: run.metadata,
      };
    });

    // Apply search filter in application code (since we need to search across databases)
    if (searchTerm) {
      return results.filter(
        (run) =>
          run.story_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          run.authorName?.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    return results;
  },

  async getWorkflowRunById(runId: string) {
    const workflowsDb = getWorkflowsDb();
    const mythoriaDb = getMythoriaDb();

    // Get workflow run from workflows database
    const [workflowRun] = await workflowsDb
      .select({
        runId: storyGenerationRuns.runId,
        storyId: storyGenerationRuns.storyId,
        gcpWorkflowExecution: storyGenerationRuns.gcpWorkflowExecution,
        status: storyGenerationRuns.status,
        currentStep: storyGenerationRuns.currentStep,
        errorMessage: storyGenerationRuns.errorMessage,
        startedAt: storyGenerationRuns.startedAt,
        endedAt: storyGenerationRuns.endedAt,
        metadata: storyGenerationRuns.metadata,
        createdAt: storyGenerationRuns.createdAt,
        updatedAt: storyGenerationRuns.updatedAt,
      })
      .from(storyGenerationRuns)
      .where(eq(storyGenerationRuns.runId, runId));

    if (!workflowRun) {
      return null;
    }

    // Get story details from mythoria database
    const [storyDetails] = await mythoriaDb
      .select({
        storyId: stories.storyId,
        title: stories.title,
        authorName: authors.displayName,
        authorEmail: authors.email,
      })
      .from(stories)
      .innerJoin(authors, eq(stories.authorId, authors.authorId))
      .where(eq(stories.storyId, workflowRun.storyId));

    // Combine the results
    return {
      runId: workflowRun.runId,
      storyId: workflowRun.storyId,
      storyTitle: storyDetails?.title || 'Unknown Story',
      authorName: storyDetails?.authorName || 'Unknown Author',
      authorEmail: storyDetails?.authorEmail || 'Unknown Email',
      gcpWorkflowExecution: workflowRun.gcpWorkflowExecution,
      status: workflowRun.status,
      currentStep: workflowRun.currentStep,
      errorMessage: workflowRun.errorMessage,
      startedAt: workflowRun.startedAt,
      endedAt: workflowRun.endedAt,
      metadata: workflowRun.metadata,
      createdAt: workflowRun.createdAt,
      updatedAt: workflowRun.updatedAt,
    };
  },

  async getWorkflowSteps(runId: string) {
    const workflowsDb = getWorkflowsDb();
    const steps = await workflowsDb
      .select()
      .from(storyGenerationSteps)
      .where(eq(storyGenerationSteps.runId, runId))
      .orderBy(asc(storyGenerationSteps.createdAt));

    return steps;
  },

  async getWorkflowRunsCount(status?: 'queued' | 'running' | 'failed' | 'completed' | 'cancelled') {
    const workflowsDb = getWorkflowsDb();

    if (status) {
      const result = await workflowsDb
        .select({ value: count() })
        .from(storyGenerationRuns)
        .where(eq(storyGenerationRuns.status, status));
      return result[0]?.value || 0;
    } else {
      const result = await workflowsDb.select({ value: count() }).from(storyGenerationRuns);
      return result[0]?.value || 0;
    }
  },

  async createWorkflowRun(storyId: string, gcpWorkflowExecution?: string, runId?: string) {
    const workflowsDb = getWorkflowsDb();
    const insertData: typeof storyGenerationRuns.$inferInsert = {
      storyId,
      gcpWorkflowExecution,
      status: 'queued',
    };

    if (runId) {
      insertData.runId = runId;
    }

    const [newRun] = await workflowsDb.insert(storyGenerationRuns).values(insertData).returning();

    return newRun;
  },

  // Story chapters operations
  async getStoryChapters(storyId: string) {
    const db = getMythoriaDb();
    const chapters = await db
      .select({
        id: sql`chapters.id`,
        chapterNumber: sql`chapters.chapter_number`,
        title: sql`chapters.title`,
        imageUri: sql`chapters.image_uri`,
        imageThumbnailUri: sql`chapters.image_thumbnail_uri`,
        htmlContent: sql`chapters.html_content`,
        audioUri: sql`chapters.audio_uri`,
        version: sql`chapters.version`,
        createdAt: sql`chapters.created_at`,
        updatedAt: sql`chapters.updated_at`,
      })
      .from(sql`chapters`)
      .where(sql`chapters.story_id = ${storyId}`)
      .orderBy(sql`chapters.chapter_number ASC`);

    return chapters;
  },

  async getStoryChapter(storyId: string, chapterNumber: number) {
    const db = getMythoriaDb();
    const [chapter] = await db
      .select({
        id: sql`chapters.id`,
        chapterNumber: sql`chapters.chapter_number`,
        title: sql`chapters.title`,
        imageUri: sql`chapters.image_uri`,
        imageThumbnailUri: sql`chapters.image_thumbnail_uri`,
        htmlContent: sql`chapters.html_content`,
        audioUri: sql`chapters.audio_uri`,
        version: sql`chapters.version`,
        createdAt: sql`chapters.created_at`,
        updatedAt: sql`chapters.updated_at`,
      })
      .from(sql`chapters`)
      .where(sql`chapters.story_id = ${storyId} AND chapters.chapter_number = ${chapterNumber}`);

    return chapter;
  },

  async getStoryWithChapters(storyId: string) {
    const story = await this.getStoryByIdWithAuthor(storyId);
    if (!story) return null;

    const chapters = await this.getStoryChapters(storyId);

    return {
      ...story,
      chapters,
    };
  },

  // ---------------------------------------------------------------------------
  // Leads Management (Email Marketing)
  // ---------------------------------------------------------------------------

  /**
   * Get paginated list of leads with search, filters, and sorting.
   *
   * @param page - Page number (1-indexed)
   * @param limit - Number of records per page
   * @param searchTerm - Search string to match against name, email, or mobile phone
   * @param statusFilter - Filter by email status (or 'all')
   * @param languageFilter - Filter by language code (or 'all')
   * @param sortBy - Field to sort by
   * @param sortOrder - Sort direction (asc or desc)
   * @returns Paginated leads data
   */
  async getLeads(
    page: number = 1,
    limit: number = 100,
    searchTerm?: string,
    statusFilter?: string,
    languageFilter?: string,
    sortBy: 'name' | 'email' | 'language' | 'emailStatus' | 'lastEmailSentAt' = 'lastEmailSentAt',
    sortOrder: 'asc' | 'desc' = 'desc',
  ) {
    const db = getMythoriaDb();
    const offset = (page - 1) * limit;

    // Build where conditions dynamically
    type Condition = ReturnType<typeof like> | ReturnType<typeof eq>;
    const conditions: Condition[] = [];

    // Search filter - matches name, email, or mobile phone
    if (searchTerm && searchTerm.trim()) {
      const pattern = `%${searchTerm.trim().toLowerCase()}%`;
      conditions.push(
        or(
          like(sql`LOWER(${leads.name})`, pattern),
          like(sql`LOWER(${leads.email})`, pattern),
          like(sql`LOWER(${leads.mobilePhone})`, pattern),
        ) as Condition,
      );
    }

    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      conditions.push(eq(leads.emailStatus, statusFilter as EmailStatus));
    }

    // Language filter
    if (languageFilter && languageFilter !== 'all') {
      conditions.push(eq(leads.language, languageFilter));
    }

    // Combine conditions
    const whereClause: Condition | undefined = conditions.length
      ? conditions
          .slice(1)
          .reduce<Condition>((acc, cur) => and(acc, cur) as Condition, conditions[0])
      : undefined;

    // Determine sort column
    const sortColumn =
      sortBy === 'name'
        ? leads.name
        : sortBy === 'email'
          ? leads.email
          : sortBy === 'language'
            ? leads.language
            : sortBy === 'emailStatus'
              ? leads.emailStatus
              : leads.lastEmailSentAt;

    // Build query
    const query = db
      .select()
      .from(leads)
      .where(whereClause)
      .orderBy(sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn))
      .limit(limit)
      .offset(offset);

    const results = await query;

    // Get total count for pagination
    const countQuery = db.select({ value: count() }).from(leads).where(whereClause);

    const countResult = await countQuery;
    const totalCount = countResult[0]?.value || 0;

    return {
      data: results,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: offset + results.length < totalCount,
        hasPrev: page > 1,
      },
    };
  },

  /**
   * Get a single lead by ID.
   */
  async getLeadById(id: string) {
    const db = getMythoriaDb();
    const [lead] = await db.select().from(leads).where(eq(leads.id, id));
    return lead || null;
  },

  /**
   * Get a single lead by email (normalized).
   */
  async getLeadByEmail(email: string) {
    const db = getMythoriaDb();
    const [lead] = await db.select().from(leads).where(eq(leads.email, email));
    return lead || null;
  },

  /**
   * Insert or update a lead (UPSERT by email).
   * Email should already be normalized before calling this method.
   *
   * @param leadData - Lead data to insert or update
   * @returns The inserted or updated lead
   */
  async upsertLead(leadData: {
    name?: string | null;
    email: string;
    mobilePhone?: string | null;
    language: string;
    emailStatus?: string;
  }) {
    const db = getMythoriaDb();

    const [result] = await db
      .insert(leads)
      .values({
        name: leadData.name,
        email: leadData.email,
        mobilePhone: leadData.mobilePhone,
        language: leadData.language,
        emailStatus: (leadData.emailStatus as EmailStatus) || 'ready',
      })
      .onConflictDoUpdate({
        target: leads.email,
        set: {
          name: leadData.name,
          mobilePhone: leadData.mobilePhone,
          language: leadData.language,
          // Don't overwrite emailStatus on update - keep existing tracking state
        },
      })
      .returning();

    return result;
  },

  /**
   * Bulk insert or update leads (batch UPSERT).
   * Emails should already be normalized before calling this method.
   *
   * @param leadsData - Array of lead data to insert or update
   * @returns Array of inserted or updated leads
   */
  async bulkUpsertLeads(
    leadsData: Array<{
      name?: string | null;
      email: string;
      mobilePhone?: string | null;
      language: string;
    }>,
  ) {
    const db = getMythoriaDb();

    if (leadsData.length === 0) {
      return [];
    }

    // Use a transaction for bulk operations
    const results = await db.transaction(async (tx) => {
      const upserted = [];

      for (const leadData of leadsData) {
        const [result] = await tx
          .insert(leads)
          .values({
            name: leadData.name,
            email: leadData.email,
            mobilePhone: leadData.mobilePhone,
            language: leadData.language,
            emailStatus: 'ready',
          })
          .onConflictDoUpdate({
            target: leads.email,
            set: {
              name: leadData.name,
              mobilePhone: leadData.mobilePhone,
              language: leadData.language,
            },
          })
          .returning();

        upserted.push(result);
      }

      return upserted;
    });

    return results;
  },

  /**
   * Update a lead's email status.
   */
  async updateLeadStatus(id: string, emailStatus: string) {
    const db = getMythoriaDb();

    const [result] = await db
      .update(leads)
      .set({
        emailStatus: emailStatus as EmailStatus,
        ...(emailStatus === 'sent' && { lastEmailSentAt: new Date() }),
      })
      .where(eq(leads.id, id))
      .returning();

    return result || null;
  },

  /**
   * Bulk update lead email statuses.
   */
  async bulkUpdateLeadStatus(ids: string[], emailStatus: string) {
    const db = getMythoriaDb();

    const results = await db
      .update(leads)
      .set({
        emailStatus: emailStatus as EmailStatus,
        ...(emailStatus === 'sent' && { lastEmailSentAt: new Date() }),
      })
      .where(inArray(leads.id, ids))
      .returning();

    return results;
  },

  /**
   * Delete a single lead by ID.
   */
  async deleteLead(id: string) {
    const db = getMythoriaDb();

    const [result] = await db.delete(leads).where(eq(leads.id, id)).returning();

    return result || null;
  },

  /**
   * Bulk delete leads.
   */
  async bulkDeleteLeads(ids: string[]) {
    const db = getMythoriaDb();

    const results = await db.delete(leads).where(inArray(leads.id, ids)).returning();

    return results;
  },

  /**
   * Get lead statistics for dashboard/overview.
   */
  async getLeadStats() {
    const db = getMythoriaDb();

    const [stats] = await db
      .select({
        totalLeads: count(),
        readyCount: sql<number>`SUM(CASE WHEN ${leads.emailStatus} = 'ready' THEN 1 ELSE 0 END)`,
        // sentCount includes all emails that have been sent, regardless of their current state
        // (sent, open, click, bounced, unsubscribed) since you must send first before any other action
        sentCount: sql<number>`SUM(CASE WHEN ${leads.emailStatus} IN ('sent', 'open', 'click', 'soft_bounce', 'hard_bounce', 'unsub') THEN 1 ELSE 0 END)`,
        openCount: sql<number>`SUM(CASE WHEN ${leads.emailStatus} IN ('open', 'click') THEN 1 ELSE 0 END)`,
        clickCount: sql<number>`SUM(CASE WHEN ${leads.emailStatus} = 'click' THEN 1 ELSE 0 END)`,
        softBounceCount: sql<number>`SUM(CASE WHEN ${leads.emailStatus} = 'soft_bounce' THEN 1 ELSE 0 END)`,
        hardBounceCount: sql<number>`SUM(CASE WHEN ${leads.emailStatus} = 'hard_bounce' THEN 1 ELSE 0 END)`,
        unsubCount: sql<number>`SUM(CASE WHEN ${leads.emailStatus} = 'unsub' THEN 1 ELSE 0 END)`,
      })
      .from(leads);

    return stats || null;
  },

  // ---------------------------------------------------------------------------
  // FAQ Sections
  // ---------------------------------------------------------------------------
  async getFaqSections(
    page: number = 1,
    limit: number = 100,
    searchTerm?: string,
    isActiveFilter?: string,
  ) {
    const db = getMythoriaDb();
    const offset = (page - 1) * limit;

    type Condition = ReturnType<typeof like> | ReturnType<typeof eq>;
    const conditions: Condition[] = [];

    if (searchTerm && searchTerm.trim()) {
      const pattern = `%${searchTerm.trim()}%`;
      conditions.push(
        or(
          like(sql`LOWER(${faqSections.sectionKey})`, pattern.toLowerCase()),
          like(sql`LOWER(${faqSections.defaultLabel})`, pattern.toLowerCase()),
        ) as Condition,
      );
    }

    if (isActiveFilter === 'true') {
      conditions.push(eq(faqSections.isActive, true));
    } else if (isActiveFilter === 'false') {
      conditions.push(eq(faqSections.isActive, false));
    }

    const whereClause: Condition | undefined = conditions.length
      ? conditions
          .slice(1)
          .reduce<Condition>((acc, cur) => and(acc, cur) as Condition, conditions[0])
      : undefined;

    const totalCountResult = await db
      .select({ value: count() })
      .from(faqSections)
      .where(whereClause ?? sql`true`);
    const totalCount = totalCountResult[0]?.value || 0;

    const baseSelect = db.select().from(faqSections);
    const rows = await (whereClause ? baseSelect.where(whereClause) : baseSelect)
      .orderBy(asc(faqSections.sortOrder))
      .limit(limit)
      .offset(offset);

    return {
      data: rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: offset + rows.length < totalCount,
        hasPrev: page > 1,
      },
    };
  },

  async getFaqSectionById(id: string) {
    const db = getMythoriaDb();
    const [section] = await db.select().from(faqSections).where(eq(faqSections.id, id));
    return section || null;
  },

  async createFaqSection(data: {
    sectionKey: string;
    defaultLabel: string;
    description?: string;
    iconName?: string;
    sortOrder?: number;
    isActive?: boolean;
  }) {
    const db = getMythoriaDb();

    // Check if section key already exists
    const [existing] = await db
      .select()
      .from(faqSections)
      .where(eq(faqSections.sectionKey, data.sectionKey));

    if (existing) {
      throw new Error(`Section with key "${data.sectionKey}" already exists`);
    }

    // If no sortOrder provided, get max + 1
    if (data.sortOrder === undefined) {
      const [maxSort] = await db
        .select({ value: sql<number>`COALESCE(MAX(${faqSections.sortOrder}), 0)` })
        .from(faqSections);
      data.sortOrder = (maxSort?.value || 0) + 1;
    }

    const [section] = await db.insert(faqSections).values(data).returning();
    return section;
  },

  async updateFaqSection(
    id: string,
    data: {
      defaultLabel?: string;
      description?: string;
      iconName?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    const db = getMythoriaDb();

    const [section] = await db
      .update(faqSections)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(faqSections.id, id))
      .returning();

    return section || null;
  },

  async deleteFaqSection(id: string) {
    const db = getMythoriaDb();

    // Check if section has entries
    const [entriesCount] = await db
      .select({ value: count() })
      .from(faqEntries)
      .where(eq(faqEntries.sectionId, id));

    if (entriesCount && entriesCount.value > 0) {
      throw new Error('Cannot delete section with existing FAQ entries');
    }

    const [section] = await db.delete(faqSections).where(eq(faqSections.id, id)).returning();
    return section || null;
  },

  // ---------------------------------------------------------------------------
  // FAQ Entries
  // ---------------------------------------------------------------------------
  async getFaqEntries(
    page: number = 1,
    limit: number = 50,
    searchTerm?: string,
    sectionId?: string,
    locale?: string,
    isPublishedFilter?: string,
  ) {
    const db = getMythoriaDb();
    const offset = (page - 1) * limit;

    type Condition = ReturnType<typeof like> | ReturnType<typeof eq>;
    const conditions: Condition[] = [];

    if (searchTerm && searchTerm.trim()) {
      const pattern = `%${searchTerm.trim()}%`;
      conditions.push(
        or(
          like(sql`LOWER(${faqEntries.title})`, pattern.toLowerCase()),
          like(sql`LOWER(${faqEntries.contentMdx})`, pattern.toLowerCase()),
        ) as Condition,
      );
    }

    if (sectionId) {
      conditions.push(eq(faqEntries.sectionId, sectionId));
    }

    if (locale) {
      conditions.push(eq(faqEntries.locale, locale));
    }

    if (isPublishedFilter === 'true') {
      conditions.push(eq(faqEntries.isPublished, true));
    } else if (isPublishedFilter === 'false') {
      conditions.push(eq(faqEntries.isPublished, false));
    }

    const whereClause: Condition | undefined = conditions.length
      ? conditions
          .slice(1)
          .reduce<Condition>((acc, cur) => and(acc, cur) as Condition, conditions[0])
      : undefined;

    const totalCountResult = await db
      .select({ value: count() })
      .from(faqEntries)
      .where(whereClause ?? sql`true`);
    const totalCount = totalCountResult[0]?.value || 0;

    const baseSelect = db
      .select({
        entry: faqEntries,
        section: faqSections,
      })
      .from(faqEntries)
      .leftJoin(faqSections, eq(faqEntries.sectionId, faqSections.id));

    const rows = await (whereClause ? baseSelect.where(whereClause) : baseSelect)
      .orderBy(asc(faqEntries.questionSortOrder))
      .limit(limit)
      .offset(offset);

    const data = rows.map((row) => ({
      ...row.entry,
      section: row.section,
    }));

    return {
      data,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: offset + rows.length < totalCount,
        hasPrev: page > 1,
      },
    };
  },

  async getFaqEntryById(id: string) {
    const db = getMythoriaDb();
    const [result] = await db
      .select({
        entry: faqEntries,
        section: faqSections,
      })
      .from(faqEntries)
      .leftJoin(faqSections, eq(faqEntries.sectionId, faqSections.id))
      .where(eq(faqEntries.id, id));

    if (!result) return null;

    return {
      ...result.entry,
      section: result.section,
    };
  },

  async getFaqEntriesByKey(faqKey: string) {
    const db = getMythoriaDb();
    const entries = await db
      .select({
        entry: faqEntries,
        section: faqSections,
      })
      .from(faqEntries)
      .leftJoin(faqSections, eq(faqEntries.sectionId, faqSections.id))
      .where(eq(faqEntries.faqKey, faqKey))
      .orderBy(asc(faqEntries.locale));

    return entries.map((row) => ({
      ...row.entry,
      section: row.section,
    }));
  },

  async createFaqEntry(data: {
    sectionId: string;
    faqKey: string;
    locale: string;
    title: string;
    contentMdx: string;
    questionSortOrder?: number;
    isPublished?: boolean;
  }) {
    const db = getMythoriaDb();

    // Check if entry with same faqKey and locale exists
    const [existing] = await db
      .select()
      .from(faqEntries)
      .where(and(eq(faqEntries.faqKey, data.faqKey), eq(faqEntries.locale, data.locale)));

    if (existing) {
      throw new Error(
        `FAQ entry with key "${data.faqKey}" already exists for locale "${data.locale}"`,
      );
    }

    // If no questionSortOrder provided, get max + 1 for this section
    if (data.questionSortOrder === undefined) {
      const [maxSort] = await db
        .select({ value: sql<number>`COALESCE(MAX(${faqEntries.questionSortOrder}), 0)` })
        .from(faqEntries)
        .where(eq(faqEntries.sectionId, data.sectionId));
      data.questionSortOrder = (maxSort?.value || 0) + 1;
    }

    const [entry] = await db.insert(faqEntries).values(data).returning();
    return entry;
  },

  async updateFaqEntry(
    id: string,
    data: {
      sectionId?: string;
      title?: string;
      contentMdx?: string;
      questionSortOrder?: number;
      isPublished?: boolean;
    },
  ) {
    const db = getMythoriaDb();

    const [entry] = await db
      .update(faqEntries)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(faqEntries.id, id))
      .returning();

    return entry || null;
  },

  async deleteFaqEntry(id: string) {
    const db = getMythoriaDb();
    const [entry] = await db.delete(faqEntries).where(eq(faqEntries.id, id)).returning();
    return entry || null;
  },

  async bulkDeleteFaqEntries(ids: string[]) {
    const db = getMythoriaDb();
    const entries = await db.delete(faqEntries).where(inArray(faqEntries.id, ids)).returning();
    return entries;
  },
};
