import { and, eq, isNull } from 'drizzle-orm';
import { config as loadEnvironment } from 'dotenv';
import { getBackofficeDb } from '@/db';
import { marketingCampaigns } from '@/db/schema/campaigns';
import { campaignService } from '@/db/services/campaigns';

loadEnvironment({ path: '.env.local', quiet: true });

const campaignId = process.argv[2];
if (!campaignId) throw new Error('Usage: npm run campaign:snapshot -- <campaign-id>');

const campaign = await campaignService.getCampaign(campaignId);
if (!campaign) throw new Error(`Campaign not found: ${campaignId}`);

const [progress, remaining] = await Promise.all([
  campaignService.getCampaignProgress(campaignId),
  campaignService.getEstimatedAudienceCount(
    campaignId,
    campaign.audienceSource,
    campaign.filterTree as Parameters<typeof campaignService.getEstimatedAudienceCount>[2],
    campaign.userNotificationPreferences,
    campaign.attachmentType,
  ),
]);

const audienceTotalSnapshot = progress.total + remaining.total;
const [updated] = await getBackofficeDb()
  .update(marketingCampaigns)
  .set({ audienceTotalSnapshot, audienceSnapshotAt: new Date() })
  .where(
    and(eq(marketingCampaigns.id, campaignId), isNull(marketingCampaigns.audienceTotalSnapshot)),
  )
  .returning({
    id: marketingCampaigns.id,
    audienceTotalSnapshot: marketingCampaigns.audienceTotalSnapshot,
    audienceSnapshotAt: marketingCampaigns.audienceSnapshotAt,
  });

console.log(
  JSON.stringify(
    updated ?? {
      id: campaignId,
      audienceTotalSnapshot: progress.audienceTotalSnapshot,
      audienceSnapshotAt: progress.audienceSnapshotAt,
      unchanged: true,
    },
  ),
);
