CREATE TYPE "public"."ContentModerationStatus" AS ENUM('PENDING', 'ALLOWED', 'PROVIDER_ONLY', 'BLOCKED', 'ERROR');--> statement-breakpoint
CREATE TABLE "content_moderation_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_key" text NOT NULL,
	"user_id" text NOT NULL,
	"video_uuid" text,
	"stage" text NOT NULL,
	"provider" text NOT NULL,
	"decision" text NOT NULL,
	"model" text,
	"prompt_hash" text,
	"asset_hash" text,
	"categories" jsonb,
	"reason" text NOT NULL,
	"external_request_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "content_moderation_events_event_key_unique" UNIQUE("event_key")
);
--> statement-breakpoint
ALTER TABLE "content_moderation_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "moderation_status" "ContentModerationStatus" DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "moderation_reason" text;--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN "moderation_checked_at" timestamp;--> statement-breakpoint
-- Historical generations predate the platform-level moderation pipeline. Keep
-- that distinction explicit instead of implying they passed an external scan.
UPDATE "videos"
SET
	"moderation_status" = 'PROVIDER_ONLY'::"ContentModerationStatus",
	"moderation_reason" = 'Generated before platform content-safety audit; provider policy only',
	"moderation_checked_at" = COALESCE("completed_at", "updated_at");--> statement-breakpoint
CREATE INDEX "content_moderation_events_user_created_idx" ON "content_moderation_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "content_moderation_events_video_created_idx" ON "content_moderation_events" USING btree ("video_uuid","created_at");--> statement-breakpoint
CREATE INDEX "content_moderation_events_decision_created_idx" ON "content_moderation_events" USING btree ("decision","created_at");--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.content_moderation_events FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON SEQUENCE public.content_moderation_events_id_seq FROM anon, authenticated;
