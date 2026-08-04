CREATE TABLE "generation_risk_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"action" text NOT NULL,
	"level" text,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"actor_user_id" text,
	"payment_order_id" integer,
	"reason" text NOT NULL,
	"consumed_credits" integer,
	"granted_credits" integer,
	"window_hours" integer,
	"email_sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" text,
	"resolution_remark" text,
	CONSTRAINT "generation_risk_events_nonnegative_metrics" CHECK (("generation_risk_events"."consumed_credits" is null or "generation_risk_events"."consumed_credits" >= 0)
        and ("generation_risk_events"."granted_credits" is null or "generation_risk_events"."granted_credits" > 0)
        and ("generation_risk_events"."window_hours" is null or "generation_risk_events"."window_hours" > 0))
);
--> statement-breakpoint
ALTER TABLE "generation_risk_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD COLUMN "operator_user_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "generation_status" text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "generation_pause_source" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "generation_pause_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "generation_paused_at" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "generation_paused_by" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "generation_risk_exempt_until" timestamp;--> statement-breakpoint
CREATE INDEX "generation_risk_events_user_status_idx" ON "generation_risk_events" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "generation_risk_events_payment_action_idx" ON "generation_risk_events" USING btree ("payment_order_id","action");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_valid_generation_status" CHECK ("user"."generation_status" in ('ACTIVE', 'PAUSED'));--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_valid_generation_pause_source" CHECK ("user"."generation_pause_source" is null or "user"."generation_pause_source" in ('MANUAL', 'CREDIT_VELOCITY'));
