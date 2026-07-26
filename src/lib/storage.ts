import { s3mini } from "s3mini";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isIP } from "node:net";

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
    (isIP(hostname) === 4 && PRIVATE_IPV4_RANGES.some((range) => range.test(hostname))) ||
    (isIP(hostname) === 6 && (hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80")))
  ) {
    throw new Error("Provider media URL cannot target a private network");
  }
  return url;
}

async function fetchSafeRemoteMedia(sourceUrl: string) {
  let currentUrl = assertSafeRemoteMediaUrl(sourceUrl);
  const signal = AbortSignal.timeout(120_000);
  for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
    const response = await fetch(currentUrl, { redirect: "manual", signal });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location) throw new Error("Provider media redirect is missing Location");
    currentUrl = assertSafeRemoteMediaUrl(new URL(location, currentUrl).toString());
  }
  throw new Error("Provider media exceeded the redirect limit");
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

  async createPresignedUpload(params: { key: string; contentType: string }) {
    return getSignedUrl(
      this.signingClient,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: params.key,
        ContentType: params.contentType,
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

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) {
      throw new Error(`Provider video exceeds the ${maxBytes} byte limit`);
    }
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
