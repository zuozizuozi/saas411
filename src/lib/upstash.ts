import { Client } from "@upstash/qstash";

interface WorkflowConfig {
  token: string;
  appUrl: string;
  currentSigningKey: string;
  nextSigningKey: string;
  baseUrl?: string;
}

/**
 * Return the complete sender/receiver configuration, or null when QStash is
 * intentionally disabled. Any partial QStash credential set is rejected so a
 * paid task is never published to a receiver that is guaranteed to return 503.
 */
export function getWorkflowConfig(): WorkflowConfig | null {
  const token = process.env.QSTASH_TOKEN?.trim();
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  const hasQStashCredentials = Boolean(
    token || currentSigningKey || nextSigningKey
  );

  if (!hasQStashCredentials) return null;
  if (!token || !currentSigningKey || !nextSigningKey || !appUrl) {
    throw new Error(
      "Incomplete QStash workflow configuration: QSTASH_TOKEN, " +
        "QSTASH_CURRENT_SIGNING_KEY, QSTASH_NEXT_SIGNING_KEY, and " +
        "NEXT_PUBLIC_APP_URL are all required"
    );
  }

  return {
    token,
    appUrl,
    currentSigningKey,
    nextSigningKey,
    baseUrl: process.env.QSTASH_URL?.trim() || undefined,
  };
}

function getQStashClient(config: WorkflowConfig) {
  return new Client({ token: config.token, baseUrl: config.baseUrl });
}

export function isWorkflowEnabled(): boolean {
  return getWorkflowConfig() !== null;
}

/** Queue a durable reconciliation pass after a provider accepts a task. */
export async function scheduleVideoReconciliation(input: {
  videoUuid: string;
  userId: string;
}) {
  const config = getWorkflowConfig();
  if (!config) return null;
  const client = getQStashClient(config);

  return client.publishJSON({
    url: `${config.appUrl}/api/internal/workflows/video-reconcile`,
    body: input,
    retries: 3,
    delay: "15s",
    failureCallback: `${config.appUrl}/api/internal/workflows/video-reconcile-failed`,
  });
}
