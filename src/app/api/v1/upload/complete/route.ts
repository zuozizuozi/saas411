import { z } from "zod";

import { requireAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getStorage } from "@/lib/storage";
import { mediaAssetService } from "@/services/media-asset";

const schema = z.object({
  key: z.string().min(1),
  fileName: z.string().min(1).max(255),
  contentType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const input = schema.parse(await request.json());
    if (!input.key.startsWith(`uploads/${user.id}/`)) {
      throw new ApiError("Invalid upload ownership", 403);
    }

    const storage = getStorage();
    const object = await storage.verifyObject(input.key);
    if (object.size !== input.fileSize || object.size > 10 * 1024 * 1024) {
      await storage.deleteObject(input.key);
      throw new ApiError("Uploaded file size mismatch", 400);
    }
    if (object.contentType !== input.contentType) {
      await storage.deleteObject(input.key);
      throw new ApiError("Uploaded content type mismatch", 400);
    }
    try {
      await storage.verifyImageObject(input.key, input.contentType);
    } catch {
      await storage.deleteObject(input.key);
      throw new ApiError("Uploaded file is not a valid supported image", 400);
    }

    const asset = await mediaAssetService.create({
      userId: user.id,
      storageKey: input.key,
      url: storage.getPublicUrl(input.key),
      fileName: input.fileName,
      contentType: object.contentType,
      fileSize: object.size,
    });
    return apiSuccess({ publicUrl: asset.url, key: input.key, asset });
  } catch (error) {
    return handleApiError(error);
  }
}
