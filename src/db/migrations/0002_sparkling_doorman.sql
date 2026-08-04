CREATE TYPE "public"."PaymentOrderStatus" AS ENUM('PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED', 'DISPUTE_WON', 'DISPUTE_LOST');--> statement-breakpoint
ALTER TYPE "public"."CreditTransType" ADD VALUE 'PAYMENT_REVERSAL';--> statement-breakpoint
CREATE TABLE "payment_disputes" (
	"dispute_id" text PRIMARY KEY NOT NULL,
	"payment_order_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"charge_id" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"reason" text,
	"status" text NOT NULL,
	"due_by" timestamp,
	"evidence_snapshot" jsonb NOT NULL,
	"last_stripe_event_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "payment_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"order_no" text NOT NULL,
	"checkout_session_id" text,
	"payment_intent_id" text,
	"charge_id" text,
	"invoice_id" text,
	"product_id" text,
	"amount" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"credits_granted" integer DEFAULT 0 NOT NULL,
	"credits_revoked" integer DEFAULT 0 NOT NULL,
	"amount_refunded" integer DEFAULT 0 NOT NULL,
	"status" "PaymentOrderStatus" DEFAULT 'PENDING' NOT NULL,
	"purchase_ip" text,
	"user_agent" text,
	"terms_version" text,
	"terms_accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_orders_order_no_unique" UNIQUE("order_no"),
	CONSTRAINT "payment_orders_checkout_session_id_unique" UNIQUE("checkout_session_id"),
	CONSTRAINT "payment_orders_nonnegative_amounts" CHECK ("payment_orders"."amount" >= 0 and "payment_orders"."amount_refunded" >= 0 and "payment_orders"."credits_granted" >= 0 and "payment_orders"."credits_revoked" >= 0)
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"object_id" text,
	"status" text DEFAULT 'PROCESSING' NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "billing_status" text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "credit_debt" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "payment_disputes_user_idx" ON "payment_disputes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_disputes_status_due_idx" ON "payment_disputes" USING btree ("status","due_by");--> statement-breakpoint
CREATE INDEX "payment_orders_user_created_idx" ON "payment_orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_orders_payment_intent_idx" ON "payment_orders" USING btree ("payment_intent_id");--> statement-breakpoint
CREATE INDEX "payment_orders_charge_idx" ON "payment_orders" USING btree ("charge_id");--> statement-breakpoint
CREATE INDEX "payment_orders_invoice_idx" ON "payment_orders" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "stripe_events_status_updated_idx" ON "stripe_events" USING btree ("status","updated_at");--> statement-breakpoint
-- Preserve all currently recorded credit reservations while normalizing any
-- legacy rows that were damaged before ledger-level locking was introduced.
UPDATE "credit_packages"
SET
	"remaining_credits" = GREATEST("remaining_credits", 0),
	"frozen_credits" = GREATEST("frozen_credits", 0),
	"initial_credits" = GREATEST(
		"initial_credits",
		GREATEST("remaining_credits", 0) + GREATEST("frozen_credits", 0),
		0
	),
	"updated_at" = now()
WHERE
	"initial_credits" < 0 OR
	"remaining_credits" < 0 OR
	"frozen_credits" < 0 OR
	"remaining_credits" + "frozen_credits" > "initial_credits";--> statement-breakpoint
ALTER TABLE "credit_packages" ADD CONSTRAINT "credit_packages_nonnegative_credits" CHECK ("credit_packages"."initial_credits" >= 0 and "credit_packages"."remaining_credits" >= 0 and "credit_packages"."frozen_credits" >= 0);--> statement-breakpoint
ALTER TABLE "credit_packages" ADD CONSTRAINT "credit_packages_bounded_credits" CHECK ("credit_packages"."remaining_credits" + "credit_packages"."frozen_credits" <= "credit_packages"."initial_credits");--> statement-breakpoint
ALTER TABLE public.payment_disputes ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- This application uses a server-side PostgreSQL connection and does not use
-- the Supabase Data API. Remove broad API-role grants so a future permissive
-- RLS policy cannot expose authentication, billing, credit, or video data.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;--> statement-breakpoint
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;--> statement-breakpoint
REVOKE USAGE ON SCHEMA public FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM anon, authenticated;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON FUNCTIONS FROM anon, authenticated;
