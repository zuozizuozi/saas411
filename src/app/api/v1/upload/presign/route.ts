import { nanoid } from "nanoid";
import { z } from "zod";

import { requireAuth } from "@/lib/api/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getStorage } from "@/lib/storage";

const schema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const input = schema.parse(await request.json());
    const safeExtension = input.fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const key = `uploads/${user.id}/${nanoid()}.${safeExtension}`;
    const storage = getStorage();
    const uploadUrl = await storage.createPresignedUpload({
      key,
      contentType: input.contentType,
    });
    return apiSuccess({ uploadUrl, key, publicUrl: storage.getPublicUrl(key) });
  } catch (error) {
    return handleApiError(error);
  }
}
