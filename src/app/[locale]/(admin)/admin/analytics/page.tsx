import {
  analyticsService,
  normalizeTimeRange,
  type TimeRange,
} from "@/lib/admin/analytics";
import { AnalyticsHeader } from "@/components/admin/analytics/analytics-header";
import { StatsCards } from "@/components/admin/analytics/stats-cards";
import { FunnelChart } from "@/components/admin/analytics/funnel-chart";
import { TrendChart } from "@/components/admin/analytics/trend-chart";
import { requireAdmin } from "@/lib/auth/admin";

interface AdminAnalyticsPageProps {
  searchParams: Promise<{
    range?: TimeRange;
  }>;
}

export default async function AdminAnalyticsPage({ searchParams }: AdminAnalyticsPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const range = normalizeTimeRange(params.range);

  // Fetch all analytics data in parallel
  const analyticsData = await analyticsService.getAnalyticsData(range);

  return (
    <div className="space-y-6">
      <AnalyticsHeader />

      {/* Stats Cards */}
      <StatsCards stats={analyticsData.stats} />

      {/* Charts Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <FunnelChart data={analyticsData.funnel} />
        <TrendChart data={analyticsData.trend} />
      </div>
    </div>
  );
}
