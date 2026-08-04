import { db } from "@/db";
import { users, videos, creditPackages, VideoStatus } from "@/db/schema";
import { count, eq, sql } from "drizzle-orm";
import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users as UsersIcon,
  Video,
  Coins,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock,
} from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  await connection();
  await requireAdmin();

  const startedAt = Date.now();
  const dashboardCutoff = new Date();
  dashboardCutoff.setDate(dashboardCutoff.getDate() - 7);
  const dashboardCutoffIso = dashboardCutoff.toISOString();

  let userStats: { total: number; recent: number } | undefined;
  let totalCreditPackages = 0;
  let videoStats:
    | {
      total: number;
      completed: number;
      failed: number;
      processing: number;
      recent: number;
    }
    | undefined;

  try {
    // Keep the queries simple and sequential for the single-connection
    // Supavisor client used by each serverless instance.
    [userStats] = await db
      .select({
        total: count(),
        recent: sql<number>`count(*) filter (where ${users.createdAt} >= ${dashboardCutoffIso}::timestamp)::int`,
      })
      .from(users);

    const [creditStats] = await db
      .select({ total: count() })
      .from(creditPackages);
    totalCreditPackages = Number(creditStats?.total ?? 0);

    [videoStats] = await db
      .select({
        total: count(),
        completed: sql<number>`count(*) filter (where ${videos.status} = ${VideoStatus.COMPLETED})::int`,
        failed: sql<number>`count(*) filter (where ${videos.status} = ${VideoStatus.FAILED})::int`,
        processing: sql<number>`count(*) filter (where ${videos.status} in (${VideoStatus.PENDING}, ${VideoStatus.GENERATING}, ${VideoStatus.UPLOADING}))::int`,
        recent: sql<number>`count(*) filter (where ${videos.createdAt} >= ${dashboardCutoffIso}::timestamp)::int`,
      })
      .from(videos)
      .where(eq(videos.isDeleted, false));
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      message: "Admin dashboard statistics query failed",
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    }));
    throw error;
  }

  const totalUsers = Number(userStats?.total ?? 0);
  const totalVideos = Number(videoStats?.total ?? 0);
  const completedVideos = Number(videoStats?.completed ?? 0);
  const failedVideos = Number(videoStats?.failed ?? 0);
  const processingVideos = Number(videoStats?.processing ?? 0);
  const recentUsers = Number(userStats?.recent ?? 0);
  const recentVideos = Number(videoStats?.recent ?? 0);

  // 计算视频成功率
  const totalFinishedVideos = completedVideos + failedVideos;
  const successRate = totalFinishedVideos > 0
    ? (completedVideos / totalFinishedVideos) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          管理后台概览
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              总用户数
            </CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              最近7天: +{recentUsers}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              视频生成总数
            </CardTitle>
            <Video className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalVideos}</div>
            <p className="text-xs text-muted-foreground">
              最近7天: +{recentVideos}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              成功率
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {completedVideos} / {totalFinishedVideos} 完成
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              积分包总数
            </CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalCreditPackages}
            </div>
            <p className="text-xs text-muted-foreground">
              所有用户
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Video Status Breakdown */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              已完成
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedVideos}</div>
            <p className="text-xs text-muted-foreground">
              {totalVideos > 0 ? ((completedVideos / totalVideos) * 100).toFixed(1) : 0}% 的总数
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              失败
            </CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedVideos}</div>
            <p className="text-xs text-muted-foreground">
              {totalVideos > 0 ? ((failedVideos / totalVideos) * 100).toFixed(1) : 0}% 的总数
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              处理中
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{processingVideos}</div>
            <p className="text-xs text-muted-foreground">
              {totalVideos > 0 ? ((processingVideos / totalVideos) * 100).toFixed(1) : 0}% 的总数
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
          <CardDescription>
            常用管理功能
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <a
            href="/admin/users"
            className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted"
          >
            <UsersIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium">用户管理</div>
              <div className="text-sm text-muted-foreground">查看和管理用户</div>
            </div>
          </a>

          <a
            href="/admin/analytics"
            className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted"
          >
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium">数据分析</div>
              <div className="text-sm text-muted-foreground">查看详细统计</div>
            </div>
          </a>

          <a
            href="/admin/settings"
            className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted"
          >
            <Coins className="h-5 w-5 text-muted-foreground" />
            <div>
              <div className="font-medium">配置说明</div>
              <div className="text-sm text-muted-foreground">查看积分与权限说明</div>
            </div>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
