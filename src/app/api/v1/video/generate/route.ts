import { NextRequest } from "next/server";
import { videoService } from "@/services/video";
import { requireAuth } from "@/lib/api/auth";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { z } from "zod";
// Import proxy configuration for fetch requests
import "@/lib/proxy-config";
import { mediaAssetService } from "@/services/media-asset";

const generateSchema = z.object({
  prompt: z.string().trim().min(1).max(20000),
  model: z.string().min(1),
  duration: z.number().int().min(5).max(30).optional(),
  aspectRatio: z.string().optional(),
  quality: z.string().optional(),
  imageUrl: z.string().url().optional(),
  imageUrls: z.array(z.string().url()).max(2).optional(),
  mode: z.enum(["text-to-video", "image-to-video"]).optional(),
  outputNumber: z.number().int().min(1).max(2).optional().default(1),
  generateAudio: z.boolean().optional(),
  removeWatermark: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const data = generateSchema.parse(body);
    const inputImages = Array.from(
      new Set([...(data.imageUrls ?? []), ...(data.imageUrl ? [data.imageUrl] : [])])
    );
    await mediaAssetService.assertOwnedImageUrls(user.id, inputImages);

    const result = await videoService.generate({
      userId: user.id,
      prompt: data.prompt,
      model: data.model,
      duration: data.duration,
      aspectRatio: data.aspectRatio,
      quality: data.quality,
      imageUrl: data.imageUrl,
      imageUrls: data.imageUrls,
      mode: data.mode,
      outputNumber: data.outputNumber,
      generateAudio: data.generateAudio,
      removeWatermark: data.removeWatermark,
    });

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
