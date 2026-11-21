import { describe, expect, it } from "vitest";

import { type HttpMethod, zSessionInfo } from "@/shared/api";
import { createMockStorage, createMockTransport, MOCK_STORAGE_KEYS, NO_MOCK_DELAYS } from "@/shared/api/mocks";
import { TransportError } from "@/shared/api/transport/errors";

const setup = () => {
  const storage = createMockStorage(() => null);
  const transport = createMockTransport({ storage, delays: NO_MOCK_DELAYS });
  const request = async (method: HttpMethod, path: string, body?: unknown) => {
    const response = await transport({ method, path, body, timeouts: { response: 1000 } });
    const parse = () => {
      try {
        return JSON.parse(response.bodyText);
      } catch {
        return response.bodyText;
      }
    };

    return { status: response.status, body: response.bodyText ? parse() : undefined };
  };
  const signIn = () => storage.set(MOCK_STORAGE_KEYS.session, "authenticated");

  return { storage, transport, request, signIn };
};

const change = { current_password: "Kino#2026", new_password: "Kino#2027" };

describe("password change mock", () => {
  it("requires a session", async () => {
    const { request } = setup();

    expect(await request("PUT", "/users/me/password", change)).toMatchObject({
      status: 401,
      body: { code: "SESSION_REQUIRED" },
    });
  });

  it("changes the password and asks for the current one when the account has a password", async () => {
    const { request, signIn } = setup();
    signIn();

    expect((await request("PUT", "/users/me/password", change)).status).toBe(204);
    expect(await request("PUT", "/users/me/password", { new_password: "Kino#2027" })).toMatchObject({
      status: 400,
      body: { code: "AUTH_VALIDATION_ERROR", field: "current_password" },
    });
  });

  it("sets a password for an account without one and updates the session", async () => {
    const { request, signIn, storage } = setup();
    signIn();
    storage.set(MOCK_STORAGE_KEYS.sessionPasswordless, "true");

    expect(zSessionInfo.parse((await request("GET", "/auth/session")).body).user.has_password).toBe(false);
    expect((await request("PUT", "/users/me/password", { new_password: "Kino#2027" })).status).toBe(204);
    expect(zSessionInfo.parse((await request("GET", "/auth/session")).body).user.has_password).toBe(true);
  });

  it("returns the photo stored for the session user", async () => {
    const { request, signIn, storage } = setup();
    signIn();
    storage.set(MOCK_STORAGE_KEYS.sessionAvatar, "https://example.com/avatar.png");

    expect((await request("GET", "/auth/session")).body.user.avatar_url).toBe("https://example.com/avatar.png");
  });

  it.each([
    ["password_change_ok", 204, undefined],
    ["password_change_current_required", 400, "AUTH_VALIDATION_ERROR"],
    ["password_change_current_invalid", 400, "AUTH_CURRENT_PASSWORD_INVALID"],
    ["password_change_same_as_current", 400, "AUTH_PASSWORD_SAME_AS_CURRENT"],
    ["password_change_validation_error", 400, "AUTH_VALIDATION_ERROR"],
    ["password_change_session_expired", 401, "SESSION_EXPIRED"],
    ["password_change_rate_limited", 429, "RATE_LIMITED"],
    ["password_change_server_error", 500, "INTERNAL_ERROR"],
    ["password_change_invalid_response", 418, undefined],
  ])("answers the %s scenario", async (scenario, status, code) => {
    const { request, signIn, storage } = setup();
    signIn();
    storage.set(MOCK_STORAGE_KEYS.authScenario, scenario);

    const response = await request("PUT", "/users/me/password", change);

    expect(response.status).toBe(status);
    if (code) expect(response.body).toMatchObject({ code });
  });

  it.each([
    ["password_change_network_error", "network"],
    ["password_change_timeout", "timeout"],
    ["logout_network_error", "network"],
    ["logout_timeout", "timeout"],
  ])("fails the transport in the %s scenario", async (scenario, kind) => {
    const { request, signIn, storage } = setup();
    signIn();
    storage.set(MOCK_STORAGE_KEYS.authScenario, scenario);

    const path = scenario.startsWith("logout") ? "/auth/logout" : "/users/me/password";
    const method = scenario.startsWith("logout") ? "POST" : "PUT";

    await expect(request(method, path, change)).rejects.toEqual(new TransportError(kind as "network" | "timeout"));
  });

  it.each([
    ["logout_session_expired", 401],
    ["logout_rate_limited", 429],
    ["logout_server_error", 500],
    ["logout_invalid_response", 418],
  ])("answers the %s logout scenario", async (scenario, status) => {
    const { request, signIn, storage } = setup();
    signIn();
    storage.set(MOCK_STORAGE_KEYS.authScenario, scenario);

    expect((await request("POST", "/auth/logout")).status).toBe(status);
  });
});

describe("list removal mock scenarios", () => {
  it.each([
    ["remove_error", 500],
    ["remove_rate_limited", 429],
    ["remove_invalid_parameter", 400],
    ["remove_not_found", 404],
    ["remove_invalid_response", 418],
    ["remove_session_expired", 401],
  ])("answers %s only for DELETE", async (scenario, status) => {
    const { request, signIn, storage } = setup();
    signIn();
    storage.set(MOCK_STORAGE_KEYS.listScenario, scenario);

    expect((await request("GET", "/users/me/lists/watched?sort=newest&page=1")).status).toBe(200);
    expect((await request("DELETE", "/users/me/lists/watched/603")).status).toBe(status);
  });

  it.each([
    ["RATE_LIMITED", 429],
    ["INVALID_RESPONSE", 200],
    ["error", 500],
  ])("answers %s for every list request", async (scenario, status) => {
    const { request, signIn, storage } = setup();
    signIn();
    storage.set(MOCK_STORAGE_KEYS.listScenario, scenario);

    expect((await request("GET", "/users/me/lists/watched?sort=newest&page=1")).status).toBe(status);
  });
});

describe("profile mock failure scenarios", () => {
  it.each([
    ["RATE_LIMITED", 429],
    ["INVALID_RESPONSE", 200],
  ])("answers %s", async (scenario, status) => {
    const { request, signIn, storage } = setup();
    signIn();
    storage.set(MOCK_STORAGE_KEYS.profileScenario, scenario);

    expect((await request("GET", "/users/me")).status).toBe(status);
  });

  it.each([
    ["NETWORK_ERROR", "network"],
    ["TIMEOUT", "timeout"],
  ] as const)("fails the transport in the %s scenario", async (scenario, kind) => {
    const { request, signIn, storage } = setup();
    signIn();
    storage.set(MOCK_STORAGE_KEYS.profileScenario, scenario);

    await expect(request("GET", "/users/me")).rejects.toEqual(new TransportError(kind));
  });
});
