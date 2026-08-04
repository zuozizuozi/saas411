/**
 * ============================================
 * 管理员权限检查
 * ============================================
 *
 * 检查用户是否具有管理员权限
 * 用于保护管理后台页面
 *
 * 管理员身份始终从数据库读取，确保授予和撤销能够立即生效。
 */

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasAdminRole } from "./admin-role";
import type { Locale } from "@/config/i18n-config";

/**
 * 要求用户具有管理员权限
 *
 * @param redirectTo - 未授权时重定向的路径
 * @returns 当前用户信息
 * @throws 如果未登录或不是管理员，则重定向
 */
const getAdminUser = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  if (!(await hasAdminRole(session.user.id))) {
    return false;
  }

  return { ...session.user, isAdmin: true };
});

export async function requireAdmin(redirectTo?: string) {
  const adminUser = await getAdminUser();
  if (adminUser === null) {
    redirect(redirectTo || "/login?from=/admin");
  }
  if (adminUser === false) {
    redirect("/");
  }
  return adminUser;
}

/**
 * 检查用户是否是管理员
 *
 * @returns 是否是管理员
 */
export async function isAdmin(): Promise<boolean> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) return false;
  return hasAdminRole(session.user.id);
}

/**
 * 为给定路径生成本地化的登录重定向路径
 */
export function getLoginRedirect(locale: Locale = "en"): string {
  return `/${locale}/login`;
}
