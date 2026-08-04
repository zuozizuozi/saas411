import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/error";

const { requireAdmin, getUserVideos, getUserVideoStats } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getUserVideos: vi.fn(),
  getUserVideoStats: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({ requireAdmin }));
vi.mock("@/lib/admin/user-videos", () => ({
  getUserVideos,
  getUserVideoStats,
}));

import { GET } from "./route";

describe("admin user videos route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdmin.mockResolvedValue({ id: "admin-1" });
  });

  it("rejects unauthenticated requests before querying user data", async () => {
    requireAdmin.mockRejectedValueOnce(new ApiError("Unauthorized", 401));
    const response = await GET(
      new Request("https://example.com/api/v1/admin/user-videos?userId=user-1") as never
    );
    expect(response.status).toBe(401);
    expect(getUserVideos).not.toHaveBeenCalled();
    expect(getUserVideoStats).not.toHaveBeenCalled();
  });

  it("rejects non-admin users before querying user data", async () => {
    requireAdmin.mockRejectedValueOnce(new ApiError("Forbidden", 403));
    const response = await GET(
      new Request("https://example.com/api/v1/admin/user-videos?userId=user-1") as never
    );
    expect(response.status).toBe(403);
    expect(getUserVideos).not.toHaveBeenCalled();
  });

  it.each(["0", "-1", "1.5", "not-a-number", "10001"])(
    "rejects invalid page %s before querying user data",
    async (page) => {
      const response = await GET(
        new Request(
          `https://example.com/api/v1/admin/user-videos?userId=user-1&page=${page}`,
        ) as never,
      );

      expect(response.status).toBe(400);
      expect(getUserVideos).not.toHaveBeenCalled();
      expect(getUserVideoStats).not.toHaveBeenCalled();
    },
  );

  it("rejects an unknown video status before querying user data", async () => {
    const response = await GET(
      new Request(
        "https://example.com/api/v1/admin/user-videos?userId=user-1&status=UNKNOWN",
      ) as never,
    );

    expect(response.status).toBe(400);
    expect(getUserVideos).not.toHaveBeenCalled();
    expect(getUserVideoStats).not.toHaveBeenCalled();
  });
});
