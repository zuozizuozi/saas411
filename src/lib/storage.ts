import { s3mini } from "s3mini";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicDomain?: string;
}

const PRIVATE_IPV4_RANGES = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^0\./,
];

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase().split("%")[0] ?? address.toLowerCase();
  if (isIP(normalized) === 4) {
    return PRIVATE_IPV4_RANGES.some((range) => range.test(normalized));
  }
  if (isIP(normalized) !== 6) return false;
  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("::ffff:127.") ||
    normalized.startsWith("::ffff:10.") ||
    normalized.startsWith("::ffff:192.168.") ||
    /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(normalized) ||
    normalized.startsWith("::ffff:169.254.")
  );
}

export function assertSafeRemoteMediaUrl(sourceUrl: string) {
  const url = new URL(sourceUrl);
  if (url.protocol !== "https:") {
    throw new Error("Provider media URL must use HTTPS");
  }
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "[::1]" ||
    hostname === "::1" ||
    isPrivateAddress(hostname)
  ) {
    throw new Error("Provider media URL cannot target a private network");
  }
  return url;
}

export async function assertSafeRemoteMediaUrlResolved(sourceUrl: string) {
  const url = assertSafeRemoteMediaUrl(sourceUrl);
  if (isIP(url.hostname)) return url;
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Provider media URL resolves to a private network");
  }
  return url;
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

async function fetchSafeRemoteMedia(sourceUrl: string) {
  let currentUrl = await assertSafeRemoteMediaUrlResolved(sourceUrl);
  const signal = AbortSignal.timeout(120_000);
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const response = await fetch(currentUrl, { redirect: "manual", signal });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location) throw new Error("Provider media redirect is missing Location");
    currentUrl = await assertSafeRemoteMediaUrlResolved(
      new URL(location, currentUrl).toString()
    );
  }
  throw new Error("Provider media exceeded the redirect limit");
}

async function readResponseWithLimit(response: Response, maxBytes: number) {
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
    const response = await fetchSafeRemoteMedia(params.sourceUrl);
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
