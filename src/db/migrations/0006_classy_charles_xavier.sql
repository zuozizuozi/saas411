CREATE TYPE "public"."PaymentRiskStatus" AS ENUM('PENDING', 'CLEAR', 'REVIEW', 'BLOCKED', 'EFW', 'FAILED', 'RESOLVED');--> statement-breakpoint
ALTER TYPE "public"."PaymentOrderStatus" ADD VALUE 'FAILED' BEFORE 'PARTIALLY_REFUNDED';--> statement-breakpoint
CREATE TABLE "payment_risk_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_key" text NOT NULL,
	"payment_order_id" integer,
	"user_id" text,
	"source" text NOT NULL,
	"action" text NOT NULL,
	"status" text NOT NULL,
	"risk_level" text,
	"risk_score" integer,
	"stripe_object_id" text,
	"reason" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" text,
	"resolution_remark" text,
	CONSTRAINT "payment_risk_events_event_key_unique" UNIQUE("event_key"),
	CONSTRAINT "payment_risk_events_valid_risk_score" CHECK ("payment_risk_events"."risk_score" is null or ("payment_risk_events"."risk_score" >= 0 and "payment_risk_events"."risk_score" <= 99))
);
--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "risk_status" "PaymentRiskStatus" DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "risk_level" text;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "risk_score" integer;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "risk_reason" text;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "review_id" text;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "early_fraud_warning_id" text;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "three_d_secure_result" text;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "liability_shift" boolean;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "risk_evaluated_at" timestamp;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "fulfilled_at" timestamp;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "credit_trans_type" text;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "credit_expiry_days" integer;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD COLUMN "fulfillment_remark" text;--> statement-breakpoint
-- Orders already present were fulfilled by the pre-risk webhook path. Mark
-- them explicitly so future refunds/disputes do not treat them as held grants.
UPDATE "payment_orders"
SET
	"fulfilled_at" = "created_at",
	"risk_evaluated_at" = "updated_at",
	"risk_status" = CASE
		WHEN "status" IN ('REFUNDED', 'DISPUTE_WON') THEN 'RESOLVED'::"PaymentRiskStatus"
		WHEN "status" IN ('DISPUTED', 'DISPUTE_LOST') THEN 'BLOCKED'::"PaymentRiskStatus"
		ELSE 'CLEAR'::"PaymentRiskStatus"
	END,
	"risk_reason" = 'Legacy order fulfilled before payment-risk holds'
WHERE "status" <> 'PENDING';--> statement-breakpoint
CREATE INDEX "payment_risk_events_status_created_idx" ON "payment_risk_events" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "payment_risk_events_user_created_idx" ON "payment_risk_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_risk_events_payment_order_idx" ON "payment_risk_events" USING btree ("payment_order_id");--> statement-breakpoint
CREATE INDEX "payment_orders_risk_updated_idx" ON "payment_orders" USING btree ("risk_status","updated_at");--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_valid_risk_score" CHECK ("payment_orders"."risk_score" is null or ("payment_orders"."risk_score" >= 0 and "payment_orders"."risk_score" <= 99));--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_valid_credit_expiry" CHECK ("payment_orders"."credit_expiry_days" is null or "payment_orders"."credit_expiry_days" > 0);--> statement-breakpoint
ALTER TABLE public.payment_risk_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON TABLE public.payment_risk_events FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON SEQUENCE public.payment_risk_events_id_seq FROM anon, authenticated;
