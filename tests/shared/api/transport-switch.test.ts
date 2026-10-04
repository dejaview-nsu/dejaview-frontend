import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { transportFx } from "@/shared/api";
import { MOCK_STORAGE_KEYS } from "@/shared/api/mocks";

import { jsonResponse } from "../../controlled-transport";
import { FakeXMLHttpRequest } from "../../fake-xhr";

const sessionRequest = { method: "GET" as const, path: "/auth/session", timeouts: { response: 5000 } };

beforeEach(() => {
  window.localStorage.clear();
  FakeXMLHttpRequest.reset();
  vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("transport switch", () => {
  it("VITE_API_MOCKS=true answers from mocks without XMLHttpRequest", async () => {
    vi.stubEnv("VITE_API_MOCKS", "true");
    window.localStorage.setItem(MOCK_STORAGE_KEYS.session, "authenticated");

    const response = await transportFx(sessionRequest);

    expect(response.status).toBe(200);
    expect(JSON.parse(response.bodyText)).toMatchObject({ user: { username: "movie_fan_42" } });
    expect(FakeXMLHttpRequest.instances).toHaveLength(0);
  });

  it.each(["false", ""])("VITE_API_MOCKS=%j sends the request through XMLHttpRequest", async (value) => {
    vi.stubEnv("VITE_API_MOCKS", value);

    const promise = transportFx(sessionRequest);

    await vi.waitFor(() => expect(FakeXMLHttpRequest.instances).toHaveLength(1));
    FakeXMLHttpRequest.last().respond(401, '{"code":"SESSION_REQUIRED","message":"Войдите, чтобы продолжить"}');

    expect((await promise).status).toBe(401);
    expect(FakeXMLHttpRequest.last().url).toBe("/api/v1/auth/session");
  });
});

describe("controlled transport", () => {
  it("reads response headers case-insensitively like XMLHttpRequest", () => {
    const response = jsonResponse(429, {}, { "Retry-After": "60" });

    expect(response.getHeader("Retry-After")).toBe("60");
    expect(response.getHeader("retry-after")).toBe("60");
    expect(response.getHeader("RETRY-AFTER")).toBe("60");
    expect(response.getHeader("X-Request-Id")).toBeNull();
  });
});
