import { describe, expect, it } from "vitest";

import { type HttpMethod, zUserListPage, zUserProfile } from "@/shared/api";
import { createMockStorage, createMockTransport, MOCK_STORAGE_KEYS, NO_MOCK_DELAYS } from "@/shared/api/mocks";

const setup = () => {
  const storage = createMockStorage(() => null);
  const transport = createMockTransport({ storage, delays: NO_MOCK_DELAYS });
  const request = async (method: HttpMethod, path: string, body?: unknown) => {
    const response = await transport({ method, path, body, timeouts: { response: 1000 } });

    return {
      status: response.status,
      body: response.bodyText ? JSON.parse(response.bodyText) : undefined,
      cacheControl: response.getHeader("Cache-Control"),
    };
  };
  const login = (username = "anna_k") => request("POST", "/auth/login", { login: username, password: "secret" });

  return { storage, request, login };
};

describe("profile mock contract", () => {
  it("requires a session", async () => {
    const { request } = setup();

    expect(await request("GET", "/users/me")).toMatchObject({ status: 401, body: { code: "SESSION_REQUIRED" } });
  });

  it("returns the profile of the signed in user with the watched count from the stored list", async () => {
    const { request, login } = setup();
    await login();
    await request("PUT", "/users/me/lists/watched/157336");
    await request("PUT", "/users/me/lists/watched/603");
    await request("PUT", "/users/me/lists/want_to_watch/423");

    const response = await request("GET", "/users/me");

    expect(response.status).toBe(200);
    expect(response.cacheControl).toBe("no-store");
    expect(zUserProfile.parse(response.body)).toEqual({
      username: "anna_k",
      birth_year: 2001,
      registered_at: "2026-09-14T09:00:00Z",
      stats: { watched_count: 2, ratings_count: 0, average_rating: 0, reviews_count: 0 },
    });

    await request("DELETE", "/users/me/lists/watched/603");

    expect((await request("GET", "/users/me")).body.stats.watched_count).toBe(1);
  });

  it("returns rated statistics in the rated scenario", async () => {
    const { request, login, storage } = setup();
    await login();
    storage.set(MOCK_STORAGE_KEYS.profileScenario, "rated");

    expect((await request("GET", "/users/me")).body.stats).toEqual({
      watched_count: 0,
      ratings_count: 38,
      average_rating: 7.8,
      reviews_count: 12,
    });
  });

  it("returns a server error in the error scenario", async () => {
    const { request, login, storage } = setup();
    await login();
    storage.set(MOCK_STORAGE_KEYS.profileScenario, "error");

    expect(await request("GET", "/users/me")).toMatchObject({ status: 500, body: { code: "INTERNAL_ERROR" } });
  });

  it("ends the session in the SESSION_EXPIRED scenario", async () => {
    const { request, login, storage } = setup();
    await login();
    storage.set(MOCK_STORAGE_KEYS.profileScenario, "SESSION_EXPIRED");

    expect(await request("GET", "/users/me")).toMatchObject({ status: 401, body: { code: "SESSION_EXPIRED" } });
    storage.remove(MOCK_STORAGE_KEYS.profileScenario);
    expect(await request("GET", "/users/me")).toMatchObject({ status: 401, body: { code: "SESSION_REQUIRED" } });
  });
});

describe("profile list mock scenarios", () => {
  it("fills both lists once with rated movies in the demo scenario and keeps removals", async () => {
    const { request, login, storage } = setup();
    await login();
    storage.set(MOCK_STORAGE_KEYS.listScenario, "demo");

    const page = zUserListPage.parse((await request("GET", "/users/me/lists/watched")).body);

    expect(page.total).toBe(4);
    expect(page.movies.find(({ movie_id }) => movie_id === 603)?.average_rating).toBe(6.3);
    expect(page.movies.every(({ user_rating }) => user_rating === null)).toBe(true);

    await request("DELETE", "/users/me/lists/watched/603");

    expect(zUserListPage.parse((await request("GET", "/users/me/lists/watched")).body).total).toBe(3);
    expect((await request("GET", "/users/me")).body.stats.watched_count).toBe(3);
  });

  it("fails only removals in the remove_error scenario", async () => {
    const { request, login, storage } = setup();
    await login();
    await request("PUT", "/users/me/lists/want_to_watch/603");
    storage.set(MOCK_STORAGE_KEYS.listScenario, "remove_error");

    expect(await request("DELETE", "/users/me/lists/want_to_watch/603")).toMatchObject({
      status: 500,
      body: { code: "INTERNAL_ERROR" },
    });
    expect(zUserListPage.parse((await request("GET", "/users/me/lists/want_to_watch")).body).total).toBe(1);
  });
});
