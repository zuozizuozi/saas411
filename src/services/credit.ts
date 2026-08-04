import {
  CreditPackageStatus,
  CreditTransType,
  creditHolds,
  creditPackages,
  creditTransactions,
  customers,
  db,
  paymentOrders,
  users,
  type CreditPackage,
} from "@/db";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  gt,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { nanoid } from "nanoid";
import { CREDITS_CONFIG } from "../config/credits";
import { ApiError } from "@/lib/api/error";
import { generationRiskService } from "./generation-risk";

// Re-export enums for consumers
export { CreditTransType, CreditPackageStatus };

export interface CreditBalance {
  totalCredits: number; // 总获得积分
  usedCredits: number; // 已消耗积分
  frozenCredits: number; // 冻结中积分
  availableCredits: number; // 可用积分 (total - used - frozen)
  expiringSoon: number; // 即将过期（7天内）
  plan?: "FREE" | "BASIC" | "PRO" | "BUSINESS" | null; // 用户订阅计划
}

interface PackageAllocation {
  packageId: number;
  credits: number;
}

export class CreditService {
  /**
   * 获取用户积分余额
   */
  async getBalance(userId: string): Promise<CreditBalance> {
    const now = new Date();
    const expiringSoonDate = new Date(
      now.getTime() +
      CREDITS_CONFIG.expiration.warnBeforeDays * 24 * 60 * 60 * 1000
    );

    const packages = await db
      .select()
      .from(creditPackages)
      .where(
        and(
          eq(creditPackages.userId, userId),
          eq(creditPackages.status, CreditPackageStatus.ACTIVE),
          or(
            isNull(creditPackages.expiredAt),
            gt(creditPackages.expiredAt, now)
          )
        )
      )


    const [customer] = await db
      .select({ plan: customers.plan })
      .from(customers)
      .where(eq(customers.authUserId, userId))
      .limit(1);

    let totalCredits = 0;
    let usedCredits = 0;
    let frozenCredits = 0;
    let expiringSoon = 0;

    for (const pkg of packages) {
      totalCredits += pkg.initialCredits;
      usedCredits +=
        pkg.initialCredits - pkg.remainingCredits - pkg.frozenCredits;
      frozenCredits += pkg.frozenCredits;

      if (pkg.expiredAt && pkg.expiredAt <= expiringSoonDate) {
        expiringSoon += pkg.remainingCredits;
      }
    }

    return {
      totalCredits,
      usedCredits,
      frozenCredits,
      availableCredits: packages.reduce(
        (sum, p) => sum + p.remainingCredits,
        0
      ),
      expiringSoon,
      plan: customer?.plan,
    };
  }

  /**
   * 冻结积分（任务创建时调用）
   * 使用数据库事务 + 唯一约束保证幂等性
   */
  async freeze(params: {
    userId: string;
    credits: number;
    videoUuid: string;
  }): Promise<{ success: boolean; holdId: number }> {
    const { userId, credits, videoUuid } = params;

    return db.transaction(async (trx) => {
      await trx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`credit-ledger:${userId}`}))`
      );

      const [existingHold] = await trx
        .select()
        .from(creditHolds)
        .where(eq(creditHolds.videoUuid, videoUuid))
        .limit(1);

      if (existingHold) {
        if (existingHold.status === "HOLDING") {
          return { success: true, holdId: existingHold.id };
        }
        throw new Error(`Hold already processed for video: ${videoUuid}`);
      }

      const now = new Date();

      const packages = await trx
        .select()
        .from(creditPackages)
        .where(
          and(
            eq(creditPackages.userId, userId),
            eq(creditPackages.status, CreditPackageStatus.ACTIVE),
            gt(creditPackages.remainingCredits, 0),
            or(
              isNull(creditPackages.expiredAt),
              gt(creditPackages.expiredAt, now)
            )
          )
        )
        .orderBy(
          sql`${creditPackages.expiredAt} is null`,
          asc(creditPackages.expiredAt),
          asc(creditPackages.createdAt)
        );

      const availableCredits = packages.reduce(
        (sum, p) => sum + p.remainingCredits,
        0
      );
      if (availableCredits < credits) {
        throw new Error(
          `Insufficient credits. Required: ${credits}, Available: ${availableCredits}`
        );
      }

      const allocation: PackageAllocation[] = [];
      let remaining = credits;

      for (const pkg of packages) {
        if (remaining <= 0) break;

        const toFreeze = Math.min(pkg.remainingCredits, remaining);
        allocation.push({ packageId: pkg.id, credits: toFreeze });

        const updated = await trx
          .update(creditPackages)
          .set({
            remainingCredits: sql`${creditPackages.remainingCredits} - ${toFreeze}`,
            frozenCredits: sql`${creditPackages.frozenCredits} + ${toFreeze}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(creditPackages.id, pkg.id),
              eq(creditPackages.status, CreditPackageStatus.ACTIVE),
              gte(creditPackages.remainingCredits, toFreeze),
              or(
                isNull(creditPackages.expiredAt),
                gt(creditPackages.expiredAt, now)
              )
            )
          )
          .returning({ id: creditPackages.id });
        if (updated.length !== 1) {
          throw new Error("Credit package changed while credits were being frozen");
        }

        remaining -= toFreeze;
      }

      const [holdResult] = await trx
        .insert(creditHolds)
        .values({
          userId,
          videoUuid,
          credits,
          status: "HOLDING",
          packageAllocation: allocation,
        })
        .returning({ id: creditHolds.id });

      if (!holdResult) {
        throw new Error("Failed to create credit hold");
      }

      return { success: true, holdId: holdResult.id };
    });
  }

  /** Freeze every output in a batch under one user-scoped ledger lock. */
  async freezeMany(
    requests: Array<{ userId: string; credits: number; videoUuid: string }>
  ): Promise<Array<{ success: true; holdId: number; videoUuid: string }>> {
    if (requests.length === 0) return [];
    const userId = requests[0]!.userId;
    if (requests.some((request) => request.userId !== userId)) {
      throw new Error("A credit batch cannot span multiple users");
    }
    if (new Set(requests.map((request) => request.videoUuid)).size !== requests.length) {
      throw new Error("A credit batch cannot contain duplicate videos");
    }

    return db.transaction(async (trx) => {
      await trx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`credit-ledger:${userId}`}))`
      );

      const existing = await trx
        .select()
        .from(creditHolds)
        .where(inArray(creditHolds.videoUuid, requests.map((item) => item.videoUuid)));
      if (existing.length > 0) {
        if (
          existing.length === requests.length &&
          existing.every((hold) => hold.status === "HOLDING")
        ) {
          return existing.map((hold) => ({
            success: true as const,
            holdId: hold.id,
            videoUuid: hold.videoUuid,
          }));
        }
        throw new Error("Credit batch was already partially processed");
      }

      const now = new Date();
      const packages = await trx
        .select()
        .from(creditPackages)
        .where(
          and(
            eq(creditPackages.userId, userId),
            eq(creditPackages.status, CreditPackageStatus.ACTIVE),
            gt(creditPackages.remainingCredits, 0),
            or(isNull(creditPackages.expiredAt), gt(creditPackages.expiredAt, now))
          )
        )
        .orderBy(
          sql`${creditPackages.expiredAt} is null`,
          asc(creditPackages.expiredAt),
          asc(creditPackages.createdAt)
        );

      const totalRequired = requests.reduce((sum, request) => sum + request.credits, 0);
      const totalAvailable = packages.reduce(
        (sum, pkg) => sum + pkg.remainingCredits,
        0
      );
      if (totalAvailable < totalRequired) {
        throw new Error(
          `Insufficient credits. Required: ${totalRequired}, Available: ${totalAvailable}`
        );
      }

      const packageState = new Map(
        packages.map((pkg) => [
          pkg.id,
          { remaining: pkg.remainingCredits, frozen: pkg.frozenCredits },
        ])
      );
      const holdValues = requests.map((request) => {
        let remaining = request.credits;
        const allocation: PackageAllocation[] = [];
        for (const pkg of packages) {
          if (remaining <= 0) break;
          const state = packageState.get(pkg.id)!;
          const amount = Math.min(state.remaining, remaining);
          if (amount <= 0) continue;
          allocation.push({ packageId: pkg.id, credits: amount });
          state.remaining -= amount;
          state.frozen += amount;
          remaining -= amount;
        }
        return {
          userId,
          videoUuid: request.videoUuid,
          credits: request.credits,
          status: "HOLDING",
          packageAllocation: allocation,
        };
      });

      for (const [packageId, state] of packageState) {
        const original = packages.find((pkg) => pkg.id === packageId);
        if (!original) throw new Error(`Credit package not found: ${packageId}`);
        const updated = await trx
          .update(creditPackages)
          .set({
            remainingCredits: state.remaining,
            frozenCredits: state.frozen,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(creditPackages.id, packageId),
              eq(creditPackages.status, CreditPackageStatus.ACTIVE),
              eq(creditPackages.remainingCredits, original.remainingCredits),
              eq(creditPackages.frozenCredits, original.frozenCredits)
            )
          )
          .returning({ id: creditPackages.id });
        if (updated.length !== 1) {
          throw new Error("Credit package changed while batch credits were being frozen");
        }
      }

      const holds = await trx.insert(creditHolds).values(holdValues).returning({
        id: creditHolds.id,
        videoUuid: creditHolds.videoUuid,
      });
      if (holds.length !== requests.length) {
        throw new Error("Failed to create every credit hold in the batch");
      }
      return holds.map((hold) => ({
        success: true as const,
        holdId: hold.id,
        videoUuid: hold.videoUuid,
      }));
    });
  }

  /**
   * 结算积分（任务成功时调用）
   */
  async settle(videoUuid: string): Promise<void> {
    const userId = await db.transaction(async (trx) => {
      const [candidate] = await trx
        .select({ userId: creditHolds.userId, status: creditHolds.status })
        .from(creditHolds)
        .where(eq(creditHolds.videoUuid, videoUuid))
        .limit(1);
      if (!candidate) throw new Error(`Hold not found for video: ${videoUuid}`);
      if (candidate.status === "SETTLED") return candidate.userId;
      if (candidate.status !== "HOLDING") {
        throw new Error(`Invalid hold status: ${candidate.status}`);
      }

      await trx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`credit-ledger:${candidate.userId}`}))`
      );

      const [hold] = await trx
        .update(creditHolds)
        .set({ status: "SETTLED", settledAt: new Date() })
        .where(
          and(
            eq(creditHolds.videoUuid, videoUuid),
            eq(creditHolds.status, "HOLDING")
          )
        )
        .returning();

      if (!hold) {
        const [existing] = await trx
          .select({ status: creditHolds.status })
          .from(creditHolds)
          .where(eq(creditHolds.videoUuid, videoUuid))
          .limit(1);
        if (existing?.status === "SETTLED") return candidate.userId;
        if (!existing) throw new Error(`Hold not found for video: ${videoUuid}`);
        throw new Error(`Invalid hold status: ${existing.status}`);
      }

      const allocation = hold.packageAllocation as PackageAllocation[];

      for (const { packageId, credits } of allocation) {
        const [updatedPkg] = await trx
          .update(creditPackages)
          .set({
            frozenCredits: sql`${creditPackages.frozenCredits} - ${credits}`,
            updatedAt: new Date(),
          })
          .where(eq(creditPackages.id, packageId))
          .returning({
            remainingCredits: creditPackages.remainingCredits,
            frozenCredits: creditPackages.frozenCredits,
          });

        if (!updatedPkg) {
          throw new Error(`Credit package not found while settling: ${packageId}`);
        }
        if (updatedPkg.remainingCredits === 0 && updatedPkg.frozenCredits === 0) {
          await trx
            .update(creditPackages)
            .set({ status: CreditPackageStatus.DEPLETED, updatedAt: new Date() })
            .where(eq(creditPackages.id, packageId));
        }
      }

      const balance = await this.getBalanceInTx(trx, hold.userId);
      await trx.insert(creditTransactions).values({
        transNo: `TXN${Date.now()}${nanoid(6)}`,
        userId: hold.userId,
        transType: CreditTransType.VIDEO_CONSUME,
        credits: -hold.credits,
        balanceAfter: balance.availableCredits,
        videoUuid,
        holdId: hold.id,
        remark: `Video generation settled: ${videoUuid}`,
      });
      return hold.userId;
    });
    try {
      await generationRiskService.evaluateCreditVelocity(userId);
    } catch (error) {
      // Risk evaluation must not make a completed provider callback retry.
      console.error("[GenerationRisk] Post-settlement evaluation failed", error);
    }
  }

  /**
   * 释放积分（任务失败时调用）
   */
  async release(videoUuid: string): Promise<void> {
    await db.transaction(async (trx) => {
      const [hold] = await trx
        .select()
        .from(creditHolds)
        .where(eq(creditHolds.videoUuid, videoUuid))
        .limit(1);

      if (!hold) {
        return;
      }

      if (hold.status !== "HOLDING") {
        return;
      }

      await trx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`credit-ledger:${hold.userId}`}))`
      );

      const [claimed] = await trx
        .update(creditHolds)
        .set({
          status: "RELEASED",
          settledAt: new Date(),
        })
        .where(
          and(
            eq(creditHolds.videoUuid, videoUuid),
            eq(creditHolds.status, "HOLDING")
          )
        )
        .returning({ id: creditHolds.id });

      if (!claimed) return;

      const allocation = hold.packageAllocation as PackageAllocation[];

      for (const { packageId, credits } of allocation) {
        const [updatedPkg] = await trx
          .update(creditPackages)
          .set({
            remainingCredits: sql`${creditPackages.remainingCredits} + ${credits}`,
            frozenCredits: sql`${creditPackages.frozenCredits} - ${credits}`,
            status: CreditPackageStatus.ACTIVE,
            updatedAt: new Date(),
          })
          .where(eq(creditPackages.id, packageId))
          .returning({ id: creditPackages.id });
        if (!updatedPkg) {
          throw new Error(`Credit package not found while releasing: ${packageId}`);
        }
      }

      const balance = await this.getBalanceInTx(trx, hold.userId);
      await trx.insert(creditTransactions).values({
        transNo: `TXN${Date.now()}${nanoid(6)}`,
        userId: hold.userId,
        transType: CreditTransType.REFUND,
        credits: 0,
        balanceAfter: balance.availableCredits,
        videoUuid,
        holdId: hold.id,
        remark: `Video generation failed, credits released: ${videoUuid}`,
      });
    });
  }

  /**
   * Revoke credits belonging to one paid order. Already-spent credits become
   * account debt; unrelated credit packages are never confiscated.
   */
  async revokeOrderCredits(params: {
    paymentOrderId: number;
    userId: string;
    orderNo: string;
    targetCredits: number;
    amountRefunded?: number;
    paymentStatus:
      | "PARTIALLY_REFUNDED"
      | "REFUNDED"
      | "DISPUTE_LOST";
    remark: string;
  }): Promise<{ revoked: number; debt: number; targetCredits: number }> {
    if (!Number.isInteger(params.targetCredits) || params.targetCredits < 0) {
      throw new Error("Invalid payment reversal target");
    }

    return db.transaction(async (trx) => {
      await trx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`credit-ledger:${params.userId}`}))`
      );

      const [order] = await trx
        .select()
        .from(paymentOrders)
        .where(eq(paymentOrders.id, params.paymentOrderId))
        .limit(1);
      if (!order || order.userId !== params.userId || order.orderNo !== params.orderNo) {
        throw new Error(`Payment order mismatch: ${params.paymentOrderId}`);
      }
      const targetCredits = Math.max(
        order.creditsRevoked,
        Math.min(order.creditsGranted, params.targetCredits)
      );
      const credits = targetCredits - order.creditsRevoked;

      const [pkg] = await trx
        .select()
        .from(creditPackages)
        .where(
          and(
            eq(creditPackages.userId, params.userId),
            eq(creditPackages.orderNo, params.orderNo)
          )
        )
        .limit(1);
      if (!pkg) throw new Error(`Credit package not found for order: ${params.orderNo}`);

      const revoked = Math.min(credits, pkg.remainingCredits);
      const debt = credits - revoked;
      if (revoked > 0) {
        const remainingCredits = pkg.remainingCredits - revoked;
        await trx
          .update(creditPackages)
          .set({
            remainingCredits,
            status:
              remainingCredits === 0 && pkg.frozenCredits === 0
                ? CreditPackageStatus.DEPLETED
                : pkg.status,
            updatedAt: new Date(),
          })
          .where(eq(creditPackages.id, pkg.id));
      }

      if (debt > 0) {
        await trx
          .update(users)
          .set({
            creditDebt: sql`${users.creditDebt} + ${debt}`,
            billingStatus: "PAYMENT_REQUIRED",
            updatedAt: new Date(),
          })
          .where(eq(users.id, params.userId));
      }


      await trx
        .update(paymentOrders)
        .set({
          creditsRevoked: targetCredits,
          amountRefunded:
            params.amountRefunded === undefined
              ? order.amountRefunded
              : Math.max(order.amountRefunded, params.amountRefunded),
          status: params.paymentStatus,
          updatedAt: new Date(),
        })
        .where(eq(paymentOrders.id, order.id));

      if (credits > 0) {
        const balance = await this.getBalanceInTx(trx, params.userId);
        await trx.insert(creditTransactions).values({
          transNo: `TXN${Date.now()}${nanoid(6)}`,
          userId: params.userId,
          transType: CreditTransType.PAYMENT_REVERSAL,
          credits: -revoked,
          balanceAfter: balance.availableCredits,
          packageId: pkg.id,
          orderNo: params.orderNo,
          remark: `${params.remark}; revoked=${revoked}; debt=${debt}`,
        });
      }

      return { revoked, debt, targetCredits };
    });
  }

  /** Operator-only resolution after an externally verified repayment/review. */
  async resolvePaymentRestriction(params: {
    userId: string;
    adminUserId: string;
    debtReduction: number;
    restoreAccess: boolean;
    remark: string;
  }) {
    if (!Number.isInteger(params.debtReduction) || params.debtReduction < 0) {
      throw new Error("Invalid debt reduction");
    }
    return db.transaction(async (trx) => {
      await trx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`credit-ledger:${params.userId}`}))`
      );
      const [account] = await trx
        .select({ creditDebt: users.creditDebt, billingStatus: users.billingStatus })
        .from(users)
        .where(eq(users.id, params.userId))
        .limit(1);
      if (!account) throw new ApiError("User not found", 404);
      const creditDebt = Math.max(0, account.creditDebt - params.debtReduction);
      if (params.restoreAccess && creditDebt > 0) {
        throw new ApiError(
          "Outstanding credit debt must be zero before restoring access",
          409
        );
      }
      const billingStatus = params.restoreAccess ? "ACTIVE" : account.billingStatus;
      await trx
        .update(users)
        .set({ creditDebt, billingStatus, updatedAt: new Date() })
        .where(eq(users.id, params.userId));

      const balance = await this.getBalanceInTx(trx, params.userId);
      await trx.insert(creditTransactions).values({
        transNo: `TXN${Date.now()}${nanoid(6)}`,
        userId: params.userId,
        transType: CreditTransType.SYSTEM_ADJUST,
        credits: 0,
        balanceAfter: balance.availableCredits,
        remark: `Billing restriction adjusted by ${params.adminUserId}; debt ${account.creditDebt} -> ${creditDebt}; ${params.remark}`,
      });
      return { creditDebt, billingStatus };
    });
  }

  /**
   * 充值积分
   */
  async recharge(params: {
    userId: string;
    credits: number;
    orderNo: string;
    transType?: CreditTransType;
    expiryDays?: number | null;
    remark?: string;
    operatorUserId?: string;
  }): Promise<{ packageId: number }> {
    if (!Number.isInteger(params.credits) || params.credits <= 0) {
      throw new ApiError("Credits must be a positive integer", 400);
    }
    const transType = params.transType || CreditTransType.ORDER_PAY;
    const expiryDays = params.expiryDays === undefined
      ? CREDITS_CONFIG.expiration.purchaseDays
      : params.expiryDays;
    if (expiryDays !== null && (!Number.isInteger(expiryDays) || expiryDays <= 0)) {
      throw new ApiError("Expiry days must be a positive integer or null", 400);
    }
    const expiredAt = expiryDays === null
      ? null
      : new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    return db.transaction(async (trx) => {
      await trx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`credit-ledger:${params.userId}`}))`
      );
      const [existingPackage] = await trx
        .select({
          id: creditPackages.id,
          userId: creditPackages.userId,
          initialCredits: creditPackages.initialCredits,
          transType: creditPackages.transType,
        })
        .from(creditPackages)
        .where(eq(creditPackages.orderNo, params.orderNo))
        .limit(1);
      if (existingPackage) {
        if (
          existingPackage.userId !== params.userId ||
          existingPackage.initialCredits !== params.credits ||
          existingPackage.transType !== transType
        ) {
          throw new ApiError("Idempotency key conflicts with another credit grant", 409);
        }
        return { packageId: existingPackage.id };
      }

      const [pkgResult] = await trx
        .insert(creditPackages)
        .values({
          userId: params.userId,
          initialCredits: params.credits,
          remainingCredits: params.credits,
          frozenCredits: 0,
          transType,
          orderNo: params.orderNo,
          status: CreditPackageStatus.ACTIVE,
          expiredAt,
          updatedAt: new Date(),
        })
        .onConflictDoNothing({ target: creditPackages.orderNo })
        .returning({ id: creditPackages.id });

      if (!pkgResult) {
        const [concurrentPackage] = await trx
          .select({
            id: creditPackages.id,
            userId: creditPackages.userId,
            initialCredits: creditPackages.initialCredits,
            transType: creditPackages.transType,
          })
          .from(creditPackages)
          .where(eq(creditPackages.orderNo, params.orderNo))
          .limit(1);
        if (concurrentPackage) {
          if (
            concurrentPackage.userId !== params.userId ||
            concurrentPackage.initialCredits !== params.credits ||
            concurrentPackage.transType !== transType
          ) {
            throw new ApiError("Idempotency key conflicts with another credit grant", 409);
          }
          return { packageId: concurrentPackage.id };
        }
        throw new Error("Failed to create credit package");
      }

      const balance = await this.getBalanceInTx(trx, params.userId);
      await trx.insert(creditTransactions).values({
        transNo: `TXN${Date.now()}${nanoid(6)}`,
        userId: params.userId,
        transType,
        credits: params.credits,
        balanceAfter: balance.availableCredits,
        packageId: pkgResult.id,
        orderNo: params.orderNo,
        operatorUserId: params.operatorUserId,
        remark: params.remark || `Recharge: ${params.orderNo}`,
      });

      return { packageId: pkgResult.id };
    });
  }

  /**
   * 新用户赠送积分
   * - 幂等性：通过 transType=NEW_USER 检查防止重复发放
   * - 配置：在 src/config/pricing-user.ts 中统一管理
   */
  async grantNewUserCredits(userId: string): Promise<void> {
    const { registerGift } = CREDITS_CONFIG;

    if (!registerGift.enabled) {
      console.log(`[Credit] New user gift disabled, skipping for user: ${userId}`);
      return;
    }

    // 检查是否已经发放过（幂等性保证）
    const [existing] = await db
      .select()
      .from(creditPackages)
      .where(
        and(
          eq(creditPackages.userId, userId),
          eq(creditPackages.transType, CreditTransType.NEW_USER)
        )
      )
      .limit(1);

    if (existing) {
      console.log(`[Credit] User ${userId} already received welcome credits, skipping`);
      return;
    }

    // 发放新用户积分
    await this.recharge({
      userId,
      credits: registerGift.amount,
      orderNo: `NEW_USER_${userId}`,
      transType: CreditTransType.NEW_USER,
      expiryDays: registerGift.expireDays,
      remark: "New user welcome credits",
    });

    console.log(`[Credit] Granted ${registerGift.amount} welcome credits to new user: ${userId} (expires in ${registerGift.expireDays} days)`);
  }

  /**
   * 过期积分处理（定时任务调用）
   */
  async expireCredits(): Promise<number> {
    const now = new Date();

    const result = await db
      .update(creditPackages)
      .set({ status: CreditPackageStatus.EXPIRED })
      .where(
        and(
          eq(creditPackages.status, CreditPackageStatus.ACTIVE),
          lt(creditPackages.expiredAt, now),
          gt(creditPackages.remainingCredits, 0),
          eq(creditPackages.frozenCredits, 0)
        )
      )
      .returning({ id: creditPackages.id });

    return result.length;
  }

  /**
   * 获取积分历史
   */
  async getHistory(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      transType?: CreditTransType;
    }
  ) {
    const requestedLimit = options?.limit ?? 20;
    const requestedOffset = options?.offset ?? 0;
    const limit = Number.isSafeInteger(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 100)
      : 20;
    const offset = Number.isSafeInteger(requestedOffset)
      ? Math.min(Math.max(requestedOffset, 0), 10_000)
      : 0;

    const filters = [eq(creditTransactions.userId, userId)];
    if (options?.transType) {
      filters.push(eq(creditTransactions.transType, options.transType));
    }

    const records = await db
      .select()
      .from(creditTransactions)
      .where(and(...filters))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(creditTransactions)
      .where(and(...filters));

    const total = Number(countResult?.count ?? 0);

    return { records, total };
  }

  /**
   * 事务内获取余额（内部方法）
   */
  private async getBalanceInTx(
    trx: Pick<typeof db, "select">,
    userId: string
  ): Promise<CreditBalance> {
    const now = new Date();

    const packages = await trx
      .select()
      .from(creditPackages)
      .where(
        and(
          eq(creditPackages.userId, userId),
          eq(creditPackages.status, CreditPackageStatus.ACTIVE),
          or(
            isNull(creditPackages.expiredAt),
            gt(creditPackages.expiredAt, now)
          )
        )
      );

    let totalCredits = 0;
    let usedCredits = 0;
    let frozenCredits = 0;

    for (const pkg of packages) {
      totalCredits += pkg.initialCredits;
      usedCredits +=
        pkg.initialCredits - pkg.remainingCredits - pkg.frozenCredits;
      frozenCredits += pkg.frozenCredits;
    }

    return {
      totalCredits,
      usedCredits,
      frozenCredits,
      availableCredits: packages.reduce(
        (sum: number, p: CreditPackage) => sum + p.remainingCredits,
        0
      ),
      expiringSoon: 0,
    };
  }
}

export const creditService = new CreditService();
