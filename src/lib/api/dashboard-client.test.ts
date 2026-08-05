import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "./dashboard-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dashboard video client", () => {
  it("sends status, model, sort order, and cursor to the list endpoint", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        success: true,
        data: { videos: [], nextCursor: null, hasMore: false },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiClient.getVideos({
      limit: 20,
      cursor: "vid_cursor",
      status: "completed",
      model: "veo-3.1",
      sortBy: "oldest",
    });

    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("status=completed");
    expect(String(url)).toContain("model=veo-3.1");
    expect(String(url)).toContain("sortBy=oldest");
    expect(String(url)).toContain("cursor=vid_cursor");
  });
});
