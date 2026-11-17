import { describe, expect, it } from "vitest";

import { type HttpMethod, zUserListPage, zUserMovieState } from "@/shared/api";
import { createMockStorage, createMockTransport, MOCK_STORAGE_KEYS, NO_MOCK_DELAYS } from "@/shared/api/mocks";

const setup = () => {
  const storage = createMockStorage(() => null);
  const transport = createMockTransport({ storage, delays: NO_MOCK_DELAYS });
  const request = async (method: HttpMethod, path: string, body?: unknown, signal?: AbortSignal) => {
    const response = await transport({ method, path, body, signal, timeouts: { response: 1000 } });

    return { status: response.status, body: response.bodyText ? JSON.parse(response.bodyText) : undefined };
  };
  const login = (username = "first_user") => request("POST", "/auth/login", { login: username, password: "secret" });
  const state = async (movieId = 157336) =>
    zUserMovieState.parse((await request("GET", `/users/me/movies/${movieId}`)).body);
  const list = async (query = "", type = "want_to_watch") =>
    zUserListPage.parse((await request("GET", `/users/me/lists/${type}${query}`)).body);

  return { storage, request, login, state, list };
};

describe("movie list mock contract", () => {
  it.each([
    ["GET", "/users/me/movies/157336"],
    ["GET", "/users/me/lists/want_to_watch"],
    ["PUT", "/users/me/lists/watched/157336"],
    ["DELETE", "/users/me/lists/watched/157336"],
  ] as const)("requires a session for %s %s", async (method, path) => {
    const { request } = setup();

    expect(await request(method, path)).toMatchObject({ status: 401, body: { code: "SESSION_REQUIRED" } });
  });

  it("keeps both memberships independent, repeated additions stable, and deletion idempotent", async () => {
    const { request, login, state, list } = setup();
    await login();
    expect(await state()).toEqual({ want_to_watch: false, watched: false });

    for (const movieId of [157336, 603, 157336]) {
      expect(await request("PUT", `/users/me/lists/want_to_watch/${movieId}`)).toEqual({
        status: 204,
        body: undefined,
      });
    }
    await request("PUT", "/users/me/lists/watched/157336");

    expect(await state()).toEqual({ want_to_watch: true, watched: true });
    expect((await list()).movies.map(({ movie_id }) => movie_id)).toEqual([603, 157336]);
    expect((await list()).total).toBe(2);
    await request("DELETE", "/users/me/lists/want_to_watch/157336");
    expect(await request("DELETE", "/users/me/lists/want_to_watch/157336")).toEqual({ status: 204, body: undefined });
    expect(await state()).toEqual({ want_to_watch: false, watched: true });
  });

  it("persists memberships across sessions without exposing another user's lists", async () => {
    const { request, login, state, list, storage } = setup();
    await login();
    await request("PUT", "/users/me/lists/watched/157336");
    await request("POST", "/auth/logout");
    await login("second_user");

    expect(await state()).toEqual({ want_to_watch: false, watched: false });
    expect(await list("", "watched")).toEqual({ movies: [], total: 0 });
    await request("PUT", "/users/me/lists/want_to_watch/603");
    await request("POST", "/auth/logout");
    await login();

    const reloaded = createMockTransport({ storage, delays: NO_MOCK_DELAYS });
    const response = await reloaded({ method: "GET", path: "/users/me/movies/157336", timeouts: { response: 1000 } });

    expect(zUserMovieState.parse(JSON.parse(response.bodyText))).toEqual({ want_to_watch: false, watched: true });
    expect(await state(603)).toEqual({ want_to_watch: false, watched: false });
    expect((await request("GET", "/auth/session")).body.user.username).toBe("first_user");
  });

  it("filters titles without case sensitivity, preserves sorting, and returns empty distant pages", async () => {
    const { request, login, list } = setup();
    await login();

    for (const movieId of [157336, 603, 27205]) await request("PUT", `/users/me/lists/want_to_watch/${movieId}`);

    expect((await list("?sort=oldest")).movies.map(({ movie_id }) => movie_id)).toEqual([157336, 603, 27205]);
    expect((await list("?sort=title_desc")).movies.map(({ title }) => title)).toEqual([
      "Начало",
      "Матрица",
      "Интерстеллар",
    ]);
    expect((await list(`?q=${encodeURIComponent(" МАТР ")}`)).movies.map(({ movie_id }) => movie_id)).toEqual([603]);
    expect(await list("?page=2")).toEqual({ movies: [], total: 3 });
  });

  it("validates parameters and accepts state reads or deletion for an absent movie", async () => {
    const { request, login, state } = setup();
    await login();

    for (const [path, field] of [
      ["/users/me/lists/favorites", "list_type"],
      ["/users/me/lists/watched?sort=unknown", "sort"],
      ["/users/me/lists/watched?page=0", "page"],
    ]) {
      expect(await request("GET", path)).toMatchObject({ status: 400, body: { code: "INVALID_PARAMETER", field } });
    }
    expect(await request("PUT", "/users/me/lists/watched/404404")).toMatchObject({
      status: 404,
      body: { code: "MOVIE_NOT_FOUND" },
    });
    expect(await request("GET", "/users/me/movies/0")).toMatchObject({
      status: 404,
      body: { code: "MOVIE_NOT_FOUND" },
    });
    expect(await request("DELETE", "/users/me/lists/watched/404404")).toEqual({ status: 204, body: undefined });
    expect(await state(404404)).toEqual({ want_to_watch: false, watched: false });
  });

  it("does not commit failed or cancelled writes and permits a subsequent retry", async () => {
    const { request, login, state, storage } = setup();
    await login();
    storage.set(MOCK_STORAGE_KEYS.listScenario, "error");

    expect(await request("PUT", "/users/me/lists/watched/157336")).toMatchObject({ status: 500 });
    storage.remove(MOCK_STORAGE_KEYS.listScenario);

    const controller = new AbortController();
    const cancelled = request("PUT", "/users/me/lists/watched/157336", undefined, controller.signal);
    controller.abort();

    await expect(cancelled).rejects.toMatchObject({ name: "AbortError" });
    expect(await state()).toEqual({ want_to_watch: false, watched: false });
    await request("PUT", "/users/me/lists/watched/157336");
    expect(await state()).toEqual({ want_to_watch: false, watched: true });
  });

  it("expires the mock session without changing membership", async () => {
    const { request, login, state, storage } = setup();
    await login();
    storage.set(MOCK_STORAGE_KEYS.listScenario, "SESSION_EXPIRED");

    expect(await request("PUT", "/users/me/lists/watched/157336")).toMatchObject({
      status: 401,
      body: { code: "SESSION_EXPIRED" },
    });
    expect(storage.get(MOCK_STORAGE_KEYS.session)).toBeNull();
    storage.remove(MOCK_STORAGE_KEYS.listScenario);
    await login();
    expect(await state()).toEqual({ want_to_watch: false, watched: false });
  });

  it("does not apply a pending write to a different account after a session change", async () => {
    const { login, state, storage } = setup();
    await login();

    const delayed = createMockTransport({ storage, delays: { ...NO_MOCK_DELAYS, jsonMs: 30 } });
    const writing = delayed({ method: "PUT", path: "/users/me/lists/watched/157336", timeouts: { response: 1000 } });
    await login("second_user");

    expect((await writing).status).toBe(401);
    expect(await state()).toEqual({ want_to_watch: false, watched: false });
    await login();
    expect(await state()).toEqual({ want_to_watch: false, watched: false });
  });
});
