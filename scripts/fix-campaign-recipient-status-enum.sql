-- Fix: Add missing enum values to campaign_recipient_status in backoffice_db
--
-- Root cause: The campaign_recipient_status enum was created (likely via drizzle-kit push)
-- without the 'skipped' and/or 'failed' values. The first 79 emails sent successfully
-- (using status='sent'), but when a recipient had no matching locale asset, the code tried
-- to insert with status='skipped', which failed because the enum value didn't exist
-- in the database.
--
-- This script safely adds the missing values using IF NOT EXISTS (PostgreSQL 9.3+).
--
-- To run:
--   psql -h <host> -U <user> -d backoffice_db -f scripts/fix-campaign-recipient-status-enum.sql
--
-- Or via Cloud SQL proxy:
--   psql "host=127.0.0.1 port=5432 dbname=backoffice_db user=<user> password=<pass> sslmode=disable" -f scripts/fix-campaign-recipient-status-enum.sql

-- Add 'skipped' if it does not already exist
ALTER TYPE campaign_recipient_status ADD VALUE IF NOT EXISTS 'skipped';

-- Add 'failed' if it does not already exist (safety check)
ALTER TYPE campaign_recipient_status ADD VALUE IF NOT EXISTS 'failed';

-- Add 'queued' if it does not already exist (safety check)
ALTER TYPE campaign_recipient_status ADD VALUE IF NOT EXISTS 'queued';

-- Verify the enum values
SELECT unnest(enum_range(NULL::campaign_recipient_status)) AS value;
