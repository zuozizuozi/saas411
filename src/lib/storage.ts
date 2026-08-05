import { s3mini } from "s3mini";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { lookup } from "node:dns/promises";
import {
  Agent,
  fetch as undiciFetch,
  type Dispatcher,
} from "undici";

export interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicDomain?: string;
}

const NON_PUBLIC_ADDRESSES = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  NON_PUBLIC_ADDRESSES.addSubnet(network, prefix, "ipv4");
}

for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
] as const) {
  NON_PUBLIC_ADDRESSES.addSubnet(network, prefix, "ipv6");
}

function normalizeIpOrHostname(value: string) {
  return value.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0] ?? value;
}

function isPrivateAddress(address: string) {
  const normalized = normalizeIpOrHostname(address);
  if (isIP(normalized) === 4) {
    return NON_PUBLIC_ADDRESSES.check(normalized, "ipv4");
  }
  if (isIP(normalized) !== 6) return false;
  // Mapped IPv4 addresses are unnecessary for provider downloads and can
  // otherwise obscure a private IPv4 target in an IPv6 literal.
  return (
    normalized.startsWith("::ffff:") ||
    NON_PUBLIC_ADDRESSES.check(normalized, "ipv6")
  );
}

export function assertSafeRemoteMediaUrl(sourceUrl: string) {
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:") {
    throw new Error("Provider media URL must use HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("Provider media URL cannot include credentials");
  }
  const hostname = normalizeIpOrHostname(url.hostname);
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    isPrivateAddress(hostname)
  ) {
    throw new Error("Provider media URL cannot target a private network");
  }
  return url;
}

interface ResolvedRemoteMediaTarget {
  url: URL;
  addresses: Array<{ address: string; family: number }>;
}

async function resolveSafeRemoteMediaTarget(
  sourceUrl: string
): Promise<ResolvedRemoteMediaTarget> {
  const url = assertSafeRemoteMediaUrl(sourceUrl);
  const hostname = normalizeIpOrHostname(url.hostname);
  const ipFamily = isIP(hostname);
  const addresses = ipFamily
    ? [{ address: hostname, family: ipFamily }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (
    addresses.length === 0 ||
    addresses.some(
      ({ address, family }) =>
        (family !== 4 && family !== 6) || isPrivateAddress(address)
    )
  ) {
    throw new Error("Provider media URL resolves to a private network");
  }
  return { url, addresses };
}

export async function assertSafeRemoteMediaUrlResolved(sourceUrl: string) {
  return (await resolveSafeRemoteMediaTarget(sourceUrl)).url;
}

export function detectSupportedImageType(bytes: Uint8Array) {
  const buffer = Buffer.from(bytes);
  const ascii = buffer.toString("ascii");
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg" as const;
  }
  if (
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png" as const;
  }
  if (ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a")) {
    return "image/gif" as const;
  }
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") {
    return "image/webp" as const;
  }
  return null;
}

type RemoteMediaResponse = Awaited<ReturnType<typeof undiciFetch>>;

interface PinnedRemoteMediaResponse {
  response: RemoteMediaResponse;
  dispatcher: Dispatcher;
}

export function createPinnedLookup(
  address: { address: string; family: number }
): LookupFunction {
  const pinnedAddress = {
    address: address.address,
    family: address.family as 4 | 6,
  };

  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [pinnedAddress]);
      return;
    }
    callback(null, pinnedAddress.address, pinnedAddress.family);
  };
}

function createPinnedDispatcher(
  url: URL,
  address: { address: string; family: number }
): Dispatcher {
  const hostname = normalizeIpOrHostname(url.hostname);
  const proxyUrl = process.env.HTTPS_PROXY?.trim() || process.env.HTTP_PROXY?.trim();
  if (proxyUrl) {
    // A forward proxy would resolve the hostname again and bypass the
    // validated address, reopening DNS-rebinding SSRF. Provider media must be
    // fetched directly through the pinned lookup below.
    throw new Error("Pinned provider media downloads cannot use an HTTP proxy");
  }
  return new Agent({
    connect: {
      ...(isIP(hostname) ? {} : { servername: hostname }),
      lookup: createPinnedLookup(address),
    },
    connections: 1,
  });
}

async function fetchPinnedRemoteMedia(
  target: ResolvedRemoteMediaTarget,
  signal: AbortSignal
): Promise<PinnedRemoteMediaResponse> {
  let lastError: unknown;
  for (const address of target.addresses) {
    const dispatcher = createPinnedDispatcher(target.url, address);
    try {
      const response = await undiciFetch(target.url, {
        redirect: "manual",
        signal,
        dispatcher,
      });
      return { response, dispatcher };
    } catch (error) {
      lastError = error;
      await dispatcher.close();
    }
  }
  throw lastError ?? new Error("Provider media URL has no reachable address");
}

async function releasePinnedResponse({
  response,
  dispatcher,
}: PinnedRemoteMediaResponse) {
  if (response.body && !response.bodyUsed) {
    await response.body.cancel().catch(() => undefined);
  }
  await dispatcher.close();
}

async function fetchSafeRemoteMedia(
  sourceUrl: string
): Promise<PinnedRemoteMediaResponse> {
  let currentTarget = await resolveSafeRemoteMediaTarget(sourceUrl);
  const signal = AbortSignal.timeout(120_000);
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const pinnedResponse = await fetchPinnedRemoteMedia(currentTarget, signal);
    const { response } = pinnedResponse;
    if (response.status < 300 || response.status >= 400) return pinnedResponse;
    const location = response.headers.get("location");
    if (!location) {
      await releasePinnedResponse(pinnedResponse);
      throw new Error("Provider media redirect is missing Location");
    }
    const nextUrl = new URL(location, currentTarget.url).toString();
    await releasePinnedResponse(pinnedResponse);
    currentTarget = await resolveSafeRemoteMediaTarget(nextUrl);
  }
  throw new Error("Provider media exceeded the redirect limit");
}

async function readResponseWithLimit(
  response: RemoteMediaResponse,
  maxBytes: number
) {
  if (!response.body) throw new Error("Provider video response has no body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("size limit exceeded");
        throw new Error(`Provider video exceeds the ${maxBytes} byte limit`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}

export class Storage {
  private client: s3mini;
  private signingClient: S3Client;
  private bucket: string;
  private endpointWithBucket: string;
  private publicDomain?: string;

  constructor(config: StorageConfig) {
    const endpoint = config.endpoint.replace(/\/$/, "");
    this.endpointWithBucket = `${endpoint}/${config.bucket}`;
    this.bucket = config.bucket;
    this.publicDomain = config.publicDomain?.replace(/\/$/, "");

    this.client = new s3mini({
      endpoint: this.endpointWithBucket,
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    });
    this.signingClient = new S3Client({
      endpoint,
      region: config.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async createPresignedUpload(params: {
    key: string;
    contentType: string;
    contentLength: number;
  }) {
    return getSignedUrl(
      this.signingClient,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        ContentType: params.contentType,
        ContentLength: params.contentLength,
      }),
      { expiresIn: 15 * 60 }
    );
  }

  async verifyObject(key: string): Promise<{ size: number; contentType: string }> {
    const result = await this.signingClient.send(
      new HeadObjectCommand({ Bucket: this.bucket, Key: key })
    );
    return {
      size: result.ContentLength ?? 0,
      contentType: result.ContentType ?? "application/octet-stream",
    };
  }

  async verifyImageObject(key: string, expectedContentType: string) {
    const result = await this.signingClient.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: "bytes=0-15",
      })
    );
    const bytes = Buffer.from((await result.Body?.transformToByteArray()) ?? []);
    const detected = detectSupportedImageType(bytes);
    if (!detected || detected !== expectedContentType) {
      throw new Error("Uploaded object content does not match its image type");
    }
    return detected;
  }

  async deleteObject(key: string) {
    await this.signingClient.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
  }

  /**
   * 上传文件到 R2/S3
   */
  async uploadFile(params: {
    key: string;
    body: Buffer;
    contentType?: string;
  }): Promise<{ url: string; key: string }> {
    const response = await this.client.putObject(
      params.key,
      params.body,
      params.contentType || "application/octet-stream"
    );

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }

    return { url: this.getPublicUrl(params.key), key: params.key };
  }

  /**
   * 从 URL 下载文件并上传到 R2/S3
   */
  async downloadAndUpload(params: {
    sourceUrl: string;
    key: string;
    contentType?: string;
  }): Promise<{ url: string; key: string }> {
    const configuredLimit = Number.parseInt(
      process.env.MAX_VIDEO_DOWNLOAD_BYTES ?? "262144000",
      10
    );
    const maxBytes = Number.isFinite(configuredLimit)
      ? configuredLimit
      : 262_144_000;
    const pinnedResponse = await fetchSafeRemoteMedia(params.sourceUrl);
    const { response } = pinnedResponse;
    try {
      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }

      const declaredLength = Number.parseInt(
        response.headers.get("content-length") ?? "0",
        10
      );
      if (declaredLength > maxBytes) {
        throw new Error(`Provider video exceeds the ${maxBytes} byte limit`);
      }

      const buffer = await readResponseWithLimit(response, maxBytes);
      const contentType =
        params.contentType ||
        response.headers.get("content-type") ||
        "video/mp4";

      return this.uploadFile({
        key: params.key,
        body: buffer,
        contentType,
      });
    } finally {
      await releasePinnedResponse(pinnedResponse);
    }
  }

  /**
   * 获取公开 URL
   */
  getPublicUrl(key: string): string {
    if (this.publicDomain) {
      return `${this.publicDomain}/${key}`;
    }
    return `${this.endpointWithBucket}/${key}`;
  }
}

// 单例工厂
let storageInstance: Storage | null = null;

export function getStorage(): Storage {
  if (!storageInstance) {
    const endpoint = process.env.STORAGE_ENDPOINT;
    const accessKeyId = process.env.STORAGE_ACCESS_KEY;
    const secretAccessKey = process.env.STORAGE_SECRET_KEY;
    const bucket = process.env.STORAGE_BUCKET;

    if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
      throw new Error(
        "Storage configuration missing. Required: STORAGE_ENDPOINT, STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY, STORAGE_BUCKET"
      );
    }

    storageInstance = new Storage({
      endpoint,
      region: process.env.STORAGE_REGION || "auto",
      accessKeyId,
      secretAccessKey,
      bucket,
      publicDomain: process.env.STORAGE_DOMAIN,
    });
  }
  return storageInstance;
}
