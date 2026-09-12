CREATE TABLE "referral_admin_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"manager_id" uuid NOT NULL,
	"role" varchar(32) NOT NULL,
	"granted_by" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_admin_role_check" CHECK ("referral_admin_roles"."role" in ('referral_viewer','referral_manager','finance','super_admin'))
);
--> statement-breakpoint
ALTER TABLE "referral_admin_roles" ADD CONSTRAINT "referral_admin_roles_manager_id_managers_manager_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."managers"("manager_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "referral_admin_role_unique" ON "referral_admin_roles" USING btree ("manager_id","role");