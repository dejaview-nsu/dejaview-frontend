import { historyAdapter } from "@effector/router";
import { allSettled, fork, scopeBind } from "effector";
import { createMemoryHistory } from "history";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createStoredIntent,
  MOVIE_LIST_INTENT_KEY,
  type MovieListIntent,
  saveMovieListIntent,
} from "@/features/movie-lists/lib/intent-storage";
import { $$movieListIntent } from "@/features/movie-lists/model/intent";

import { $$session } from "@/entities/session";

import { router } from "@/shared/routes";

import { setupSessionScope } from "../../session-scope";

const intent: MovieListIntent = { movieId: "603", list: "want_to_watch", selected: true };

const storedIntent = () => createStoredIntent(intent, {});

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("movie list authentication intent", () => {
  it("keeps the requested addition through modal login and consumes it once", async () => {
    const { scope } = await setupSessionScope({ initialEntry: "/movies/603?from=search" });

    await allSettled($$movieListIntent.inputs.requested, { scope, params: intent });
    await allSettled($$session.inputs.loginPressed, { scope });

    expect(scope.getState($$movieListIntent.outputs.$intent)).toEqual(intent);
    expect(JSON.parse(sessionStorage.getItem(MOVIE_LIST_INTENT_KEY)!)).toMatchObject({
      intent,
      returnPath: "/movies/603?from=search",
    });

    await allSettled($$session.inputs.signedIn, { scope, params: { login: "movie_fan_42", password: "Kino#2026" } });

    expect(scope.getState($$movieListIntent.outputs.$intent)).toEqual(intent);

    await allSettled($$movieListIntent.inputs.consumed, { scope });

    expect(scope.getState($$movieListIntent.outputs.$intent)).toBeNull();
    expect(sessionStorage.getItem(MOVIE_LIST_INTENT_KEY)).toBeNull();
  });

  it("explicitly dismissing the modal cancels the action and allows a new request", async () => {
    const { scope } = await setupSessionScope({ initialEntry: "/movies/603" });

    await allSettled($$movieListIntent.inputs.requested, { scope, params: intent });
    await allSettled($$session.inputs.loginPressed, { scope });
    await allSettled($$session.inputs.loginDialogDismissed, { scope });

    expect(scope.getState($$movieListIntent.outputs.$intent)).toBeNull();
    expect(sessionStorage.getItem(MOVIE_LIST_INTENT_KEY)).toBeNull();

    await allSettled($$movieListIntent.inputs.requested, { scope, params: { ...intent, list: "watched" } });

    expect(scope.getState($$movieListIntent.outputs.$intent)).toEqual({ ...intent, list: "watched" });
  });

  it.each(["/register", "/login"])("preserves the action when the dialog moves to %s", async (path) => {
    const { scope } = await setupSessionScope({ initialEntry: "/movies/603" });

    await allSettled($$movieListIntent.inputs.requested, { scope, params: intent });
    await allSettled($$session.inputs.loginPressed, { scope });
    await allSettled(router.navigate, { scope, params: { path, query: { redirect: "/movies/603" } } });

    expect(scope.getState($$session.outputs.$isLoginDialogOpened)).toBe(false);
    expect(scope.getState($$movieListIntent.outputs.$intent)).toEqual(intent);
  });

  it.each(["/movies/550", "/about", "/login", "/register?redirect=/movies/550"])(
    "cancels on unrelated navigation to %s",
    async (path) => {
      const { scope, history } = await setupSessionScope({ initialEntry: "/movies/603" });

      await allSettled($$movieListIntent.inputs.requested, { scope, params: intent });
      history.push(path);
      await allSettled(scope);

      expect(scope.getState($$movieListIntent.outputs.$intent)).toBeNull();
      expect(sessionStorage.getItem(MOVIE_LIST_INTENT_KEY)).toBeNull();
    },
  );

  it("logout cancels a pending operation", async () => {
    const { scope } = await setupSessionScope({ initialEntry: "/movies/603" });

    await allSettled($$movieListIntent.inputs.requested, { scope, params: intent });
    await allSettled($$session.inputs.signedOut, { scope });

    expect(scope.getState($$movieListIntent.outputs.$intent)).toBeNull();
    expect(sessionStorage.getItem(MOVIE_LIST_INTENT_KEY)).toBeNull();
  });

  it.each([
    "/movies/603",
    "/login?redirect=/movies/603",
    "/register?redirect=/movies/603",
    "/auth/oidc?provider=google&result=success",
    "/confirm-email?token=confirmation",
  ])("restores after a full reload at %s", async (initialEntry) => {
    saveMovieListIntent(storedIntent());

    const { scope } = await setupSessionScope({ initialEntry });

    expect(scope.getState($$movieListIntent.outputs.$intent)).toEqual(intent);
  });

  it("does not restore on a different movie", async () => {
    saveMovieListIntent(storedIntent());

    const { scope } = await setupSessionScope({ initialEntry: "/movies/550" });

    expect(scope.getState($$movieListIntent.outputs.$intent)).toBeNull();
    expect(sessionStorage.getItem(MOVIE_LIST_INTENT_KEY)).toBeNull();
  });

  it.each([
    "invalid-json",
    JSON.stringify({ intent }),
    JSON.stringify({ ...storedIntent(), expiresAt: 0 }),
    JSON.stringify({ ...storedIntent(), intent: { ...intent, selected: "true" } }),
    JSON.stringify({ ...storedIntent(), returnPath: "https://example.com/movies/603" }),
  ])("discards malformed or expired persisted data", async (value) => {
    sessionStorage.setItem(MOVIE_LIST_INTENT_KEY, value);

    const { scope } = await setupSessionScope({ initialEntry: "/movies/603" });

    expect(scope.getState($$movieListIntent.outputs.$intent)).toBeNull();
    expect(sessionStorage.getItem(MOVIE_LIST_INTENT_KEY)).toBeNull();
  });

  it("keeps modal continuation in memory when storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    const { scope } = await setupSessionScope({ initialEntry: "/movies/603" });

    await allSettled($$movieListIntent.inputs.requested, { scope, params: intent });

    expect(scope.getState($$movieListIntent.outputs.$intent)).toEqual(intent);
  });

  it("a late restore cannot resurrect a cancelled intent", async () => {
    const record = storedIntent();
    let resolve!: (value: { revision: number; record: typeof record }) => void;
    const scope = fork({
      handlers: [
        [
          $$movieListIntent.__.readRecordFx,
          () =>
            new Promise<{ revision: number; record: typeof record }>((complete) => {
              resolve = complete;
            }),
        ],
      ],
    });

    scopeBind(router.setHistory, { scope })(historyAdapter(createMemoryHistory({ initialEntries: ["/movies/603"] })));
    await vi.waitFor(() => expect(resolve).toBeTypeOf("function"));
    scopeBind($$movieListIntent.inputs.cancelled, { scope })();
    resolve({ revision: 0, record });
    await allSettled(scope);

    expect(scope.getState($$movieListIntent.outputs.$intent)).toBeNull();
  });

  it("a late request cannot replace a newer action after cancellation", async () => {
    const completions: (() => void)[] = [];
    const scope = fork({
      handlers: [
        [
          $$movieListIntent.__.createRecordFx,
          ({ intent, query, revision }: Parameters<typeof $$movieListIntent.__.createRecordFx>[0]) =>
            new Promise((resolve) => {
              completions.push(() => resolve({ record: createStoredIntent(intent, query), revision }));
            }),
        ],
      ],
    });

    await allSettled(router.setHistory, {
      scope,
      params: historyAdapter(createMemoryHistory({ initialEntries: ["/movies/603"] })),
    });
    scopeBind($$movieListIntent.inputs.requested, { scope })(intent);
    scopeBind($$movieListIntent.inputs.cancelled, { scope })();
    scopeBind($$movieListIntent.inputs.requested, { scope })({ ...intent, list: "watched" });

    completions[1]();
    await vi.waitFor(() =>
      expect(scope.getState($$movieListIntent.outputs.$intent)).toEqual({ ...intent, list: "watched" }),
    );
    completions[0]();
    await allSettled(scope);

    expect(scope.getState($$movieListIntent.outputs.$intent)).toEqual({ ...intent, list: "watched" });
  });
});
