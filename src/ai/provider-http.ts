const DEFAULT_PROVIDER_TIMEOUT_MS = 30_000;

export async function providerFetch(
  input: string | URL,
  init: RequestInit = {}
): Promise<Response> {
  const timeoutMs = Number.parseInt(
    process.env.AI_PROVIDER_TIMEOUT_MS ?? String(DEFAULT_PROVIDER_TIMEOUT_MS),
    10
  );
  const timeoutSignal = AbortSignal.timeout(
    Number.isFinite(timeoutMs) && timeoutMs > 0
      ? timeoutMs
      : DEFAULT_PROVIDER_TIMEOUT_MS
  );

  return fetch(input, { ...init, signal: timeoutSignal });
}

export function requireProviderTaskId(value: unknown, provider: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${provider} returned an invalid task id`);
  }
  return value;
}
