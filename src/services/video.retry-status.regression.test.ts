import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("surfaces a recoverable status instead of hiding completion errors as generating", () => {
  const serviceSource = readFileSync(
    join(process.cwd(), "src/services/video.ts"),
    "utf8"
  );
  const pollingSource = readFileSync(
    join(process.cwd(), "src/hooks/use-video-polling.ts"),
    "utf8"
  );

  expect(serviceSource).toContain('status: "RETRYING"');
  expect(serviceSource).toContain("We will retry automatically");
  expect(pollingSource).toContain('status === "RETRYING"');
  expect(pollingSource).toContain("onRetrying?.({ videoId, error })");
});
