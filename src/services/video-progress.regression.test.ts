import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("propagates provider progress through polling to the generation card", () => {
  const serviceSource = readFileSync(
    join(process.cwd(), "src/services/video.ts"),
    "utf8"
  );
  const pollingSource = readFileSync(
    join(process.cwd(), "src/hooks/use-video-polling.ts"),
    "utf8"
  );
  const cardSource = readFileSync(
    join(process.cwd(), "src/components/tool/video-history-card.tsx"),
    "utf8"
  );

  expect(serviceSource).toContain("result.progress");
  expect(serviceSource).toContain("getVideoProgress");
  expect(pollingSource).toContain("onProgress?.({ videoId, status, progress })");
  expect(cardSource).toContain('role="progressbar"');
  expect(cardSource).toContain("{progress}%");
});

