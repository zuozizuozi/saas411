import { type NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { getWorkflowConfig } from "@/lib/upstash";

/**
 * QStash failure callback. Keep this endpoint intentionally small: the task
 * remains recoverable through the admin console and scheduled reconciliation.
 */
let verifiedPost:
  | ((request: NextRequest | Request) => Promise<Response>)
  | undefined;

function getVerifiedPost() {
  let config: ReturnType<typeof getWorkflowConfig>;
  try {
    config = getWorkflowConfig();
  } catch (error) {
    console.error("Invalid QStash failure callback configuration", error);
    return null;
  }
  if (!config) return null;

  if (!verifiedPost) {
    verifiedPost = verifySignatureAppRouter(
      async (request: NextRequest) => {
        const body = await request.json().catch(() => null);
        console.error(
          "[Workflow] Video reconciliation delivery exhausted",
          body
        );
        return NextResponse.json({ received: true });
      },
      {
        currentSigningKey: config.currentSigningKey,
        nextSigningKey: config.nextSigningKey,
      }
    );
  }

  return verifiedPost;
}

export async function POST(request: NextRequest) {
  const handler = getVerifiedPost();
  if (!handler) {
    return NextResponse.json(
      { error: "QStash signature verification is not configured" },
      { status: 503 }
    );
  }

  return handler(request);
}
