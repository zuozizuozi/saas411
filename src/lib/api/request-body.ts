import { ApiError } from "./error";

export async function readRequestTextWithLimit(request: Request, maxBytes: number) {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    const parsedLength = Number(declaredLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      throw new ApiError("Request body is too large", 413);
    }
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("request body size limit exceeded");
        throw new ApiError("Request body is too large", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total).toString("utf8");
}
