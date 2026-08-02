import { describe, expect, it } from "vitest";

import { calculateModelCredits } from "./credits";

describe("linear video credit pricing", () => {
  it("charges AI Video exactly one credit per generated second", () => {
    expect(calculateModelCredits("zhipu-video", { duration: 1 })).toBe(1);
    expect(calculateModelCredits("zhipu-video", { duration: 5 })).toBe(5);
    expect(calculateModelCredits("zhipu-video", { duration: 15 })).toBe(15);
    expect(calculateModelCredits("zhipu-video", { duration: 30 })).toBe(30);
  });

  it("keeps every model price strictly proportional to duration", () => {
    const oneSecond = calculateModelCredits("seedance-1.5-pro", {
      duration: 1,
      quality: "1080P",
    });
    const thirtySeconds = calculateModelCredits("seedance-1.5-pro", {
      duration: 30,
      quality: "1080P",
    });

    expect(thirtySeconds).toBe(oneSecond * 30);
  });
});
