import { afterEach, describe, expect, it, vi } from "vitest";

import { createMockTransport, MOCK_STORAGE_KEYS, NO_MOCK_DELAYS, TEXT_SEARCH_SCENARIOS } from "@/shared/api/mocks";
import { TransportError } from "@/shared/api/transport/errors";

import { createTestMockStorage } from "../../session-scope";

const textSearch = async (query: unknown, scenario?: string) => {
  const storage = createTestMockStorage();
  if (scenario) storage.set(MOCK_STORAGE_KEYS.searchScenario, scenario);
  const transport = createMockTransport({ storage, delays: NO_MOCK_DELAYS });
  const response = await transport({
    method: "POST",
    path: "/search/text",
    body: { query },
    timeouts: { response: 1000 },
  });
  const json = response.getHeader("content-type") !== "text/html" && response.bodyText !== "";
  return { status: response.status, body: json ? JSON.parse(response.bodyText) : undefined, response };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("text search mock", () => {
  it.each([
    ["", 400, "QUERY_EMPTY"],
    [5, 400, "QUERY_EMPTY"],
    ["　  ", 400, "QUERY_EMPTY"],
    ["　аб ", 422, "QUERY_TOO_SHORT"],
    ["а".repeat(251), 422, "QUERY_TOO_LONG"],
  ])("checks the trimmed query %j like the backend", async (query, status, code) => {
    const { status: actual, body } = await textSearch(query);
    expect(actual).toBe(status);
    expect(body).toMatchObject({ code, field: "query" });
  });

  it("accepts 250 characters after trimming Unicode spaces", async () => {
    const { status, body } = await textSearch(`　${"я".repeat(250)} `);
    expect(status).toBe(200);
    expect(body.results).toHaveLength(5);
  });

  it("returns 12 distinct movies for the many scenario", async () => {
    const { body } = await textSearch("Солдат в окопе", "many");
    expect(body.results).toHaveLength(12);
    expect(new Set(body.results.map(({ movie_id }: { movie_id: number }) => movie_id)).size).toBe(12);
  });

  it.each([
    ["empty", 200, undefined],
    ["QUERY_EMPTY", 400, "QUERY_EMPTY"],
    ["QUERY_TOO_SHORT", 422, "QUERY_TOO_SHORT"],
    ["QUERY_TOO_LONG", 422, "QUERY_TOO_LONG"],
    ["QUERY_NOT_ALLOWED", 422, "QUERY_NOT_ALLOWED"],
    ["SEARCH_UNAVAILABLE", 503, "SEARCH_UNAVAILABLE"],
    ["SERVER_BUSY", 503, "SERVER_BUSY"],
    ["RATE_LIMITED", 429, "RATE_LIMITED"],
    ["INTERNAL_ERROR", 500, "INTERNAL_ERROR"],
  ])("answers the %s scenario", async (scenario, status, code) => {
    const { status: actual, body } = await textSearch("Солдат в окопе", scenario);
    expect(actual).toBe(status);
    if (code) expect(body.code).toBe(code);
    else expect(body).toEqual({ results: [] });
  });

  it("answers nginx 502 with html and a retry-after for rate limiting", async () => {
    const nginx = await textSearch("Солдат в окопе", "NGINX_502");
    expect(nginx.status).toBe(502);
    expect(nginx.response.getHeader("content-type")).toBe("text/html");
    const limited = await textSearch("Солдат в окопе", "RATE_LIMITED");
    expect(limited.response.getHeader("Retry-After")).not.toBeNull();
  });

  it.each([
    ["NETWORK_ERROR", "network"],
    ["TIMEOUT", "timeout"],
  ])("throws a transport error for %s", async (scenario, kind) => {
    await expect(textSearch("Солдат в окопе", scenario)).rejects.toEqual(new TransportError(kind as "network"));
  });

  it("falls back to found for an unknown scenario", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { body } = await textSearch("Солдат в окопе", "UNKNOWN");
    expect(body.results).toHaveLength(5);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("lists every scenario", () => {
    expect(TEXT_SEARCH_SCENARIOS).toContain("many");
  });
});
