import { serve } from "@upstash/workflow/nextjs";
import { NextResponse } from "next/server";

import { videoService } from "@/services/video";
import { getWorkflowConfig } from "@/lib/upstash";

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
  let config: ReturnType<typeof getWorkflowConfig>;
  try {
    config = getWorkflowConfig();
  } catch (error) {
    console.error("Invalid durable workflow configuration", error);
    return null;
  }
  if (!config) {
    return null;
  }

  if (!workflowPost) {
    workflowPost = serve<VideoReconcileInput>(async (context) => {
      // Poll for one hour before applying the documented terminal timeout.
      // The provider callback can still complete the task at any point during
      // this window; failGeneration is idempotent if a terminal state won the
      // race first.
      for (let attempt = 0; attempt < 80; attempt += 1) {
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

      const timeoutResult = await context.run(
        "fail-video-after-provider-timeout",
        () =>
          videoService.failGeneration(
            context.requestPayload.videoUuid,
            "Provider did not reach a terminal state within 60 minutes"
          )
      );
      if (
        timeoutResult.status === "COMPLETED" ||
        timeoutResult.status === "FAILED"
      ) {
        return timeoutResult;
      }

      // Do not race an in-flight local upload. Its lease is five minutes; once
      // that window passes, refreshStatus can recover a crashed uploader before
      // the final idempotent timeout decision.
      await context.sleep("wait-for-active-upload-lease", 5 * 60);
      const recovered = await context.run("refresh-after-upload-lease", () =>
        videoService.refreshStatus(
          context.requestPayload.videoUuid,
          context.requestPayload.userId
        )
      );
      if (recovered.status === "COMPLETED" || recovered.status === "FAILED") {
        return recovered;
      }

      return context.run("fail-video-after-upload-lease", () =>
        videoService.failGeneration(
          context.requestPayload.videoUuid,
          "Provider did not reach a terminal state within 65 minutes"
        )
      );
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
