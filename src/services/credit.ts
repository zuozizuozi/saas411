import {
  CreditPackageStatus,
  CreditTransType,
  creditHolds,
  creditPackages,
  creditTransactions,
  customers,
  db,
  type CreditPackage,
} from "@/db";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { nanoid } from "nanoid";
import { CREDITS_CONFIG } from "../config/credits";

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

        await trx
          .update(creditPackages)
          .set({
            remainingCredits: pkg.remainingCredits - toFreeze,
            frozenCredits: pkg.frozenCredits + toFreeze,
          })
          .where(eq(creditPackages.id, pkg.id));

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
        await trx
          .update(creditPackages)
          .set({
            remainingCredits: state.remaining,
            frozenCredits: state.frozen,
          })
          .where(eq(creditPackages.id, packageId));
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
    await db.transaction(async (trx) => {
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
        if (existing?.status === "SETTLED") return;
        if (!existing) throw new Error(`Hold not found for video: ${videoUuid}`);
        throw new Error(`Invalid hold status: ${existing.status}`);
      }

      const allocation = hold.packageAllocation as PackageAllocation[];

      for (const { packageId, credits } of allocation) {
        const [pkg] = await trx
          .select()
          .from(creditPackages)
          .where(eq(creditPackages.id, packageId))
          .limit(1);

        if (pkg) {
          await trx
            .update(creditPackages)
            .set({
              frozenCredits: pkg.frozenCredits - credits,
            })
            .where(eq(creditPackages.id, packageId));

          const [updatedPkg] = await trx
            .select()
            .from(creditPackages)
            .where(eq(creditPackages.id, packageId))
            .limit(1);

          if (
            updatedPkg &&
            updatedPkg.remainingCredits === 0 &&
            updatedPkg.frozenCredits === 0
          ) {
            await trx
              .update(creditPackages)
              .set({ status: CreditPackageStatus.DEPLETED })
              .where(eq(creditPackages.id, packageId));
          }
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
    });
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
        const [pkg] = await trx
          .select()
          .from(creditPackages)
          .where(eq(creditPackages.id, packageId))
          .limit(1);

        if (pkg) {
          await trx
            .update(creditPackages)
            .set({
              remainingCredits: pkg.remainingCredits + credits,
              frozenCredits: pkg.frozenCredits - credits,
            })
            .where(eq(creditPackages.id, packageId));
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
   * 充值积分
   */
  async recharge(params: {
    userId: string;
    credits: number;
    orderNo: string;
    transType?: CreditTransType;
    expiryDays?: number;
    remark?: string;
  }): Promise<{ packageId: number }> {
    const transType = params.transType || CreditTransType.ORDER_PAY;
    const expiryDays =
      params.expiryDays ?? CREDITS_CONFIG.expiration.purchaseDays;
    const expiredAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    return db.transaction(async (trx) => {
      const [existingPackage] = await trx
        .select({ id: creditPackages.id })
        .from(creditPackages)
        .where(eq(creditPackages.orderNo, params.orderNo))
        .limit(1);
      if (existingPackage) {
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
          .select({ id: creditPackages.id })
          .from(creditPackages)
          .where(eq(creditPackages.orderNo, params.orderNo))
          .limit(1);
        if (concurrentPackage) return { packageId: concurrentPackage.id };
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
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

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
