import { getBackofficeDb, getMythoriaDb } from '../index';
import {
  marketingCampaigns,
  marketingCampaignAssets,
  marketingCampaignBatches,
  marketingCampaignRecipients,
} from '../schema/campaigns';
import { and, count, desc, eq, gte, sql, asc } from 'drizzle-orm';
import type {
  CampaignStatus,
  CampaignAudienceSource,
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

    const [updated] = await db
      .update(marketingCampaigns)
      .set({
        status: newStatus,
        updatedBy: adminEmail,
        updatedAt: new Date(),
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
    if (campaign.status !== 'draft') {
      throw new Error(`Cannot modify assets for campaign in '${campaign.status}' status.`);
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

    const result = { sent: 0, failed: 0, skipped: 0, queued: 0, total: 0 };
    for (const row of statuses) {
      const key = row.status as keyof typeof result;
      if (key in result) {
        result[key] = row.count;
      }
      result.total += row.count;
    }

    return result;
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
        const preferenceList = preferences.map((value) => `'${value}'`).join(', ');
        // Default suppression: only users with allowed notification preferences
        let userQuery = `SELECT COUNT(*) as cnt FROM authors WHERE notification_preference IN (${preferenceList})`;

        // Apply filter tree
        const filterSql = buildFilterSql(filterTree, 'users');
        if (filterSql) {
          userQuery += ` AND ${filterSql}`;
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
            const ids = sentRecipients.map((r) => `'${r.recipientId}'`).join(', ');
            userQuery += ` AND author_id NOT IN (${ids})`;
          }
        }

        const result = await mythoriaDb.execute(sql.raw(userQuery));
        userCount = Number(
          (result as unknown as { rows: Array<{ cnt: string }> }).rows?.[0]?.cnt ?? 0,
        );
      }
    }

    if (audienceSource === 'leads' || audienceSource === 'both') {
      // Default suppression: exclude unsub and hard_bounce
      let leadQuery = `SELECT COUNT(*) as cnt FROM leads WHERE email_status NOT IN ('unsub', 'hard_bounce')`;

      // Apply filter tree
      const filterSql = buildFilterSql(filterTree, 'leads');
      if (filterSql) {
        leadQuery += ` AND ${filterSql}`;
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
          const ids = sentRecipients.map((r) => `'${r.recipientId}'`).join(', ');
          leadQuery += ` AND id NOT IN (${ids})`;
        }
      }

      const result = await mythoriaDb.execute(sql.raw(leadQuery));
      leadCount = Number(
        (result as unknown as { rows: Array<{ cnt: string }> }).rows?.[0]?.cnt ?? 0,
      );
    }

    return { users: userCount, leads: leadCount, total: userCount + leadCount };
  },
};
