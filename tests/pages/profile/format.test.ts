import { describe, expect, it } from "vitest";

import { formatDate, isListTab, parseProfileTab } from "@/pages/profile/lib";

describe("profile date format", () => {
  it("formats a registration date as DD.MM.YYYY", () => {
    expect(formatDate("2026-09-14T09:00:00Z")).toBe("14.09.2026");
  });
});

describe("profile tab parsing", () => {
  it.each([
    ["watched", "watched"],
    ["want_to_watch", "want_to_watch"],
    ["ratings", "ratings"],
    ["reviews", "reviews"],
    ["security", "security"],
    ["lists", "want_to_watch"],
    [null, "want_to_watch"],
    [["watched"], "want_to_watch"],
  ])("reads %j as %s", (value, tab) => {
    expect(parseProfileTab(value)).toBe(tab);
  });
});

describe("profile list tabs", () => {
  it.each([
    ["want_to_watch", true],
    ["watched", true],
    ["ratings", false],
    ["reviews", false],
    ["security", false],
  ] as const)("%s is a list tab: %s", (tab, expected) => {
    expect(isListTab(tab)).toBe(expected);
  });
});
