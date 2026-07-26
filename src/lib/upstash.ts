import { Client } from "@upstash/qstash";

function getQStashClient() {
  const token = process.env.QSTASH_TOKEN;
  if (!token) return null;
  return new Client({ token, baseUrl: process.env.QSTASH_URL });
}

export function isWorkflowEnabled(): boolean {
  return Boolean(process.env.QSTASH_TOKEN && process.env.NEXT_PUBLIC_APP_URL);
}

/** Queue a durable reconciliation pass after a provider accepts a task. */
export async function scheduleVideoReconciliation(input: {
  videoUuid: string;
  userId: string;
}) {
  const client = getQStashClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!client || !appUrl) return null;

  return client.publishJSON({
    url: `${appUrl}/api/internal/workflows/video-reconcile`,
    body: input,
    retries: 3,
    delay: "15s",
    failureCallback: `${appUrl}/api/internal/workflows/video-reconcile-failed`,
  });
}
