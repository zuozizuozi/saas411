CREATE TABLE IF NOT EXISTS "media_assets" (
  "id" serial PRIMARY KEY NOT NULL,
  "uuid" text NOT NULL,
  "user_id" text NOT NULL,
  "kind" text DEFAULT 'IMAGE' NOT NULL,
  "storage_key" text NOT NULL,
  "url" text NOT NULL,
  "file_name" text NOT NULL,
  "content_type" text NOT NULL,
  "file_size" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "media_assets_uuid_unique" UNIQUE("uuid"),
  CONSTRAINT "media_assets_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_user_created_at_idx"
  ON "media_assets" USING btree ("user_id", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_packages_order_no_idx"
  ON "credit_packages" USING btree ("order_no");
--> statement-breakpoint
ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "batch_uuid" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "videos_batch_uuid_idx"
  ON "videos" USING btree ("batch_uuid");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "video_uuid" text,
  "operation" text NOT NULL,
  "success" boolean NOT NULL,
  "latency_ms" integer NOT NULL,
  "credits_quoted" integer DEFAULT 0 NOT NULL,
  "error_message" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "provider_events_provider_created_at_idx"
  ON "provider_events" USING btree ("provider", "created_at");
--> statement-breakpoint
DROP INDEX IF EXISTS "Customer_authUserId_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_authUserId_idx"
  ON "Customer" USING btree ("authUserId");
--> statement-breakpoint
ALTER TYPE "SubscriptionPlan" ADD VALUE IF NOT EXISTS 'BASIC' AFTER 'FREE';
