/**
 * Seed: World Book Day 2026 campaign (idempotent on campaign title).
 *
 * Creates the `World Book Day 2026` marketing campaign plus one asset per
 * supported locale (en-US, pt-PT, es-ES, fr-FR, de-DE). Re-running the script
 * updates the existing campaign and assets in place instead of creating
 * duplicates.
 *
 * Usage:
 *   npm run seed:world-book-day
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { and, eq } from 'drizzle-orm';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

import { getMultiDatabaseConfig, getPoolConfig } from '../src/lib/database-config';
import {
  marketingCampaigns,
  marketingCampaignAssets,
  type NewMarketingCampaign,
} from '../src/db/schema/campaigns';

dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CAMPAIGN_TITLE = 'World Book Day 2026';
const SEED_ACTOR = 'seed:world-book-day-2026';
const ASSET_ROOT = path.resolve(__dirname, 'seed-assets', 'world-book-day-2026');
const LOCALES = ['en-US', 'pt-PT', 'es-ES', 'fr-FR', 'de-DE'] as const;

type Locale = (typeof LOCALES)[number];

async function readAsset(locale: Locale, fileName: string): Promise<string> {
  const filePath = path.join(ASSET_ROOT, locale, fileName);
  const content = await fs.readFile(filePath, 'utf-8');
  return content.replace(/\r\n/g, '\n').trimEnd();
}

async function loadLocaleAssets(locale: Locale) {
  const [subject, htmlBody, textBody] = await Promise.all([
    readAsset(locale, 'subject.hbs'),
    readAsset(locale, 'body.html.hbs'),
    readAsset(locale, 'body.text.hbs'),
  ]);
  return { subject, htmlBody, textBody };
}

async function seed() {
  console.log('World Book Day 2026 seed — starting');

  const config = getMultiDatabaseConfig();
  const pool = new Pool(getPoolConfig(config.backoffice));
  const db = drizzle(pool);

  try {
    const campaignPayload: NewMarketingCampaign = {
      title: CAMPAIGN_TITLE,
      description:
        'One-off celebration campaign: every author with at least one completed story receives their most recent story as a free CMYK print-ready PDF on World Book Day (April 23, 2026).',
      status: 'draft',
      audienceSource: 'users',
      userNotificationPreferences: ['news', 'inspiration'],
      filterTree: null,
      dailySendLimit: 200,
      attachmentType: 'selfprint',
      skipPrintQa: true,
      createdBy: SEED_ACTOR,
      updatedBy: SEED_ACTOR,
    };

    const existing = await db
      .select({ id: marketingCampaigns.id })
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.title, CAMPAIGN_TITLE))
      .limit(1);

    let campaignId: string;
    if (existing[0]) {
      campaignId = existing[0].id;
      await db
        .update(marketingCampaigns)
        .set({
          description: campaignPayload.description,
          audienceSource: campaignPayload.audienceSource,
          userNotificationPreferences: campaignPayload.userNotificationPreferences,
          filterTree: campaignPayload.filterTree,
          dailySendLimit: campaignPayload.dailySendLimit,
          attachmentType: campaignPayload.attachmentType,
          skipPrintQa: campaignPayload.skipPrintQa,
          updatedBy: SEED_ACTOR,
        })
        .where(eq(marketingCampaigns.id, campaignId));
      console.log(`Campaign updated (id=${campaignId})`);
    } else {
      const inserted = await db
        .insert(marketingCampaigns)
        .values(campaignPayload)
        .returning({ id: marketingCampaigns.id });
      campaignId = inserted[0].id;
      console.log(`Campaign created (id=${campaignId})`);
    }

    for (const locale of LOCALES) {
      const assets = await loadLocaleAssets(locale);
      const assetRow = await db
        .select({ id: marketingCampaignAssets.id })
        .from(marketingCampaignAssets)
        .where(
          and(
            eq(marketingCampaignAssets.campaignId, campaignId),
            eq(marketingCampaignAssets.channel, 'email'),
            eq(marketingCampaignAssets.language, locale),
          ),
        )
        .limit(1);

      if (assetRow[0]) {
        await db
          .update(marketingCampaignAssets)
          .set({
            subject: assets.subject,
            htmlBody: assets.htmlBody,
            textBody: assets.textBody,
          })
          .where(eq(marketingCampaignAssets.id, assetRow[0].id));
        console.log(`  asset updated (${locale})`);
      } else {
        await db.insert(marketingCampaignAssets).values({
          campaignId,
          channel: 'email',
          language: locale,
          subject: assets.subject,
          htmlBody: assets.htmlBody,
          textBody: assets.textBody,
        });
        console.log(`  asset inserted (${locale})`);
      }
    }

    console.log('World Book Day 2026 seed — done');
  } catch (error) {
    console.error('World Book Day 2026 seed failed:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seed();
