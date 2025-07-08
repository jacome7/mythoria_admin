-- Migration Script: Convert tickets table ID from serial to UUID
-- WARNING: This will drop all data in tickets and ticket_comments tables
-- Only run this if you have confirmed all ticket data can be safely deleted

-- Start transaction
BEGIN;

-- Drop dependent table first
DROP TABLE IF EXISTS "ticket_comments" CASCADE;

-- Drop the main tickets table
DROP TABLE IF EXISTS "tickets" CASCADE;

-- Recreate tickets table with UUID primary key
CREATE TABLE "tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "category" varchar(50) NOT NULL,
  "subject" varchar(255) NOT NULL,
  "description" text NOT NULL,
  "status" "ticket_status" DEFAULT 'open' NOT NULL,
  "priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone
);

-- Create indexes for tickets table
CREATE INDEX "idx_tickets_status" ON "tickets" ("status");
CREATE INDEX "idx_tickets_category" ON "tickets" ("category");
CREATE INDEX "idx_tickets_created_at" ON "tickets" ("created_at");

-- Recreate ticket_comments table with UUID foreign key
CREATE TABLE "ticket_comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "ticket_id" uuid NOT NULL,
  "author_id" uuid,
  "body" text NOT NULL,
  "is_internal" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create index for ticket_comments
CREATE INDEX "idx_ticket_comments_ticket_id" ON "ticket_comments" ("ticket_id");

-- Add foreign key constraint
ALTER TABLE "ticket_comments" 
ADD CONSTRAINT "ticket_comments_ticket_id_tickets_id_fk" 
FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE cascade;

-- Commit transaction
COMMIT;

-- Show completion message
SELECT 'Migration completed successfully. Tickets table now uses UUID primary key.' AS message;
