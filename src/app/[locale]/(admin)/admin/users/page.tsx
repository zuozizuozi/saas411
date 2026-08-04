import Link from "next/link";

import { db } from "@/db";
import {
  CreditPackageStatus,
  users,
  creditPackages,
  videos,
} from "@/db/schema";
import { sql } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Shield,
} from "@/components/ui/icons";
import { UserVideosButton } from "@/components/admin/users/user-videos-button";
import { AdminRoleButton } from "@/components/admin/users/admin-role-button";
import { requireAdmin } from "@/lib/auth/admin";

interface UsersPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
  }>;
}

type UserWithStats = typeof users.$inferSelect & {
  videoCount: number;
  packageCount: number;
  totalCredits: number;
};

export default async function UsersPage({ searchParams }: UsersPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const page = Math.min(10_000, Math.max(1, Number(params.page) || 1));
  const search = (params.search || "").trim().slice(0, 100);
  const limit = 20;
  const offset = (page - 1) * limit;
  const searchPattern = `%${search}%`;

  // 获取用户总数（带搜索）
  const [totalUsersRow] = await db.execute<{ count: number }>(sql`
    select count(*)::int as count
    from ${users} as u
    where ${search} = ''
      or u.email ilike ${searchPattern}
      or coalesce(u.name, '') ilike ${searchPattern}
  `);
  const totalUsers = Number(totalUsersRow?.count ?? 0);
  const totalPages = Math.ceil(totalUsers / limit);

  // Qualify the outer user ID explicitly. The previous correlated subqueries
  // compiled to `videos.user_id = videos.id` and failed with text = integer.
  const usersWithStats = await db.execute<UserWithStats>(sql`
    select
      u.id,
      u.name,
      u.email,
      u."emailVerified",
      u.image,
      u."createdAt",
      u."updatedAt",
      u."isAdmin",
      (select count(*)::int from ${videos} as v where v.user_id = u.id and v.is_deleted = false) as "videoCount",
      (select count(*)::int from ${creditPackages} as cp where cp.user_id = u.id) as "packageCount",
      (
        select coalesce(sum(cp.remaining_credits), 0)::int
        from ${creditPackages} as cp
        where cp.user_id = u.id
          and cp.status = ${CreditPackageStatus.ACTIVE}
          and (cp.expired_at is null or cp.expired_at > now())
      ) as "totalCredits"
    from ${users} as u
    where ${search} = ''
      or u.email ilike ${searchPattern}
      or coalesce(u.name, '') ilike ${searchPattern}
    order by u."createdAt" desc
    limit ${limit}
    offset ${offset}
  `);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">用户管理</h1>
          <p className="text-muted-foreground">
            共 {totalUsers} 位用户
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <form className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="search"
                placeholder="搜索邮箱或用户名..."
                defaultValue={search}
                className="pl-10"
              />
            </div>
            <Button type="submit">搜索</Button>
          </form>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>邮箱</TableHead>
                  <TableHead>视频数</TableHead>
                  <TableHead>积分包</TableHead>
                  <TableHead>可用积分</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>注册时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersWithStats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  usersWithStats.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          {user.image ? (
                            <img
                              src={user.image}
                              alt={user.name || "User"}
                              className="h-8 w-8 rounded-full"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                              <span className="text-xs">
                                {(user.name || user.email || "?").charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <span className="max-w-[200px] truncate">
                            {user.name || "未设置"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {user.email}
                      </TableCell>
                      <TableCell>{user.videoCount}</TableCell>
                      <TableCell>{user.packageCount}</TableCell>
                      <TableCell>
                        <span className="font-medium">{user.totalCredits}</span>
                      </TableCell>
                      <TableCell>
                        {user.isAdmin ? (
                          <Badge variant="default" className="gap-1">
                            <Shield className="h-3 w-3" />
                            管理员
                          </Badge>
                        ) : (
                          <Badge variant="outline">普通用户</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString("zh-CN")}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <UserVideosButton
                            userId={user.id}
                            userName={user.name}
                            userEmail={user.email}
                            videoCount={user.videoCount}
                          />
                          <AdminRoleButton
                            userId={user.id}
                            userEmail={user.email}
                            isAdmin={user.isAdmin}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                第 {page} 页，共 {totalPages} 页
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <Link
                    prefetch={false}
                    aria-disabled={page <= 1}
                    className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                    href={`?page=${page - 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    上一页
                  </Link>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <Link
                    prefetch={false}
                    aria-disabled={page >= totalPages}
                    className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
                    href={`?page=${page + 1}${search ? `&search=${encodeURIComponent(search)}` : ""}`}
                  >
                    下一页
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
