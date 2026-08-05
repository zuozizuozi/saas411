import { beforeEach, describe, expect, it, vi } from "vitest";

const undiciMocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  agentOptions: vi.fn(),
}));

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (hostname: string) =>
    hostname === "private.example.com"
      ? [{ address: "10.0.0.5", family: 4 }]
      : [{ address: "93.184.216.34", family: 4 }]
  ),
}));

vi.mock("undici", () => ({
  Agent: class MockAgent {
    constructor(options: unknown) {
      undiciMocks.agentOptions(options);
    }

    async close() {}
  },
  fetch: undiciMocks.fetch,
}));

import {
  Storage,
  assertSafeRemoteMediaUrl,
  assertSafeRemoteMediaUrlResolved,
  createPinnedLookup,
  detectSupportedImageType,
} from "./storage";

beforeEach(() => {
  undiciMocks.fetch.mockReset();
  undiciMocks.agentOptions.mockReset();
});

describe("assertSafeRemoteMediaUrl", () => {
  it("allows a public HTTPS URL", () => {
    expect(assertSafeRemoteMediaUrl("https://cdn.example.com/video.mp4").hostname).toBe(
      "cdn.example.com"
    );
  });

  it.each([
    "http://cdn.example.com/video.mp4",
    "https://localhost/video.mp4",
    "https://127.0.0.1/video.mp4",
    "https://10.0.0.1/video.mp4",
    "https://192.168.1.1/video.mp4",
    "https://100.64.0.1/video.mp4",
    "https://[::1]/video.mp4",
    "https://[fd00::1]/video.mp4",
    "https://user:password@cdn.example.com/video.mp4",
  ])("rejects unsafe provider URL %s", (url) => {
    expect(() => assertSafeRemoteMediaUrl(url)).toThrow();
  });
});

describe("assertSafeRemoteMediaUrlResolved", () => {
  it("rejects a public-looking hostname that resolves to a private address", async () => {
    await expect(
      assertSafeRemoteMediaUrlResolved("https://private.example.com/video.mp4")
    ).rejects.toThrow(/private network/i);
  });

  it("allows a hostname when every resolved address is public", async () => {
    await expect(
      assertSafeRemoteMediaUrlResolved("https://cdn.example.com/video.mp4")
    ).resolves.toMatchObject({ hostname: "cdn.example.com" });
  });
});

describe("pinned provider downloads", () => {
  it("returns only the previously validated address from DNS lookup", async () => {
    const pinnedLookup = createPinnedLookup({
      address: "93.184.216.34",
      family: 4,
    });

    await expect(
      new Promise<{ address: string; family?: number }>((resolve, reject) => {
        pinnedLookup("changed.example.com", { all: false }, (error, address, family) => {
          if (error) {
            reject(error);
            return;
          }
          resolve({ address: String(address), family });
        });
      })
    ).resolves.toEqual({ address: "93.184.216.34", family: 4 });
  });

  it("keeps the provider hostname in the HTTP request while pinning the socket", async () => {
    undiciMocks.fetch.mockResolvedValueOnce(
      new Response(Buffer.from("video"), {
        status: 200,
        headers: { "content-type": "video/mp4", "content-length": "5" },
      })
    );
    const storage = new Storage({
      endpoint: "https://storage.example.com",
      region: "auto",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      bucket: "test-bucket",
      publicDomain: "https://media.example.com",
    });
    vi.spyOn(storage, "uploadFile").mockResolvedValue({
      url: "https://media.example.com/videos/test.mp4",
      key: "videos/test.mp4",
    });

    await storage.downloadAndUpload({
      sourceUrl: "https://cdn.example.com/video.mp4",
      key: "videos/test.mp4",
    });

    const requestUrl = undiciMocks.fetch.mock.calls[0]?.[0] as URL;
    expect(requestUrl.hostname).toBe("cdn.example.com");
    expect(undiciMocks.agentOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        connect: expect.objectContaining({
          servername: "cdn.example.com",
          lookup: expect.any(Function),
        }),
      })
    );
  });
});

describe("detectSupportedImageType", () => {
  it("detects supported image magic bytes", () => {
    expect(detectSupportedImageType(Uint8Array.from([0xff, 0xd8, 0xff]))).toBe(
      "image/jpeg"
    );
    expect(
      detectSupportedImageType(
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ).toBe("image/png");
  });

  it("rejects HTML disguised as an image", () => {
    expect(detectSupportedImageType(Buffer.from("<script>alert(1)</script>"))).toBeNull();
  });
});
