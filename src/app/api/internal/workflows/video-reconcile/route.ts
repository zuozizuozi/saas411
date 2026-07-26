import { serve } from "@upstash/workflow/nextjs";
import { NextResponse } from "next/server";

import { videoService } from "@/services/video";

interface VideoReconcileInput {
  videoUuid: string;
  userId: string;
}

/**
 * Durable safety net for providers that delay or lose callbacks. The database
 * remains the source of truth; this workflow only advances an existing task.
 */
let workflowPost: ((request: Request) => Promise<Response>) | undefined;

function getWorkflowPost() {
  if (
    !process.env.QSTASH_TOKEN ||
    !process.env.QSTASH_CURRENT_SIGNING_KEY ||
    !process.env.QSTASH_NEXT_SIGNING_KEY
  ) {
    return null;
  }

  if (!workflowPost) {
    workflowPost = serve<VideoReconcileInput>(async (context) => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const result = await context.run(`refresh-video-${attempt}`, () =>
          videoService.refreshStatus(
            context.requestPayload.videoUuid,
            context.requestPayload.userId
          )
        );

        if (result.status === "COMPLETED" || result.status === "FAILED") {
          return result;
        }

        await context.sleep(`wait-for-provider-${attempt}`, 45);
      }

      return { status: "PENDING", reason: "reconciliation-window-exhausted" };
    }).POST;
  }

  return workflowPost;
}

export async function POST(request: Request) {
  const handler = getWorkflowPost();
  if (!handler) {
    return NextResponse.json(
      { error: "Durable workflow is not configured" },
      { status: 503 }
    );
  }

  return handler(request);
}
