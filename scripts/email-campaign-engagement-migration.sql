-- Additive backoffice_db migration for campaign engagement and audience snapshots.
ALTER TABLE marketing_campaigns
  ADD COLUMN IF NOT EXISTS audience_total_snapshot integer,
  ADD COLUMN IF NOT EXISTS audience_snapshot_at timestamptz;

ALTER TABLE marketing_campaign_recipients
  ADD COLUMN IF NOT EXISTS tracking_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS clicked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_tracking
  ON marketing_campaign_recipients (campaign_id, tracking_enabled_at);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_opened
  ON marketing_campaign_recipients (campaign_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_clicked
  ON marketing_campaign_recipients (campaign_id, clicked_at);
