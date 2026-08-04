import { z } from "zod";

import { requireAuth } from "@/lib/api/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getStorage } from "@/lib/storage";
import { uploadReservationService } from "@/services/upload-reservation";

const schema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024),
});

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const input = schema.parse(await request.json());
    const reservation = await uploadReservationService.reserve({
      userId: user.id,
      ...input,
    });
    const storage = getStorage();
    try {
      const uploadUrl = await storage.createPresignedUpload({
        key: reservation.storageKey,
        contentType: reservation.contentType,
        contentLength: reservation.expectedSize,
      });
      return apiSuccess({
        uploadUrl,
        key: reservation.storageKey,
        publicUrl: storage.getPublicUrl(reservation.storageKey),
        expiresAt: reservation.expiresAt,
      });
    } catch (error) {
      await uploadReservationService.reject(user.id, reservation.storageKey);
      throw error;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
