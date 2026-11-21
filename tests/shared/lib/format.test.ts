import { describe, expect, it } from "vitest";

import { formatRating } from "@/shared/lib/format";

describe("rating format", () => {
  it.each([
    [7.8, "7,8"],
    [8, "8,0"],
    [10, "10,0"],
    [6.25, "6,3"],
  ])("formats %s as %s", (value, text) => {
    expect(formatRating(value)).toBe(text);
  });

  it("shows a dash for a missing rating", () => {
    expect(formatRating(null)).toBe("–");
    expect(formatRating(null, "—")).toBe("—");
  });
});
