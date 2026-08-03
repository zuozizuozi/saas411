import { db } from "@/db";
import { users, videos, creditTransactions, VideoStatus, CreditTransType } from "@/db/schema";
import { count, eq, and, sql, desc, gte } from "drizzle-orm";

export type TimeRange = "today" | "7d" | "30d" | "90d" | "all";

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

export interface TrendDataPoint {
  date: string;
  registeredUsers: number;
  firstVideoUsers: number;
  successfulFirstVideoUsers: number;
  firstVideoConversionRate: number;
  firstVideoSuccessRate: number;
}

export interface AnalyticsData {
  stats: Stats;
  funnel: FunnelData;
  trend: TrendDataPoint[];
}

class AnalyticsService {
  private getTimeFilter(range: TimeRange): Date | null {
    if (range === "all") return null;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (range) {
      case "today":
        return today;
      case "7d":
        return new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      case "30d":
        return new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      case "90d":
        return new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  }

  private buildTimeCondition(timeFilter: Date | null) {
    if (!timeFilter) return sql``;
    return sql`${users.createdAt} >= ${timeFilter.toISOString()}::timestamp`;
  }

  private buildVideoTimeCondition(timeFilter: Date | null) {
    if (!timeFilter) return sql``;
    return sql`${videos.createdAt} >= ${timeFilter.toISOString()}::timestamp`;
  }

  private buildTransactionTimeCondition(timeFilter: Date | null) {
    if (!timeFilter) return sql``;
    return sql`${creditTransactions.createdAt} >= ${timeFilter.toISOString()}::timestamp`;
  }

  async getStats(range: TimeRange): Promise<Stats> {
    const timeFilter = this.getTimeFilter(range);
    const timeCondition = this.buildTimeCondition(timeFilter);
    const videoTimeCondition = this.buildVideoTimeCondition(timeFilter);
    const transactionTimeCondition = this.buildTransactionTimeCondition(timeFilter);

    // The production client intentionally uses one Supavisor connection.
    // Execute commands sequentially so a page cannot pipeline multiple
    // parameterized queries onto that single connection.
    const totalUsersResult = await db
      .select({ count: count() })
      .from(users)
      .where(timeCondition);
    const totalOrdersResult = await db
      .select({ count: count() })
      .from(creditTransactions)
      .where(
        and(
          transactionTimeCondition,
          sql`${creditTransactions.transType} IN (${CreditTransType.ORDER_PAY}, ${CreditTransType.SUBSCRIPTION})`,
        ),
      );
    const paidOrders = await db
      .selectDistinct({ orderNo: creditTransactions.orderNo })
      .from(creditTransactions)
      .where(
        and(
          transactionTimeCondition,
          sql`${creditTransactions.transType} IN (${CreditTransType.ORDER_PAY}, ${CreditTransType.SUBSCRIPTION})`,
          sql`${creditTransactions.orderNo} IS NOT NULL`,
        ),
      );
    const totalVideosResult = await db
      .select({ count: count() })
      .from(videos)
      .where(and(videoTimeCondition, eq(videos.isDeleted, false)));
    const completedVideosResult = await db
      .select({ count: count() })
      .from(videos)
      .where(
        and(
          videoTimeCondition,
          eq(videos.status, VideoStatus.COMPLETED),
          eq(videos.isDeleted, false),
        ),
      );
    const failedVideosResult = await db
      .select({ count: count() })
      .from(videos)
      .where(
        and(
          videoTimeCondition,
          eq(videos.status, VideoStatus.FAILED),
          eq(videos.isDeleted, false),
        ),
      );
    const usersWithVideos = await db
      .selectDistinct({ userId: videos.userId })
      .from(videos)
      .where(and(videoTimeCondition, eq(videos.isDeleted, false)));
    const payingUsers = await db
      .selectDistinct({ userId: creditTransactions.userId })
      .from(creditTransactions)
      .where(
        and(
          transactionTimeCondition,
          sql`${creditTransactions.transType} IN (${CreditTransType.ORDER_PAY}, ${CreditTransType.SUBSCRIPTION})`,
        ),
      );

    const totalUsers = totalUsersResult[0]?.count || 0;
    const totalOrders = totalOrdersResult[0]?.count || 0;
    const paidOrderCount = paidOrders.length;
    const totalVideos = totalVideosResult[0]?.count || 0;
    const completedVideos = completedVideosResult[0]?.count || 0;
    const failedVideos = failedVideosResult[0]?.count || 0;
    const usersWithVideoCount = usersWithVideos.length;
    const payingUserCount = payingUsers.length;

    // Calculate rates
    const firstVideoConversionRate = totalUsers > 0 ? (usersWithVideoCount / totalUsers) * 100 : 0;
    const paymentConversionRate = totalUsers > 0 ? (payingUserCount / totalUsers) * 100 : 0;

    const totalFinishedVideos = completedVideos + failedVideos;
    const videoSuccessRate = totalFinishedVideos > 0 ? (completedVideos / totalFinishedVideos) * 100 : 0;

    // Users who haven't generated any video
    const usersWithoutVideos = totalUsers - usersWithVideoCount;

    return {
      totalUsers,
      totalOrders,
      paidOrders: paidOrderCount,
      totalVideos,
      firstVideoConversionRate: Math.round(firstVideoConversionRate * 10) / 10,
      paymentConversionRate: Math.round(paymentConversionRate * 10) / 10,
      videoSuccessRate: Math.round(videoSuccessRate * 10) / 10,
      usersWithoutVideos,
    };
  }

  async getFunnelData(range: TimeRange): Promise<FunnelData> {
    const timeFilter = this.getTimeFilter(range);
    const timeCondition = this.buildTimeCondition(timeFilter);
    const videoTimeCondition = this.buildVideoTimeCondition(timeFilter);

    // Get total registered users
    const totalUsersResult = await db
      .select({ count: count() })
      .from(users)
      .where(timeCondition);

    const registeredUsers = totalUsersResult[0]?.count || 0;

    // Get users with their first video
    // Using a subquery to find the first video for each user
    const firstVideosQuery = db
      .select({
        userId: videos.userId,
        status: videos.status,
        createdAt: videos.createdAt,
        rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${videos.userId} ORDER BY ${videos.createdAt} ASC)`.as("rn"),
      })
      .from(videos)
      .where(and(videoTimeCondition, eq(videos.isDeleted, false)))
      .as("first_videos");

    const firstVideosResult = await db
      .select({
        userId: firstVideosQuery.userId,
        status: firstVideosQuery.status,
      })
      .from(firstVideosQuery)
      .where(sql`${firstVideosQuery.rn} = 1`);

    const firstVideoUsers = firstVideosResult.length;
    const successfulFirstVideoUsers = firstVideosResult.filter((v) => v.status === VideoStatus.COMPLETED).length;

    return {
      registeredUsers,
      firstVideoUsers,
      successfulFirstVideoUsers,
    };
  }

  async getTrendData(range: TimeRange): Promise<TrendDataPoint[]> {
    const timeFilter = this.getTimeFilter(range);
    const startDate = timeFilter || new Date(0); // Epoch if no filter

    // Determine the number of days based on range
    const daysMap = { today: 1, "7d": 7, "30d": 30, "90d": 90, all: 365 };
    const days = daysMap[range] || 30;

    // Generate date series
    const dates: string[] = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      dates.push(date.toISOString().split("T")[0]);
    }

    // Get daily registrations
    const dailyRegistrations: Record<string, number> = {};
    const registrationData = await db
      .select({
        date: sql<string>`DATE(${users.createdAt})`.as("date"),
        count: count(),
      })
      .from(users)
      .where(gte(users.createdAt, startDate))
      .groupBy(sql`DATE(${users.createdAt})`)
      .orderBy(sql`DATE(${users.createdAt})`);

    registrationData.forEach((row) => {
      dailyRegistrations[row.date] = row.count;
    });

    // Get users with their first video by date
    const firstVideoData = await db
      .select({
        userId: videos.userId,
        createdAt: videos.createdAt,
        status: videos.status,
        rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${videos.userId} ORDER BY ${videos.createdAt} ASC)`.as("rn"),
      })
      .from(videos)
      .where(and(gte(videos.createdAt, startDate), eq(videos.isDeleted, false)));

    // Group first videos by date
    const dailyFirstVideos: Record<string, { total: number; successful: number }> = {};

    firstVideoData.forEach((row) => {
      if (row.rn === 1) {
        const date = new Date(row.createdAt).toISOString().split("T")[0];
        if (!dailyFirstVideos[date]) {
          dailyFirstVideos[date] = { total: 0, successful: 0 };
        }
        dailyFirstVideos[date].total++;
        if (row.status === VideoStatus.COMPLETED) {
          dailyFirstVideos[date].successful++;
        }
      }
    });

    // Build trend data
    const trend: TrendDataPoint[] = dates.map((date) => {
      const registeredUsers = dailyRegistrations[date] || 0;
      const firstVideoData = dailyFirstVideos[date] || { total: 0, successful: 0 };
      const firstVideoUsers = firstVideoData.total;
      const successfulFirstVideoUsers = firstVideoData.successful;

      const firstVideoConversionRate = registeredUsers > 0 ? (firstVideoUsers / registeredUsers) * 100 : 0;
      const firstVideoSuccessRate = firstVideoUsers > 0 ? (successfulFirstVideoUsers / firstVideoUsers) * 100 : 0;

      return {
        date,
        registeredUsers,
        firstVideoUsers,
        successfulFirstVideoUsers,
        firstVideoConversionRate: Math.round(firstVideoConversionRate * 10) / 10,
        firstVideoSuccessRate: Math.round(firstVideoSuccessRate * 10) / 10,
      };
    });

    return trend;
  }

  async getAnalyticsData(range: TimeRange): Promise<AnalyticsData> {
    const stats = await this.getStats(range);
    const funnel = await this.getFunnelData(range);
    const trend = await this.getTrendData(range);

    return {
      stats,
      funnel,
      trend,
    };
  }
}

export const analyticsService = new AnalyticsService();
