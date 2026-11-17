import { afterEach, describe, expect, it, vi } from "vitest";

import { saveRegistrationReturnPath, takeRegistrationReturnPath } from "@/shared/routes";

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("return after email confirmation", () => {
  it("retains the original path and query across reload and consumes them once", () => {
    saveRegistrationReturnPath("/movies/603?from=search");

    expect(takeRegistrationReturnPath()).toBe("/movies/603?from=search");
    expect(takeRegistrationReturnPath()).toBeNull();
  });

  it.each(["https://example.com", "//example.com", "/\\example.com", "javascript:alert(1)", undefined])(
    "does not retain unsafe or absent return target %s",
    (path) => {
      saveRegistrationReturnPath("/movies/603");
      saveRegistrationReturnPath(path);

      expect(takeRegistrationReturnPath()).toBeNull();
    },
  );

  it("expires alongside an email confirmation link", () => {
    vi.useFakeTimers();
    saveRegistrationReturnPath("/movies/603");
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);

    expect(takeRegistrationReturnPath()).toBeNull();
    vi.useRealTimers();
  });

  it("does not interrupt confirmation if browser storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => saveRegistrationReturnPath("/movies/603")).not.toThrow();
    expect(takeRegistrationReturnPath()).toBeNull();
  });
});
