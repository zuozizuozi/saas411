import { and, count, eq, gte, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import {
  CreditTransType,
  creditTransactions,
  users,
  videos,
  VideoStatus,
} from "@/db/schema";
import { toPercentage } from "./analytics-metrics";

export type TimeRange = "today" | "7d" | "30d" | "90d" | "all";

const TIME_RANGES: readonly TimeRange[] = ["today", "7d", "30d", "90d", "all"];

export function normalizeTimeRange(value: string | undefined): TimeRange {
  return TIME_RANGES.includes(value as TimeRange) ? (value as TimeRange) : "30d";
}

export function getTimeRangeStart(
  range: TimeRange,
  now = new Date(),
): Date | null {
  if (range === "all") return null;

  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const daysBack = { today: 0, "7d": 6, "30d": 29, "90d": 89 }[range];
  today.setUTCDate(today.getUTCDate() - daysBack);
  return today;
}

export interface Stats {
  totalUsers: number;
  totalOrders: number;
  paidOrders: number;
  totalVideos: number;
  firstVideoConversionRate: number;
  paymentConversionRate: number;
  videoSuccessRate: number;
  usersWithoutVideos: number;
}

export interface FunnelData {
  registeredUsers: number;
  firstVideoUsers: number;
  successfulFirstVideoUsers: number;
}

export interface TrendDataPoint extends FunnelData {
  date: string;
  firstVideoConversionRate: number;
  firstVideoSuccessRate: number;
}

export interface AnalyticsData {
  stats: Stats;
  funnel: FunnelData;
  trend: TrendDataPoint[];
}

function dateKey(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function buildDateSeries(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const cursor = new Date(start);
  cursor.setUTCHours(0, 0, 0, 0);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

class AnalyticsService {
  private buildUserTimeCondition(timeFilter: Date | null): SQL | undefined {
    return timeFilter ? gte(users.createdAt, timeFilter) : undefined;
  }

  private buildVideoTimeCondition(timeFilter: Date | null): SQL | undefined {
    return timeFilter ? gte(videos.createdAt, timeFilter) : undefined;
  }

  private buildTransactionTimeCondition(timeFilter: Date | null): SQL | undefined {
    return timeFilter ? gte(creditTransactions.createdAt, timeFilter) : undefined;
  }

  private firstVideosQuery() {
    return db
      .select({
        userId: videos.userId,
        status: videos.status,
        rn: sql<number>`row_number() over (partition by ${videos.userId} order by ${videos.createdAt}, ${videos.id})`.as(
          "rn",
        ),
      })
      .from(videos)
      .where(eq(videos.isDeleted, false))
      .as("first_videos");
  }

  async getStats(range: TimeRange): Promise<Stats> {
    const timeFilter = getTimeRangeStart(range);
    const userTimeCondition = this.buildUserTimeCondition(timeFilter);
    const videoTimeCondition = this.buildVideoTimeCondition(timeFilter);
    const transactionTimeCondition =
      this.buildTransactionTimeCondition(timeFilter);
    const paidTransactionCondition = sql`${creditTransactions.transType} in (${CreditTransType.ORDER_PAY}, ${CreditTransType.SUBSCRIPTION})`;

    // Supavisor is configured with one connection, so these queries are
    // intentionally sequential to avoid pipelining commands on that connection.
    const totalUsersResult = await db
      .select({ count: count() })
      .from(users)
      .where(userTimeCondition);
    const totalOrdersResult = await db
      .select({ count: count() })
      .from(creditTransactions)
      .where(and(transactionTimeCondition, paidTransactionCondition));
    const paidOrders = await db
      .selectDistinct({ orderNo: creditTransactions.orderNo })
      .from(creditTransactions)
      .where(
        and(
          transactionTimeCondition,
          paidTransactionCondition,
          sql`${creditTransactions.orderNo} is not null`,
        ),
      );
    const totalVideosResult = await db
      .select({ count: count() })
      .from(videos)
      .where(and(videoTimeCondition, eq(videos.isDeleted, false)));
    const finishedVideosResult = await db
      .select({
        completed: sql<number>`count(*) filter (where ${videos.status} = ${VideoStatus.COMPLETED})::int`,
        failed: sql<number>`count(*) filter (where ${videos.status} = ${VideoStatus.FAILED})::int`,
      })
      .from(videos)
      .where(and(videoTimeCondition, eq(videos.isDeleted, false)));
    const usersWithVideos = await db
      .selectDistinct({ userId: users.id })
      .from(users)
      .innerJoin(
        videos,
        and(eq(videos.userId, users.id), eq(videos.isDeleted, false)),
      )
      .where(userTimeCondition);
    const payingUsers = await db
      .selectDistinct({ userId: users.id })
      .from(users)
      .innerJoin(
        creditTransactions,
        eq(creditTransactions.userId, users.id),
      )
      .where(and(userTimeCondition, paidTransactionCondition));

    const totalUsers = Number(totalUsersResult[0]?.count ?? 0);
    const totalOrders = Number(totalOrdersResult[0]?.count ?? 0);
    const totalVideos = Number(totalVideosResult[0]?.count ?? 0);
    const completedVideos = Number(finishedVideosResult[0]?.completed ?? 0);
    const failedVideos = Number(finishedVideosResult[0]?.failed ?? 0);
    const usersWithVideoCount = usersWithVideos.length;

    return {
      totalUsers,
      totalOrders,
      paidOrders: paidOrders.length,
      totalVideos,
      firstVideoConversionRate: toPercentage(usersWithVideoCount, totalUsers),
      paymentConversionRate: toPercentage(payingUsers.length, totalUsers),
      videoSuccessRate: toPercentage(
        completedVideos,
        completedVideos + failedVideos,
      ),
      usersWithoutVideos: Math.max(0, totalUsers - usersWithVideoCount),
    };
  }

  async getFunnelData(range: TimeRange): Promise<FunnelData> {
    const userTimeCondition = this.buildUserTimeCondition(
      getTimeRangeStart(range),
    );
    const firstVideos = this.firstVideosQuery();

    const totalUsersResult = await db
      .select({ count: count() })
      .from(users)
      .where(userTimeCondition);
    const firstVideoRows = await db
      .select({ status: firstVideos.status })
      .from(users)
      .innerJoin(firstVideos, eq(firstVideos.userId, users.id))
      .where(and(userTimeCondition, sql`${firstVideos.rn} = 1`));

    return {
      registeredUsers: Number(totalUsersResult[0]?.count ?? 0),
      firstVideoUsers: firstVideoRows.length,
      successfulFirstVideoUsers: firstVideoRows.filter(
        (video) => video.status === VideoStatus.COMPLETED,
      ).length,
    };
  }

  async getTrendData(range: TimeRange): Promise<TrendDataPoint[]> {
    const timeFilter = getTimeRangeStart(range);
    const userTimeCondition = this.buildUserTimeCondition(timeFilter);
    const firstVideos = this.firstVideosQuery();

    const registrationData = await db
      .select({
        date: sql<string>`date(${users.createdAt})`.as("date"),
        count: count(),
      })
      .from(users)
      .where(userTimeCondition)
      .groupBy(sql`date(${users.createdAt})`)
      .orderBy(sql`date(${users.createdAt})`);
    const firstVideoRows = await db
      .select({
        registeredAt: users.createdAt,
        status: firstVideos.status,
      })
      .from(users)
      .innerJoin(firstVideos, eq(firstVideos.userId, users.id))
      .where(and(userTimeCondition, sql`${firstVideos.rn} = 1`));

    if (range === "all" && registrationData.length === 0) return [];

    const today = getTimeRangeStart("today") as Date;
    const startDate =
      timeFilter ?? new Date(`${dateKey(registrationData[0].date)}T00:00:00.000Z`);
    const dates = buildDateSeries(startDate, today);
    const dailyRegistrations = new Map(
      registrationData.map((row) => [dateKey(row.date), Number(row.count)]),
    );
    const dailyFirstVideos = new Map<
      string,
      { total: number; successful: number }
    >();

    for (const row of firstVideoRows) {
      const key = dateKey(row.registeredAt);
      const counts = dailyFirstVideos.get(key) ?? { total: 0, successful: 0 };
      counts.total += 1;
      if (row.status === VideoStatus.COMPLETED) counts.successful += 1;
      dailyFirstVideos.set(key, counts);
    }

    return dates.map((date) => {
      const registeredUsers = dailyRegistrations.get(date) ?? 0;
      const firstVideoCounts = dailyFirstVideos.get(date) ?? {
        total: 0,
        successful: 0,
      };

      return {
        date,
        registeredUsers,
        firstVideoUsers: firstVideoCounts.total,
        successfulFirstVideoUsers: firstVideoCounts.successful,
        firstVideoConversionRate: toPercentage(
          firstVideoCounts.total,
          registeredUsers,
        ),
        firstVideoSuccessRate: toPercentage(
          firstVideoCounts.successful,
          firstVideoCounts.total,
        ),
      };
    });
  }

  async getAnalyticsData(range: TimeRange): Promise<AnalyticsData> {
    const stats = await this.getStats(range);
    const funnel = await this.getFunnelData(range);
    const trend = await this.getTrendData(range);
    return { stats, funnel, trend };
  }
}

export const analyticsService = new AnalyticsService();
