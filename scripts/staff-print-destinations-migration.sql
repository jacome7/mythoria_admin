-- Backoffice database. Apply with the approved Admin migration workflow.
BEGIN;
CREATE TABLE IF NOT EXISTS "public"."staff_print_destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_email" varchar(255) NOT NULL,
	"label" varchar(80) NOT NULL,
	"recipient_name" varchar(120) NOT NULL,
	"recipient_email" varchar(255) NOT NULL,
	"phone_number" varchar(30) NOT NULL,
	"street1" varchar(255) NOT NULL,
	"street2" varchar(255),
	"city" varchar(120) NOT NULL,
	"postcode" varchar(20) NOT NULL,
	"state_code" varchar(120),
	"country_code" varchar(2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "staff_print_destinations_owner_label_unique" ON "public"."staff_print_destinations" USING btree ("owner_email","label");
CREATE INDEX IF NOT EXISTS "staff_print_destinations_owner_created_idx" ON "public"."staff_print_destinations" USING btree ("owner_email","created_at");
COMMIT;
