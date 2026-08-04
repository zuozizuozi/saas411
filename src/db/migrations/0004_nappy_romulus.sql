CREATE TABLE "rateLimit" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"lastRequest" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"window_started_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_reservations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text NOT NULL,
	"expected_size" integer NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "upload_reservations_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "upload_reservations_positive_size" CHECK ("upload_reservations"."expected_size" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limit_key_idx" ON "rateLimit" USING btree ("key");--> statement-breakpoint
CREATE INDEX "upload_reservations_user_created_idx" ON "upload_reservations" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "upload_reservations_status_expires_idx" ON "upload_reservations" USING btree ("status","expires_at");--> statement-breakpoint
-- These tables are server-only. Enabling RLS without client policies and
-- explicitly revoking the Supabase Data API roles keeps rate-limit state and
-- upload reservations inaccessible from browser-issued JWTs.
ALTER TABLE public."rateLimit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.security_rate_limits ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.upload_reservations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public."rateLimit" FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.security_rate_limits FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.upload_reservations FROM anon, authenticated;
