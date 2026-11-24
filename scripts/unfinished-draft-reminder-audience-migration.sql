-- Additive backoffice enum value for the opt-in unfinished-story campaign source.
-- Apply before deploying readers that select draft_story_id. Activate the new audience only after both deployments.
ALTER TYPE campaign_audience_source ADD VALUE IF NOT EXISTS 'unfinished_story_drafts';
ALTER TABLE marketing_campaign_recipients
  ADD COLUMN IF NOT EXISTS draft_story_id uuid;
