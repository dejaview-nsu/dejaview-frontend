import { describe, expect, it } from "vitest";

import { isNonNullable } from "../guards";

describe("isNonNullable", () => {
  it("passes for non-null values", () => {
    expect(isNonNullable(0)).toBe(true);
    expect(isNonNullable("")).toBe(true);
    expect(isNonNullable(false)).toBe(true);
  });

  it("fails for null and undefined", () => {
    expect(isNonNullable(null)).toBe(false);
    expect(isNonNullable(undefined)).toBe(false);
  });

  it("narrows the type", () => {
    const value: string | null = "text";
    if (isNonNullable(value)) {
      expect(value.length).toBe(4);
    }
  });
});
