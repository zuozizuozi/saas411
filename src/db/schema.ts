import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const subscriptionPlanEnum = pgEnum("SubscriptionPlan", [
  "FREE",
  "BASIC",
  "PRO",
  "BUSINESS",
]);

export const statusEnum = pgEnum("Status", [
  "PENDING",
  "CREATING",
  "INITING",
  "RUNNING",
  "STOPPED",
  "DELETED",
]);

export const creditTransTypeEnum = pgEnum("CreditTransType", [
  "NEW_USER",
  "ORDER_PAY",
  "SUBSCRIPTION",
  "VIDEO_CONSUME",
  "REFUND",
  "EXPIRED",
  "SYSTEM_ADJUST",
  "PAYMENT_REVERSAL",
]);

export const paymentOrderStatusEnum = pgEnum("PaymentOrderStatus", [
  "PENDING",
  "PAID",
  "FAILED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "DISPUTED",
  "DISPUTE_WON",
  "DISPUTE_LOST",
]);

export const paymentRiskStatusEnum = pgEnum("PaymentRiskStatus", [
  "PENDING",
  "CLEAR",
  "REVIEW",
  "BLOCKED",
  "EFW",
  "FAILED",
  "RESOLVED",
]);

export const creditPackageStatusEnum = pgEnum("CreditPackageStatus", [
  "ACTIVE",
  "DEPLETED",
  "EXPIRED",
]);

export const videoStatusEnum = pgEnum("VideoStatus", [
  "PENDING",
  "GENERATING",
  "UPLOADING",
  "COMPLETED",
  "FAILED",
]);

export const contentModerationStatusEnum = pgEnum("ContentModerationStatus", [
  "PENDING",
  "ALLOWED",
  "PROVIDER_ONLY",
  "BLOCKED",
  "ERROR",
]);

export const customers = pgTable(
  "Customer",
  {
    id: serial("id").primaryKey(),
    authUserId: text("authUserId").notNull(),
    name: text("name"),
    plan: subscriptionPlanEnum("plan"),
    stripeCustomerId: text("stripeCustomerId").unique(),
    stripeSubscriptionId: text("stripeSubscriptionId").unique(),
    stripePriceId: text("stripePriceId"),
    stripeCurrentPeriodEnd: timestamp("stripeCurrentPeriodEnd"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    authUserIdIdx: uniqueIndex("Customer_authUserId_idx").on(table.authUserId),
  })
);

export const users = pgTable(
  "user",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name"),
    email: text("email").notNull().unique(),
    emailVerified: boolean("emailVerified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    isAdmin: boolean("isAdmin").default(false).notNull(),
    billingStatus: text("billing_status").default("ACTIVE").notNull(),
    creditDebt: integer("credit_debt").default(0).notNull(),
    generationStatus: text("generation_status").default("ACTIVE").notNull(),
    generationPauseSource: text("generation_pause_source"),
    generationPauseReason: text("generation_pause_reason"),
    generationPausedAt: timestamp("generation_paused_at"),
    generationPausedBy: text("generation_paused_by"),
    generationRiskExemptUntil: timestamp("generation_risk_exempt_until"),
  },
  (table) => ({
    nonnegativeCreditDebt: check(
      "user_nonnegative_credit_debt",
      sql`${table.creditDebt} >= 0`
    ),
    validGenerationStatus: check(
      "user_valid_generation_status",
      sql`${table.generationStatus} in ('ACTIVE', 'PAUSED')`
    ),
    validGenerationPauseSource: check(
      "user_valid_generation_pause_source",
      sql`${table.generationPauseSource} is null or ${table.generationPauseSource} in ('MANUAL', 'CREDIT_VELOCITY')`
    ),
  })
);

/** Legacy table retained only for non-destructive upgrades; no runtime code uses it. */
export const creemSubscriptions = pgTable(
  "creem_subscriptions",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("user_id").notNull(),
    productId: text("product_id").notNull(),
    subscriptionId: text("subscription_id").notNull().unique(),
    status: text("status").notNull(),
    currentPeriodEnd: timestamp("current_period_end"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("creem_subscriptions_user_id_idx").on(table.userId),
  })
);

export const sessions = pgTable(
  "session",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("userId").notNull(),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expiresAt").notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("session_user_id_idx").on(table.userId),
  })
);

export const accounts = pgTable(
  "account",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("userId").notNull(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
    scope: text("scope"),
    idToken: text("idToken"),
    password: text("password"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("account_user_id_idx").on(table.userId),
    providerAccountIdIdx: uniqueIndex("account_provider_account_id_idx").on(
      table.providerId,
      table.accountId
    ),
  })
);

export const verifications = pgTable("verification", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/** Better Auth's distributed rate-limit store for serverless deployments. */
export const rateLimits = pgTable(
  "rateLimit",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    key: text("key").notNull(),
    count: integer("count").notNull(),
    lastRequest: bigint("lastRequest", { mode: "number" }).notNull(),
  },
  (table) => ({
    keyIdx: uniqueIndex("rate_limit_key_idx").on(table.key),
  })
);

/** Atomic counters shared by expensive application endpoints across instances. */
export const securityRateLimits = pgTable("security_rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").default(1).notNull(),
  windowStartedAt: timestamp("window_started_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const legacyAccounts = pgTable(
  "Account",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("userId").notNull(),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: integer("expires_at"),
    tokenType: text("token_type"),
    scope: text("scope"),
    idToken: text("id_token"),
    sessionState: text("session_state"),
  },
  (table) => ({
    providerAccountIdIdx: uniqueIndex("Account_provider_account_id_idx").on(
      table.provider,
      table.providerAccountId
    ),
  })
);

export const legacySessions = pgTable("Session", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionToken: text("sessionToken").notNull().unique(),
  userId: text("userId").notNull(),
  expires: timestamp("expires").notNull(),
});

export const legacyUsers = pgTable("User", {
  id: text("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified"),
  image: text("image"),
});

export const legacyVerificationTokens = pgTable(
  "VerificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull().unique(),
    expires: timestamp("expires").notNull(),
  },
  (table) => ({
    identifierTokenIdx: uniqueIndex("VerificationToken_identifier_token_idx").on(
      table.identifier,
      table.token
    ),
  })
);

export const k8sClusterConfigs = pgTable(
  "K8sClusterConfig",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    location: text("location").notNull(),
    authUserId: text("authUserId").notNull(),
    plan: subscriptionPlanEnum("plan").default("FREE"),
    network: text("network"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    status: statusEnum("status").default("PENDING"),
    delete: boolean("delete").default(false),
  },
  (table) => ({
    authUserIdIdx: index("K8sClusterConfig_authUserId_idx").on(table.authUserId),
  })
);

export const creditPackages = pgTable(
  "credit_packages",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    initialCredits: integer("initial_credits").notNull(),
    remainingCredits: integer("remaining_credits").notNull(),
    frozenCredits: integer("frozen_credits").default(0).notNull(),
    transType: creditTransTypeEnum("trans_type").notNull(),
    orderNo: text("order_no"),
    status: creditPackageStatusEnum("status").default("ACTIVE").notNull(),
    expiredAt: timestamp("expired_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userStatusIdx: index("credit_packages_user_id_status_idx").on(
      table.userId,
      table.status
    ),
    userExpiredIdx: index("credit_packages_user_id_expired_at_idx").on(
      table.userId,
      table.expiredAt
    ),
    orderNoIdx: uniqueIndex("credit_packages_order_no_idx").on(table.orderNo),
    nonnegativeCredits: check(
      "credit_packages_nonnegative_credits",
      sql`${table.initialCredits} >= 0 and ${table.remainingCredits} >= 0 and ${table.frozenCredits} >= 0`
    ),
    boundedCredits: check(
      "credit_packages_bounded_credits",
      sql`${table.remainingCredits} + ${table.frozenCredits} <= ${table.initialCredits}`
    ),
  })
);

/** Stripe payment ledger used to reconcile grants, refunds, and disputes. */
export const paymentOrders = pgTable(
  "payment_orders",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    orderNo: text("order_no").notNull().unique(),
    checkoutSessionId: text("checkout_session_id").unique(),
    paymentIntentId: text("payment_intent_id"),
    chargeId: text("charge_id"),
    invoiceId: text("invoice_id"),
    productId: text("product_id"),
    amount: integer("amount").default(0).notNull(),
    currency: text("currency").default("usd").notNull(),
    creditsGranted: integer("credits_granted").default(0).notNull(),
    creditsRevoked: integer("credits_revoked").default(0).notNull(),
    amountRefunded: integer("amount_refunded").default(0).notNull(),
    status: paymentOrderStatusEnum("status").default("PENDING").notNull(),
    riskStatus: paymentRiskStatusEnum("risk_status").default("PENDING").notNull(),
    riskLevel: text("risk_level"),
    riskScore: integer("risk_score"),
    riskReason: text("risk_reason"),
    reviewId: text("review_id"),
    earlyFraudWarningId: text("early_fraud_warning_id"),
    threeDSecureResult: text("three_d_secure_result"),
    liabilityShift: boolean("liability_shift"),
    riskEvaluatedAt: timestamp("risk_evaluated_at"),
    fulfilledAt: timestamp("fulfilled_at"),
    creditTransType: text("credit_trans_type"),
    creditExpiryDays: integer("credit_expiry_days"),
    fulfillmentRemark: text("fulfillment_remark"),
    purchaseIp: text("purchase_ip"),
    userAgent: text("user_agent"),
    termsVersion: text("terms_version"),
    termsAcceptedAt: timestamp("terms_accepted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index("payment_orders_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
    paymentIntentIdx: index("payment_orders_payment_intent_idx").on(
      table.paymentIntentId
    ),
    chargeIdx: index("payment_orders_charge_idx").on(table.chargeId),
    invoiceIdx: index("payment_orders_invoice_idx").on(table.invoiceId),
    riskUpdatedIdx: index("payment_orders_risk_updated_idx").on(
      table.riskStatus,
      table.updatedAt
    ),
    nonnegativeAmounts: check(
      "payment_orders_nonnegative_amounts",
      sql`${table.amount} >= 0 and ${table.amountRefunded} >= 0 and ${table.creditsGranted} >= 0 and ${table.creditsRevoked} >= 0`
    ),
    boundedReversals: check(
      "payment_orders_bounded_reversals",
      sql`${table.amountRefunded} <= ${table.amount} and ${table.creditsRevoked} <= ${table.creditsGranted}`
    ),
    validRiskScore: check(
      "payment_orders_valid_risk_score",
      sql`${table.riskScore} is null or (${table.riskScore} >= 0 and ${table.riskScore} <= 99)`
    ),
    validCreditExpiry: check(
      "payment_orders_valid_credit_expiry",
      sql`${table.creditExpiryDays} is null or ${table.creditExpiryDays} > 0`
    ),
  })
);

/** Immutable payment-risk decisions and Radar lifecycle history. */
export const paymentRiskEvents = pgTable(
  "payment_risk_events",
  {
    id: serial("id").primaryKey(),
    eventKey: text("event_key").notNull().unique(),
    paymentOrderId: integer("payment_order_id"),
    userId: text("user_id"),
    source: text("source").notNull(),
    action: text("action").notNull(),
    status: text("status").notNull(),
    riskLevel: text("risk_level"),
    riskScore: integer("risk_score"),
    stripeObjectId: text("stripe_object_id"),
    reason: text("reason").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: text("resolved_by"),
    resolutionRemark: text("resolution_remark"),
  },
  (table) => ({
    statusCreatedIdx: index("payment_risk_events_status_created_idx").on(
      table.status,
      table.createdAt
    ),
    userCreatedIdx: index("payment_risk_events_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
    paymentOrderIdx: index("payment_risk_events_payment_order_idx").on(
      table.paymentOrderId
    ),
    validRiskScore: check(
      "payment_risk_events_valid_risk_score",
      sql`${table.riskScore} is null or (${table.riskScore} >= 0 and ${table.riskScore} <= 99)`
    ),
  })
);

/** Durable Stripe webhook inbox used for retry-safe event processing. */
export const stripeEvents = pgTable(
  "stripe_events",
  {
    eventId: text("event_id").primaryKey(),
    eventType: text("event_type").notNull(),
    objectId: text("object_id"),
    status: text("status").default("PROCESSING").notNull(),
    attempts: integer("attempts").default(1).notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
  },
  (table) => ({
    statusUpdatedIdx: index("stripe_events_status_updated_idx").on(
      table.status,
      table.updatedAt
    ),
  })
);

/** Dispute mirror and evidence snapshot for manual submissions in Stripe. */
export const paymentDisputes = pgTable(
  "payment_disputes",
  {
    disputeId: text("dispute_id").primaryKey(),
    paymentOrderId: integer("payment_order_id").notNull(),
    userId: text("user_id").notNull(),
    chargeId: text("charge_id").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    reason: text("reason"),
    status: text("status").notNull(),
    dueBy: timestamp("due_by"),
    evidenceSnapshot: jsonb("evidence_snapshot").notNull(),
    lastStripeEventId: text("last_stripe_event_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
  },
  (table) => ({
    userIdx: index("payment_disputes_user_idx").on(table.userId),
    statusDueIdx: index("payment_disputes_status_due_idx").on(
      table.status,
      table.dueBy
    ),
    positiveAmount: check(
      "payment_disputes_positive_amount",
      sql`${table.amount} > 0`
    ),
  })
);

export const creditHolds = pgTable(
  "credit_holds",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    videoUuid: text("video_uuid").notNull().unique(),
    credits: integer("credits").notNull(),
    status: text("status").default("HOLDING").notNull(),
    packageAllocation: jsonb("package_allocation").notNull(),
    packageId: integer("package_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    settledAt: timestamp("settled_at"),
  },
  (table) => ({
    userIdx: index("credit_holds_user_id_idx").on(table.userId),
    statusIdx: index("credit_holds_status_idx").on(table.status),
    packageIdx: index("credit_holds_package_id_idx").on(table.packageId),
  })
);

export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: serial("id").primaryKey(),
    transNo: text("trans_no").notNull().unique(),
    userId: text("user_id").notNull(),
    transType: creditTransTypeEnum("trans_type").notNull(),
    credits: integer("credits").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    packageId: integer("package_id"),
    videoUuid: text("video_uuid"),
    orderNo: text("order_no"),
    holdId: integer("hold_id"),
    operatorUserId: text("operator_user_id"),
    remark: text("remark"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("credit_transactions_user_id_idx").on(table.userId),
    transTypeIdx: index("credit_transactions_trans_type_idx").on(table.transType),
    createdAtIdx: index("credit_transactions_created_at_idx").on(
      table.createdAt
    ),
  })
);

export const videos = pgTable(
  "videos",
  {
    id: serial("id").primaryKey(),
    uuid: text("uuid").notNull().unique(),
    batchUuid: text("batch_uuid"),
    userId: text("user_id").notNull(),
    prompt: text("prompt").notNull(),
    model: text("model").notNull(),
    parameters: jsonb("parameters"),
    status: videoStatusEnum("status").default("PENDING").notNull(),
    provider: text("provider"),
    externalTaskId: text("external_task_id"),
    errorMessage: text("error_message"),
    moderationStatus: contentModerationStatusEnum("moderation_status")
      .default("PENDING")
      .notNull(),
    moderationReason: text("moderation_reason"),
    moderationCheckedAt: timestamp("moderation_checked_at"),
    startImageUrl: text("start_image_url"),
    originalVideoUrl: text("original_video_url"),
    videoUrl: text("video_url"),
    thumbnailUrl: text("thumbnail_url"),
    duration: integer("duration"),
    resolution: text("resolution"),
    aspectRatio: text("aspect_ratio"),
    fileSize: integer("file_size"),
    creditsUsed: integer("credits_used").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    generationTime: integer("generation_time"),
    isDeleted: boolean("is_deleted").default(false).notNull(),
  },
  (table) => ({
    userIdx: index("videos_user_id_idx").on(table.userId),
    batchIdx: index("videos_batch_uuid_idx").on(table.batchUuid),
    statusIdx: index("videos_status_idx").on(table.status),
    createdAtIdx: index("videos_created_at_idx").on(table.createdAt),
  })
);

/** Privacy-minimized audit trail for content-safety decisions. */
export const contentModerationEvents = pgTable(
  "content_moderation_events",
  {
    id: serial("id").primaryKey(),
    eventKey: text("event_key").notNull().unique(),
    userId: text("user_id").notNull(),
    videoUuid: text("video_uuid"),
    stage: text("stage").notNull(),
    provider: text("provider").notNull(),
    decision: text("decision").notNull(),
    model: text("model"),
    promptHash: text("prompt_hash"),
    assetHash: text("asset_hash"),
    categories: jsonb("categories"),
    reason: text("reason").notNull(),
    externalRequestId: text("external_request_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index("content_moderation_events_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
    videoCreatedIdx: index("content_moderation_events_video_created_idx").on(
      table.videoUuid,
      table.createdAt
    ),
    decisionCreatedIdx: index(
      "content_moderation_events_decision_created_idx"
    ).on(table.decision, table.createdAt),
  })
).enableRLS();

/** Upload intents are reserved before a client receives an object-store URL. */
export const uploadReservations = pgTable(
  "upload_reservations",
  {
    id: text("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("user_id").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    expectedSize: integer("expected_size").notNull(),
    status: text("status").default("PENDING").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    userCreatedIdx: index("upload_reservations_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
    statusExpiresIdx: index("upload_reservations_status_expires_idx").on(
      table.status,
      table.expiresAt
    ),
    positiveSize: check(
      "upload_reservations_positive_size",
      sql`${table.expectedSize} > 0`
    ),
  })
);

/** Immutable warning/pause history for manual controls and credit-velocity risk. */
export const generationRiskEvents = pgTable(
  "generation_risk_events",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    source: text("source").notNull(),
    action: text("action").notNull(),
    level: text("level"),
    status: text("status").default("OPEN").notNull(),
    actorUserId: text("actor_user_id"),
    paymentOrderId: integer("payment_order_id"),
    reason: text("reason").notNull(),
    consumedCredits: integer("consumed_credits"),
    grantedCredits: integer("granted_credits"),
    windowHours: integer("window_hours"),
    emailSentAt: timestamp("email_sent_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: text("resolved_by"),
    resolutionRemark: text("resolution_remark"),
  },
  (table) => ({
    userStatusIdx: index("generation_risk_events_user_status_idx").on(
      table.userId,
      table.status
    ),
    paymentActionIdx: index("generation_risk_events_payment_action_idx").on(
      table.paymentOrderId,
      table.action
    ),
    nonnegativeMetrics: check(
      "generation_risk_events_nonnegative_metrics",
      sql`(${table.consumedCredits} is null or ${table.consumedCredits} >= 0)
        and (${table.grantedCredits} is null or ${table.grantedCredits} > 0)
        and (${table.windowHours} is null or ${table.windowHours} > 0)`
    ),
  })
).enableRLS();

/** User-owned uploads that can be reused as image-to-video inputs. */
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: serial("id").primaryKey(),
    uuid: text("uuid").notNull().unique(),
    userId: text("user_id").notNull(),
    kind: text("kind").notNull().default("IMAGE"),
    storageKey: text("storage_key").notNull().unique(),
    url: text("url").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    fileSize: integer("file_size").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index("media_assets_user_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
  })
);

export const providerEvents = pgTable(
  "provider_events",
  {
    id: serial("id").primaryKey(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    videoUuid: text("video_uuid"),
    operation: text("operation").notNull(),
    success: boolean("success").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    creditsQuoted: integer("credits_quoted").default(0).notNull(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    providerCreatedIdx: index("provider_events_provider_created_at_idx").on(
      table.provider,
      table.createdAt
    ),
  })
);

export type Customer = typeof customers.$inferSelect;
export type BetterAuthUser = typeof users.$inferSelect;
export type CreditPackage = typeof creditPackages.$inferSelect;
export type CreditHold = typeof creditHolds.$inferSelect;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type GenerationRiskEvent = typeof generationRiskEvents.$inferSelect;
export type Video = typeof videos.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type UploadReservation = typeof uploadReservations.$inferSelect;
export type ProviderEvent = typeof providerEvents.$inferSelect;
export type PaymentOrder = typeof paymentOrders.$inferSelect;
export type PaymentDispute = typeof paymentDisputes.$inferSelect;
export type PaymentRiskEvent = typeof paymentRiskEvents.$inferSelect;
export type ContentModerationEvent = typeof contentModerationEvents.$inferSelect;

export const SubscriptionPlan = {
  FREE: "FREE",
  BASIC: "BASIC",
  PRO: "PRO",
  BUSINESS: "BUSINESS",
} as const;
export type SubscriptionPlan =
  (typeof SubscriptionPlan)[keyof typeof SubscriptionPlan];

export const CreditTransType = {
  NEW_USER: "NEW_USER",
  ORDER_PAY: "ORDER_PAY",
  SUBSCRIPTION: "SUBSCRIPTION",
  VIDEO_CONSUME: "VIDEO_CONSUME",
  REFUND: "REFUND",
  EXPIRED: "EXPIRED",
  SYSTEM_ADJUST: "SYSTEM_ADJUST",
  PAYMENT_REVERSAL: "PAYMENT_REVERSAL",
} as const;
export type CreditTransType =
  (typeof CreditTransType)[keyof typeof CreditTransType];

export const CreditPackageStatus = {
  ACTIVE: "ACTIVE",
  DEPLETED: "DEPLETED",
  EXPIRED: "EXPIRED",
} as const;
export type CreditPackageStatus =
  (typeof CreditPackageStatus)[keyof typeof CreditPackageStatus];

export const VideoStatus = {
  PENDING: "PENDING",
  GENERATING: "GENERATING",
  UPLOADING: "UPLOADING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export type VideoStatus = (typeof VideoStatus)[keyof typeof VideoStatus];
