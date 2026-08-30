import { getBackofficeDb, getMythoriaDb } from '../index';
import {
  marketingCampaigns,
  marketingCampaignAssets,
  marketingCampaignBatches,
  marketingCampaignRecipients,
} from '../schema/campaigns';
import { and, count, desc, eq, gte, sql, asc, inArray } from 'drizzle-orm';
import { authors, paymentEvents, paymentOrders } from '../schema';
import type {
  CampaignStatus,
  CampaignAudienceSource,
  CampaignAttachmentType,
  MarketingCampaign,
  MarketingCampaignAsset,
} from '../schema/campaigns';
import type {
  CreateCampaignInput,
  UpdateCampaignInput,
  CampaignAssetInput,
  FilterTree,
  FilterCondition,
} from '@/lib/schemas/campaigns';

// -----------------------------------------------------------------------------
// State transition validation
// -----------------------------------------------------------------------------
const ALLOWED_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ['active', 'cancelled'],
  active: ['paused', 'cancelled'], // 'completed' is system-only
  paused: ['active', 'cancelled'],
  completed: [],
  cancelled: [],
};

function isValidTransition(current: CampaignStatus, next: CampaignStatus): boolean {
  return ALLOWED_TRANSITIONS[current]?.includes(next) ?? false;
}

const DUPLICATE_SUFFIX = ' - copy';
const MAX_CAMPAIGN_TITLE_LENGTH = 255;
const DEFAULT_USER_NOTIFICATION_PREFERENCES = ['news', 'inspiration'] as const;
const METRICS_QUERY_CHUNK_SIZE = 1000;

function chunkValues<T>(values: T[], size = METRICS_QUERY_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function buildDuplicateTitle(title: string): string {
  const maxBaseLength = MAX_CAMPAIGN_TITLE_LENGTH - DUPLICATE_SUFFIX.length;
  const base = title.length > maxBaseLength ? title.slice(0, maxBaseLength) : title;
  return `${base}${DUPLICATE_SUFFIX}`;
}

// -----------------------------------------------------------------------------
// Filter tree evaluation helpers
// -----------------------------------------------------------------------------
function isFilterTree(node: FilterCondition | FilterTree): node is FilterTree {
  return 'logic' in node && 'conditions' in node;
}

/**
 * Builds a raw SQL WHERE clause fragment from a filter tree.
 * Returns null if the filter tree is empty or null.
 */
function buildFilterSql(
  filterTree: FilterTree | null | undefined,
  audience: 'users' | 'leads',
): string | null {
  if (!filterTree || !filterTree.conditions || filterTree.conditions.length === 0) {
    return null;
  }

  const fieldMap: Record<string, Record<string, string>> = {
    users: {
      createdAt: 'created_at',
      lastLoginAt: 'last_login_at',
      preferredLocale: 'preferred_locale',
      notificationPreference: 'notification_preference',
      gender: 'gender',
      literaryAge: 'literary_age',
    },
    leads: {
      language: 'language',
      emailStatus: 'email_status',
      lastEmailSentAt: 'last_email_sent_at',
    },
  };

  function escapeValue(value: unknown): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    if (Array.isArray(value)) {
      return `(${value.map((v) => escapeValue(v)).join(', ')})`;
    }
    // Escape single quotes
    const str = String(value).replace(/'/g, "''");
    return `'${str}'`;
  }

  function buildCondition(condition: FilterCondition): string | null {
    const columnName = fieldMap[audience]?.[condition.field];
    if (!columnName) return null;

    switch (condition.operator) {
      case 'eq':
        return `"${columnName}" = ${escapeValue(condition.value)}`;
      case 'ne':
        return `"${columnName}" != ${escapeValue(condition.value)}`;
      case 'gt':
        return `"${columnName}" > ${escapeValue(condition.value)}`;
      case 'gte':
        return `"${columnName}" >= ${escapeValue(condition.value)}`;
      case 'lt':
        return `"${columnName}" < ${escapeValue(condition.value)}`;
      case 'lte':
        return `"${columnName}" <= ${escapeValue(condition.value)}`;
      case 'between': {
        if (!Array.isArray(condition.value) || condition.value.length !== 2) return null;
        return `"${columnName}" BETWEEN ${escapeValue(condition.value[0])} AND ${escapeValue(condition.value[1])}`;
      }
      case 'in': {
        if (!Array.isArray(condition.value)) return null;
        return `"${columnName}" IN ${escapeValue(condition.value)}`;
      }
      case 'not_in': {
        if (!Array.isArray(condition.value)) return null;
        return `"${columnName}" NOT IN ${escapeValue(condition.value)}`;
      }
      case 'is_null':
        return condition.value === true || condition.value === null
          ? `"${columnName}" IS NULL`
          : `"${columnName}" IS NOT NULL`;
      default:
        return null;
    }
  }

  function buildNode(node: FilterCondition | FilterTree): string | null {
    if (isFilterTree(node)) {
      const parts = node.conditions.map(buildNode).filter(Boolean) as string[];
      if (parts.length === 0) return null;
      if (parts.length === 1) return parts[0];
      const joiner = node.logic === 'and' ? ' AND ' : ' OR ';
      return `(${parts.join(joiner)})`;
    }
    return buildCondition(node);
  }

  return buildNode(filterTree);
}

// -----------------------------------------------------------------------------
// Campaign service
// -----------------------------------------------------------------------------
export const campaignService = {
  // ---------------------------------------------------------------------------
  // Campaign CRUD
  // ---------------------------------------------------------------------------
  async createCampaign(data: CreateCampaignInput, adminEmail: string): Promise<MarketingCampaign> {
    const db = getBackofficeDb();
    const attachmentType = data.attachmentType ?? 'none';
    const [campaign] = await db
      .insert(marketingCampaigns)
      .values({
        title: data.title,
        description: data.description ?? null,
        status: 'draft',
        audienceSource: data.audienceSource,
        userNotificationPreferences: data.userNotificationPreferences ?? null,
        filterTree: data.filterTree ?? null,
        dailySendLimit: data.dailySendLimit ?? null,
        attachmentType,
        skipPrintQa: attachmentType === 'selfprint' ? (data.skipPrintQa ?? false) : false,
        startAt: data.startAt ? new Date(data.startAt) : null,
        endAt: data.endAt ? new Date(data.endAt) : null,
        createdBy: adminEmail,
        updatedBy: adminEmail,
      })
      .returning();
    return campaign;
  },

  async getCampaign(
    id: string,
  ): Promise<(MarketingCampaign & { assets: MarketingCampaignAsset[] }) | null> {
    const db = getBackofficeDb();
    const [campaign] = await db
      .select()
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.id, id))
      .limit(1);

    if (!campaign) return null;

    const assets = await db
      .select()
      .from(marketingCampaignAssets)
      .where(eq(marketingCampaignAssets.campaignId, id))
      .orderBy(asc(marketingCampaignAssets.language));

    return { ...campaign, assets };
  },

  async listCampaigns(
    page = 1,
    limit = 20,
    statusFilter?: CampaignStatus,
  ): Promise<{
    campaigns: MarketingCampaign[];
    total: number;
    page: number;
    limit: number;
  }> {
    const db = getBackofficeDb();
    const offset = (page - 1) * limit;

    const conditions = statusFilter ? eq(marketingCampaigns.status, statusFilter) : undefined;

    const [{ total }] = await db
      .select({ total: count() })
      .from(marketingCampaigns)
      .where(conditions);

    const campaigns = await db
      .select()
      .from(marketingCampaigns)
      .where(conditions)
      .orderBy(desc(marketingCampaigns.createdAt))
      .limit(limit)
      .offset(offset);

    return { campaigns, total, page, limit };
  },

  async duplicateCampaign(id: string, adminEmail: string): Promise<MarketingCampaign | null> {
    const db = getBackofficeDb();

    const [campaign] = await db
      .select()
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.id, id))
      .limit(1);

    if (!campaign) return null;

    const assets = await db
      .select()
      .from(marketingCampaignAssets)
      .where(eq(marketingCampaignAssets.campaignId, id))
      .orderBy(asc(marketingCampaignAssets.language));

    const [duplicated] = await db
      .insert(marketingCampaigns)
      .values({
        title: buildDuplicateTitle(campaign.title),
        description: campaign.description,
        status: 'draft',
        audienceSource: campaign.audienceSource,
        userNotificationPreferences: campaign.userNotificationPreferences,
        filterTree: campaign.filterTree,
        dailySendLimit: campaign.dailySendLimit,
        attachmentType: campaign.attachmentType,
        skipPrintQa: campaign.skipPrintQa,
        startAt: campaign.startAt,
        endAt: campaign.endAt,
        createdBy: adminEmail,
        updatedBy: adminEmail,
      })
      .returning();

    if (assets.length > 0) {
      await db.insert(marketingCampaignAssets).values(
        assets.map((asset) => ({
          campaignId: duplicated.id,
          channel: asset.channel,
          language: asset.language,
          subject: asset.subject,
          htmlBody: asset.htmlBody,
          textBody: asset.textBody,
        })),
      );
    }

    return duplicated;
  },

  async updateCampaign(
    id: string,
    data: UpdateCampaignInput,
    adminEmail: string,
  ): Promise<MarketingCampaign | null> {
    const db = getBackofficeDb();

    // Only allow updates on draft campaigns
    const [existing] = await db
      .select({ status: marketingCampaigns.status })
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.id, id))
      .limit(1);

    if (!existing) return null;
    if (existing.status !== 'draft') {
      throw new Error(
        `Cannot update campaign in '${existing.status}' status. Only draft campaigns can be edited.`,
      );
    }

    const updateData: Record<string, unknown> = {
      updatedBy: adminEmail,
      updatedAt: new Date(),
    };

    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.audienceSource !== undefined) updateData.audienceSource = data.audienceSource;
    if (data.userNotificationPreferences !== undefined)
      updateData.userNotificationPreferences = data.userNotificationPreferences;
    if (data.filterTree !== undefined) updateData.filterTree = data.filterTree;
    if (data.dailySendLimit !== undefined) updateData.dailySendLimit = data.dailySendLimit;
    if (data.attachmentType !== undefined) updateData.attachmentType = data.attachmentType;
    if (data.skipPrintQa !== undefined) updateData.skipPrintQa = data.skipPrintQa;
    // Coerce skipPrintQa to false when the effective attachmentType isn't 'selfprint'.
    const effectiveAttachmentType = data.attachmentType;
    if (effectiveAttachmentType !== undefined && effectiveAttachmentType !== 'selfprint') {
      updateData.skipPrintQa = false;
    }
    if (data.startAt !== undefined)
      updateData.startAt = data.startAt ? new Date(data.startAt) : null;
    if (data.endAt !== undefined) updateData.endAt = data.endAt ? new Date(data.endAt) : null;

    const [updated] = await db
      .update(marketingCampaigns)
      .set(updateData)
      .where(eq(marketingCampaigns.id, id))
      .returning();

    return updated ?? null;
  },

  async deleteCampaign(id: string): Promise<boolean> {
    const db = getBackofficeDb();

    const [existing] = await db
      .select({ status: marketingCampaigns.status })
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.id, id))
      .limit(1);

    if (!existing) return false;
    if (existing.status !== 'draft' && existing.status !== 'cancelled') {
      throw new Error(
        `Cannot delete campaign in '${existing.status}' status. Only draft or cancelled campaigns can be deleted.`,
      );
    }

    // Cascade deletes handle assets, batches, recipients
    const result = await db
      .delete(marketingCampaigns)
      .where(eq(marketingCampaigns.id, id))
      .returning({ id: marketingCampaigns.id });

    return result.length > 0;
  },

  async transitionCampaignStatus(
    id: string,
    newStatus: CampaignStatus,
    adminEmail: string,
  ): Promise<MarketingCampaign | null> {
    const db = getBackofficeDb();

    const [existing] = await db
      .select()
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.id, id))
      .limit(1);

    if (!existing) return null;

    if (!isValidTransition(existing.status, newStatus)) {
      throw new Error(
        `Invalid transition: '${existing.status}' -> '${newStatus}'. Allowed: ${ALLOWED_TRANSITIONS[existing.status].join(', ') || 'none'}`,
      );
    }

    let audienceSnapshot: { audienceTotalSnapshot?: number; audienceSnapshotAt?: Date } = {};
    if (newStatus === 'active' && existing.audienceTotalSnapshot == null) {
      const estimate = await campaignService.getEstimatedAudienceCount(
        id,
        existing.audienceSource,
        existing.filterTree as FilterTree | null,
        existing.userNotificationPreferences,
        existing.attachmentType,
      );
      const progress = await campaignService.getCampaignProgress(id);
      audienceSnapshot = {
        audienceTotalSnapshot: progress.total + estimate.total,
        audienceSnapshotAt: new Date(),
      };
    }

    const [updated] = await db
      .update(marketingCampaigns)
      .set({
        status: newStatus,
        updatedBy: adminEmail,
        updatedAt: new Date(),
        ...audienceSnapshot,
      })
      .where(eq(marketingCampaigns.id, id))
      .returning();

    return updated ?? null;
  },

  // ---------------------------------------------------------------------------
  // Asset CRUD
  // ---------------------------------------------------------------------------
  async upsertCampaignAsset(
    campaignId: string,
    data: CampaignAssetInput,
  ): Promise<MarketingCampaignAsset> {
    const db = getBackofficeDb();

    // Check campaign exists and is in draft
    const [campaign] = await db
      .select({ status: marketingCampaigns.status })
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.id, campaignId))
      .limit(1);

    if (!campaign) throw new Error('Campaign not found');
    if (campaign.status !== 'draft' && campaign.status !== 'active') {
      throw new Error(
        `Cannot modify assets for campaign in '${campaign.status}' status. Only draft or active campaigns allow asset edits.`,
      );
    }

    // Try to find existing asset for this locale
    const [existing] = await db
      .select()
      .from(marketingCampaignAssets)
      .where(
        and(
          eq(marketingCampaignAssets.campaignId, campaignId),
          eq(marketingCampaignAssets.channel, 'email'),
          eq(marketingCampaignAssets.language, data.language),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(marketingCampaignAssets)
        .set({
          subject: data.subject,
          htmlBody: data.htmlBody,
          textBody: data.textBody,
          updatedAt: new Date(),
        })
        .where(eq(marketingCampaignAssets.id, existing.id))
        .returning();
      return updated;
    }

    const [inserted] = await db
      .insert(marketingCampaignAssets)
      .values({
        campaignId,
        channel: 'email',
        language: data.language,
        subject: data.subject,
        htmlBody: data.htmlBody,
        textBody: data.textBody,
      })
      .returning();

    return inserted;
  },

  async deleteCampaignAsset(assetId: string): Promise<boolean> {
    const db = getBackofficeDb();

    // Check campaign status through the asset
    const [asset] = await db
      .select({
        campaignId: marketingCampaignAssets.campaignId,
      })
      .from(marketingCampaignAssets)
      .where(eq(marketingCampaignAssets.id, assetId))
      .limit(1);

    if (!asset) return false;

    const [campaign] = await db
      .select({ status: marketingCampaigns.status })
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.id, asset.campaignId))
      .limit(1);

    if (campaign && campaign.status !== 'draft') {
      throw new Error(`Cannot delete assets for campaign in '${campaign.status}' status.`);
    }

    const result = await db
      .delete(marketingCampaignAssets)
      .where(eq(marketingCampaignAssets.id, assetId))
      .returning({ id: marketingCampaignAssets.id });

    return result.length > 0;
  },

  async getCampaignAssets(campaignId: string): Promise<MarketingCampaignAsset[]> {
    const db = getBackofficeDb();
    return db
      .select()
      .from(marketingCampaignAssets)
      .where(eq(marketingCampaignAssets.campaignId, campaignId))
      .orderBy(asc(marketingCampaignAssets.language));
  },

  // ---------------------------------------------------------------------------
  // Batch & recipient operations
  // ---------------------------------------------------------------------------
  async createBatchRecord(campaignId: string, requestedBy: string | null, sampleSend = false) {
    const db = getBackofficeDb();
    const [batch] = await db
      .insert(marketingCampaignBatches)
      .values({
        campaignId,
        status: 'queued',
        requestedBy,
        sampleSend,
      })
      .returning();
    return batch;
  },

  async updateBatchRecord(
    batchId: string,
    data: {
      status?: 'queued' | 'running' | 'completed' | 'failed';
      startedAt?: Date;
      completedAt?: Date;
      statsJson?: { processed: number; sent: number; failed: number; skipped: number };
      assetSnapshotHash?: string;
    },
  ) {
    const db = getBackofficeDb();
    const [updated] = await db
      .update(marketingCampaignBatches)
      .set(data)
      .where(eq(marketingCampaignBatches.id, batchId))
      .returning();
    return updated;
  },

  async insertRecipientRecords(
    records: Array<{
      batchId: string;
      campaignId: string;
      recipientType: 'user' | 'lead';
      recipientId: string;
      email: string;
      language: string;
      status: 'queued' | 'sent' | 'failed' | 'skipped';
      lastError?: string;
      processedAt?: Date;
    }>,
  ) {
    if (records.length === 0) return [];
    const db = getBackofficeDb();
    return db.insert(marketingCampaignRecipients).values(records).returning();
  },

  // ---------------------------------------------------------------------------
  // Progress & history
  // ---------------------------------------------------------------------------
  async getCampaignProgress(campaignId: string) {
    const db = getBackofficeDb();

    const statuses = await db
      .select({
        status: marketingCampaignRecipients.status,
        count: count(),
      })
      .from(marketingCampaignRecipients)
      .where(eq(marketingCampaignRecipients.campaignId, campaignId))
      .groupBy(marketingCampaignRecipients.status);

    const [campaign] = await db
      .select({
        audienceTotalSnapshot: marketingCampaigns.audienceTotalSnapshot,
        audienceSnapshotAt: marketingCampaigns.audienceSnapshotAt,
      })
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.id, campaignId))
      .limit(1);

    const result = {
      sent: 0,
      failed: 0,
      skipped: 0,
      queued: 0,
      total: 0,
      audienceTotalSnapshot: campaign?.audienceTotalSnapshot ?? null,
      audienceSnapshotAt: campaign?.audienceSnapshotAt ?? null,
    };
    for (const row of statuses) {
      if (
        row.status === 'sent' ||
        row.status === 'failed' ||
        row.status === 'skipped' ||
        row.status === 'queued'
      ) {
        result[row.status] = row.count;
      }
      result.total += row.count;
    }

    return result;
  },

  async getCampaignSuccessMetrics(campaignId: string) {
    const backofficeDb = getBackofficeDb();
    const mythoriaDb = getMythoriaDb();
    const sentRecipients = await backofficeDb
      .select({
        id: marketingCampaignRecipients.id,
        campaignId: marketingCampaignRecipients.campaignId,
        recipientType: marketingCampaignRecipients.recipientType,
        email: marketingCampaignRecipients.email,
        processedAt: marketingCampaignRecipients.processedAt,
        trackingEnabledAt: marketingCampaignRecipients.trackingEnabledAt,
        openedAt: marketingCampaignRecipients.openedAt,
        clickedAt: marketingCampaignRecipients.clickedAt,
      })
      .from(marketingCampaignRecipients)
      .where(
        and(
          eq(marketingCampaignRecipients.campaignId, campaignId),
          eq(marketingCampaignRecipients.status, 'sent'),
        ),
      );

    const tracked = sentRecipients.filter((row) => row.trackingEnabledAt != null);
    const historical = sentRecipients.filter((row) => row.trackingEnabledAt == null);
    const emails = Array.from(new Set(sentRecipients.map((row) => row.email.trim().toLowerCase())));
    const allRelatedRecipients = (
      await Promise.all(
        chunkValues(emails).map((emailChunk) =>
          backofficeDb
            .select({
              id: marketingCampaignRecipients.id,
              campaignId: marketingCampaignRecipients.campaignId,
              recipientType: marketingCampaignRecipients.recipientType,
              email: marketingCampaignRecipients.email,
              processedAt: marketingCampaignRecipients.processedAt,
              trackingEnabledAt: marketingCampaignRecipients.trackingEnabledAt,
              clickedAt: marketingCampaignRecipients.clickedAt,
            })
            .from(marketingCampaignRecipients)
            .where(
              and(
                eq(marketingCampaignRecipients.status, 'sent'),
                inArray(sql`lower(${marketingCampaignRecipients.email})`, emailChunk),
              ),
            ),
        ),
      )
    ).flat();

    const authorRows = (
      await Promise.all(
        chunkValues(emails).map((emailChunk) =>
          mythoriaDb
            .select({
              authorId: authors.authorId,
              email: authors.email,
              createdAt: authors.createdAt,
              acquisitionCampaignRecipientId: authors.acquisitionCampaignRecipientId,
            })
            .from(authors)
            .where(inArray(sql`lower(${authors.email})`, emailChunk)),
        ),
      )
    ).flat();
    const authorIds = authorRows.map((row) => row.authorId);
    const completedOrders = (
      await Promise.all(
        chunkValues(authorIds).map((authorIdChunk) =>
          mythoriaDb
            .select({
              orderId: paymentOrders.orderId,
              authorId: paymentOrders.authorId,
              emailCampaignRecipientId: paymentOrders.emailCampaignRecipientId,
              completedAt: paymentEvents.createdAt,
            })
            .from(paymentOrders)
            .innerJoin(
              paymentEvents,
              and(
                eq(paymentEvents.orderId, paymentOrders.orderId),
                eq(paymentEvents.eventType, 'payment_completed'),
              ),
            )
            .where(
              and(
                eq(paymentOrders.status, 'completed'),
                inArray(paymentOrders.authorId, authorIdChunk),
              ),
            ),
        ),
      )
    ).flat();

    const recipientById = new Map(allRelatedRecipients.map((row) => [row.id, row]));
    const currentRecipientIds = new Set(sentRecipients.map((row) => row.id));
    const exactAccountIds = new Set<string>();
    const exactBuyerIds = new Set<string>();
    const estimatedAccountIds = new Set<string>();
    const estimatedBuyerIds = new Set<string>();
    const windowMs = 30 * 24 * 60 * 60 * 1000;

    for (const author of authorRows) {
      const exactRecipient = author.acquisitionCampaignRecipientId
        ? recipientById.get(author.acquisitionCampaignRecipientId)
        : undefined;
      if (
        exactRecipient?.campaignId === campaignId &&
        exactRecipient.clickedAt &&
        exactRecipient.recipientType === 'lead' &&
        exactRecipient.email.trim().toLowerCase() === author.email.trim().toLowerCase() &&
        author.createdAt >= exactRecipient.clickedAt &&
        author.createdAt.getTime() <= exactRecipient.clickedAt.getTime() + windowMs
      ) {
        exactAccountIds.add(author.authorId);
      } else {
        const conversionTime = author.createdAt.getTime();
        const latest = allRelatedRecipients
          .filter(
            (row) =>
              row.trackingEnabledAt == null &&
              row.recipientType === 'lead' &&
              row.email.trim().toLowerCase() === author.email.trim().toLowerCase() &&
              row.processedAt &&
              row.processedAt.getTime() <= conversionTime &&
              conversionTime <= row.processedAt.getTime() + windowMs,
          )
          .sort((a, b) => (b.processedAt?.getTime() ?? 0) - (a.processedAt?.getTime() ?? 0))[0];
        if (latest?.campaignId === campaignId) estimatedAccountIds.add(author.authorId);
      }
    }

    const authorById = new Map(authorRows.map((row) => [row.authorId, row]));
    for (const order of completedOrders) {
      const exactRecipient = order.emailCampaignRecipientId
        ? recipientById.get(order.emailCampaignRecipientId)
        : undefined;
      if (
        exactRecipient?.campaignId === campaignId &&
        exactRecipient.clickedAt &&
        authorById.get(order.authorId)?.email.trim().toLowerCase() ===
          exactRecipient.email.trim().toLowerCase() &&
        order.completedAt >= exactRecipient.clickedAt &&
        order.completedAt.getTime() <= exactRecipient.clickedAt.getTime() + windowMs
      ) {
        exactBuyerIds.add(order.authorId);
        continue;
      }
      if (order.emailCampaignRecipientId) continue;
      const author = authorById.get(order.authorId);
      if (!author) continue;
      const completedAt = order.completedAt.getTime();
      const latest = allRelatedRecipients
        .filter(
          (row) =>
            row.trackingEnabledAt == null &&
            row.email.trim().toLowerCase() === author.email.trim().toLowerCase() &&
            row.processedAt &&
            row.processedAt.getTime() <= completedAt &&
            completedAt <= row.processedAt.getTime() + windowMs,
        )
        .sort((a, b) => (b.processedAt?.getTime() ?? 0) - (a.processedAt?.getTime() ?? 0))[0];
      if (latest?.campaignId === campaignId) estimatedBuyerIds.add(order.authorId);
    }

    const metric = (value: number, denominator: number) => ({
      value,
      denominator,
      rate: denominator > 0 ? value / denominator : null,
    });
    const trackedLeadCount = tracked.filter((row) => row.recipientType === 'lead').length;
    const historicalLeadCount = historical.filter((row) => row.recipientType === 'lead').length;

    return {
      trackingStartedAt:
        tracked
          .map((row) => row.trackingEnabledAt)
          .filter((value): value is Date => value != null)
          .sort((a, b) => a.getTime() - b.getTime())[0] ?? null,
      measured: {
        sent: tracked.length,
        opens: metric(tracked.filter((row) => row.openedAt != null).length, tracked.length),
        clicks: metric(tracked.filter((row) => row.clickedAt != null).length, tracked.length),
        accounts: metric(exactAccountIds.size, trackedLeadCount),
        creditBuyers: metric(exactBuyerIds.size, tracked.length),
      },
      historicalEstimate: {
        sent: historical.length,
        accounts: metric(estimatedAccountIds.size, historicalLeadCount),
        creditBuyers: metric(estimatedBuyerIds.size, historical.length),
        method: 'last_send_30d' as const,
      },
      diagnostics: {
        currentRecipients: currentRecipientIds.size,
      },
    };
  },

  async getBatchHistory(campaignId: string, page = 1, limit = 20) {
    const db = getBackofficeDb();
    const offset = (page - 1) * limit;

    const [{ total }] = await db
      .select({ total: count() })
      .from(marketingCampaignBatches)
      .where(
        and(
          eq(marketingCampaignBatches.campaignId, campaignId),
          eq(marketingCampaignBatches.sampleSend, false),
        ),
      );

    const batches = await db
      .select()
      .from(marketingCampaignBatches)
      .where(
        and(
          eq(marketingCampaignBatches.campaignId, campaignId),
          eq(marketingCampaignBatches.sampleSend, false),
        ),
      )
      .orderBy(desc(marketingCampaignBatches.requestedAt))
      .limit(limit)
      .offset(offset);

    return { batches, total, page, limit };
  },

  async getDailySendCount(campaignId: string): Promise<number> {
    const db = getBackofficeDb();
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const [result] = await db
      .select({ count: count() })
      .from(marketingCampaignRecipients)
      .where(
        and(
          eq(marketingCampaignRecipients.campaignId, campaignId),
          eq(marketingCampaignRecipients.status, 'sent'),
          gte(marketingCampaignRecipients.processedAt, startOfDay),
        ),
      );

    return result?.count ?? 0;
  },

  // ---------------------------------------------------------------------------
  // Audience count estimation
  // ---------------------------------------------------------------------------
  async getEstimatedAudienceCount(
    campaignId: string | null,
    audienceSource: CampaignAudienceSource,
    filterTree: FilterTree | null | undefined,
    userNotificationPreferences?: string[] | null,
    attachmentType: CampaignAttachmentType = 'none',
  ): Promise<{ users: number; leads: number; total: number }> {
    const mythoriaDb = getMythoriaDb();
    let userCount = 0;
    let leadCount = 0;

    if (audienceSource === 'users' || audienceSource === 'both') {
      const preferences =
        userNotificationPreferences && userNotificationPreferences.length > 0
          ? userNotificationPreferences
          : DEFAULT_USER_NOTIFICATION_PREFERENCES;

      if (preferences.length === 0) {
        userCount = 0;
      } else {
        // Default suppression: only users with allowed notification preferences
        const userConditions: string[] = [
          `notification_preference IN (${preferences.map((value) => `'${String(value).replace(/'/g, "''")}'`).join(', ')})`,
          `email_status NOT IN ('unsub', 'hard_bounce')`,
        ];

        // Apply filter tree
        const filterSql = buildFilterSql(filterTree, 'users');
        if (filterSql) {
          userConditions.push(filterSql);
        }

        // Selfprint attachments require the author to have at least one completed story.
        if (attachmentType === 'selfprint') {
          userConditions.push(
            `EXISTS (SELECT 1 FROM stories s WHERE s.author_id = authors.author_id AND s.status = 'completed')`,
          );
        }

        // Exclude already-sent recipients for this campaign
        if (campaignId) {
          const backofficeDb = getBackofficeDb();
          const sentRecipients = await backofficeDb
            .select({ recipientId: marketingCampaignRecipients.recipientId })
            .from(marketingCampaignRecipients)
            .where(
              and(
                eq(marketingCampaignRecipients.campaignId, campaignId),
                eq(marketingCampaignRecipients.recipientType, 'user'),
                eq(marketingCampaignRecipients.status, 'sent'),
              ),
            );

          if (sentRecipients.length > 0) {
            userConditions.push(
              `author_id NOT IN (${sentRecipients
                .map((r) => `'${String(r.recipientId).replace(/'/g, "''")}'`)
                .join(', ')})`,
            );
          }
        }

        const userQuery = `SELECT COUNT(*) as cnt FROM authors WHERE ${userConditions.join(' AND ')}`;
        const result = await mythoriaDb.execute(sql.raw(userQuery));
        userCount = Number(
          (result as unknown as { rows: Array<{ cnt: string }> }).rows?.[0]?.cnt ?? 0,
        );
      }
    }

    if (
      (audienceSource === 'leads' || audienceSource === 'both') &&
      attachmentType !== 'selfprint'
    ) {
      // Default suppression: exclude unsub and hard_bounce
      const leadConditions: string[] = [`email_status NOT IN ('unsub', 'hard_bounce')`];

      // Apply filter tree
      const filterSql = buildFilterSql(filterTree, 'leads');
      if (filterSql) {
        leadConditions.push(filterSql);
      }

      // Exclude already-sent recipients for this campaign
      if (campaignId) {
        const backofficeDb = getBackofficeDb();
        const sentRecipients = await backofficeDb
          .select({ recipientId: marketingCampaignRecipients.recipientId })
          .from(marketingCampaignRecipients)
          .where(
            and(
              eq(marketingCampaignRecipients.campaignId, campaignId),
              eq(marketingCampaignRecipients.recipientType, 'lead'),
              eq(marketingCampaignRecipients.status, 'sent'),
            ),
          );

        if (sentRecipients.length > 0) {
          leadConditions.push(
            `id NOT IN (${sentRecipients
              .map((r) => `'${String(r.recipientId).replace(/'/g, "''")}'`)
              .join(', ')})`,
          );
        }
      }

      const leadQuery = `SELECT COUNT(*) as cnt FROM leads WHERE ${leadConditions.join(' AND ')}`;
      const result = await mythoriaDb.execute(sql.raw(leadQuery));
      leadCount = Number(
        (result as unknown as { rows: Array<{ cnt: string }> }).rows?.[0]?.cnt ?? 0,
      );
    }

    return { users: userCount, leads: leadCount, total: userCount + leadCount };
  },
};
