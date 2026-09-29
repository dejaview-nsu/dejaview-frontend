import { describe, expect, it } from "vitest";
import { z } from "zod";

import { zodContract } from "@/shared/lib/contracts/zod";

describe("zodContract", () => {
  const contract = zodContract(z.object({ id: z.number(), title: z.string() }));

  it("isData returns true for valid data", () => {
    expect(contract.isData({ id: 1, title: "text" })).toBe(true);
  });

  it("isData returns false for invalid data", () => {
    expect(contract.isData({ id: "1", title: "text" })).toBe(false);
    expect(contract.isData(null)).toBe(false);
    expect(contract.isData({})).toBe(false);
  });

  it("getErrorMessages reports field issues", () => {
    const messages = contract.getErrorMessages?.({ id: "1" }) ?? [];
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some((message) => message.includes("id"))).toBe(true);
  });
});
