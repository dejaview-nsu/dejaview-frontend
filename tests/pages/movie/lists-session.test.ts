import { allSettled } from "effector";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { $$movieLists } from "@/pages/movie/model/page";

import { $$movieListIntent } from "@/features/movie-lists";

import { $$session } from "@/entities/session";

import { type SessionInfo, type Transport } from "@/shared/api";
import { createMockStorage, createMockTransport, MOCK_STORAGE_KEYS, NO_MOCK_DELAYS } from "@/shared/api/mocks";
import { router } from "@/shared/routes";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";
import { setupApiScope } from "../../session-scope";

const movieId = "157336";
const listPath = `/users/me/lists/watched/${movieId}`;
const statePath = `/users/me/movies/${movieId}`;
const empty = { want_to_watch: false, watched: false };
const expired = () => jsonResponse(401, { code: "SESSION_EXPIRED", message: "Войдите снова", field: null });

const setup = async ({
  selected = false,
  wrap = (transport) => transport,
}: {
  selected?: boolean;
  wrap?: (transport: Transport) => Transport;
} = {}) => {
  const storage = createMockStorage(() => null);
  storage.set(MOCK_STORAGE_KEYS.session, "authenticated");
  const mock = createMockTransport({ storage, delays: NO_MOCK_DELAYS });

  if (selected) await mock({ method: "PUT", path: listPath, timeouts: { response: 1000 } });

  const transport = vi.fn(wrap(mock));
  const { scope } = await setupApiScope({ initialEntry: `/movies/${movieId}?source=search`, transport });
  const writes = () =>
    transport.mock.calls.filter(([request]) => request.method === "PUT" || request.method === "DELETE");
  const stateReads = () => transport.mock.calls.filter(([request]) => request.path === statePath);

  return { scope, storage, mock, transport, writes, stateReads };
};

beforeEach(() => sessionStorage.clear());

describe("movie lists and session integration", () => {
  it("silently invalidates an expired session discovered during passive state loading", async () => {
    const { scope, stateReads, writes } = await setup({
      wrap: (mock) => (request) => (request.path === statePath ? Promise.resolve(expired()) : mock(request)),
    });

    expect(stateReads()).toHaveLength(1);
    expect(writes()).toHaveLength(0);
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState($$session.outputs.$isLoginDialogOpened)).toBe(false);
    expect(scope.getState($$movieListIntent.outputs.$intent)).toBeNull();
    expect(scope.getState($$movieLists.outputs.$state)).toMatchObject({
      authenticated: false,
      membership: empty,
      canToggle: true,
      error: null,
    });
  });

  it.each([false, true])(
    "retains selected=%s across a write 401 and replays exactly once after reauthentication",
    async (selected) => {
      let shouldExpire = true;
      const { scope, writes } = await setup({
        selected,
        wrap: (mock) => (request) => {
          if (request.path === listPath && shouldExpire) {
            shouldExpire = false;

            return Promise.resolve(expired());
          }

          return mock(request);
        },
      });

      await allSettled($$movieLists.inputs.togglePressed, { scope, params: "watched" });

      expect(scope.getState($$session.outputs.$status)).toBe("guest");
      expect(scope.getState($$session.outputs.$isLoginDialogOpened)).toBe(true);
      expect(scope.getState($$movieListIntent.outputs.$intent)).toMatchObject({
        movieId,
        list: "watched",
        selected: !selected,
      });
      expect(writes()).toHaveLength(1);

      await allSettled($$session.inputs.signedIn, {
        scope,
        params: { login: "movie_fan_42", password: "Password123!" },
      });

      expect(writes().map(([request]) => request.method)).toEqual(selected ? ["DELETE", "DELETE"] : ["PUT", "PUT"]);
      expect(scope.getState($$movieLists.outputs.$state).membership).toEqual({ ...empty, watched: !selected });
      expect(scope.getState($$movieListIntent.outputs.$intent)).toBeNull();
      expect(scope.getState($$session.outputs.$isLoginDialogOpened)).toBe(false);
      expect(scope.getState(router.$path)).toBe(`/movies/${movieId}`);
      expect(scope.getState(router.$query)).toEqual({ source: "search" });

      await allSettled($$session.inputs.sessionCheckRequested, { scope });

      expect(writes()).toHaveLength(2);
    },
  );

  it("ignores an old write 401 after navigating to another movie", async () => {
    const controlled = createControlledTransport({ ignoreAbort: true });
    const { scope } = await setup({
      wrap: (mock) => (request) => (request.path === listPath ? controlled.transport(request) : mock(request)),
    });
    const saving = allSettled($$movieLists.inputs.togglePressed, { scope, params: "watched" });
    await controlled.waitForCalls(1);
    const navigating = allSettled(router.navigate, { scope, params: { path: "/movies/603" } });

    await vi.waitFor(() =>
      expect(scope.getState($$movieLists.outputs.$state)).toMatchObject({ movieId: "603", status: "ready" }),
    );
    expect(controlled.current().request.signal?.aborted).toBe(true);
    controlled.current().resolve(expired());
    await Promise.all([saving, navigating]);

    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
    expect(scope.getState($$session.outputs.$isLoginDialogOpened)).toBe(false);
    expect(scope.getState($$movieListIntent.outputs.$intent)).toBeNull();
    expect(scope.getState($$movieLists.outputs.$state)).toMatchObject({
      movieId: "603",
      membership: empty,
      error: null,
    });
  });

  it("refreshes membership on return to the same movie while query-only changes preserve loaded state", async () => {
    const { scope, mock, stateReads } = await setup();
    expect(stateReads()).toHaveLength(1);

    await allSettled(router.navigate, { scope, params: { path: `/movies/${movieId}?source=profile` } });
    expect(stateReads()).toHaveLength(1);
    await allSettled(router.navigate, { scope, params: { path: "/about" } });
    await mock({ method: "PUT", path: listPath, timeouts: { response: 1000 } });
    await allSettled(router.navigate, { scope, params: { path: `/movies/${movieId}` } });

    expect(stateReads()).toHaveLength(2);
    expect(scope.getState($$movieLists.outputs.$state).membership).toEqual({ ...empty, watched: true });
  });

  it("clears the old account's membership and ignores its pending write when the account changes", async () => {
    const controlled = createControlledTransport({ ignoreAbort: true });
    const { scope, mock, stateReads } = await setup({
      selected: true,
      wrap: (mock) => (request) => (request.path === listPath ? controlled.transport(request) : mock(request)),
    });
    const saving = allSettled($$movieLists.inputs.togglePressed, { scope, params: "watched" });
    await controlled.waitForCalls(1);

    const response = await mock({
      method: "POST",
      path: "/auth/login",
      body: { login: "second_user", password: "Password123!" },
      timeouts: { response: 1000 },
    });
    const switching = allSettled($$session.inputs.sessionCreated, {
      scope,
      params: JSON.parse(response.bodyText) as SessionInfo,
    });

    expect(scope.getState($$movieLists.outputs.$state).membership).toBeNull();
    await vi.waitFor(() =>
      expect(scope.getState($$movieLists.outputs.$state)).toMatchObject({ status: "ready", membership: empty }),
    );
    expect(controlled.current().request.signal?.aborted).toBe(true);
    controlled.current().resolve(expired());
    await Promise.all([saving, switching]);

    expect(stateReads()).toHaveLength(2);
    expect(scope.getState($$session.outputs.$user)?.username).toBe("second_user");
    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
    expect(scope.getState($$session.outputs.$isLoginDialogOpened)).toBe(false);
    expect(scope.getState($$movieListIntent.outputs.$intent)).toBeNull();
    expect(scope.getState($$movieLists.outputs.$state).membership).toEqual(empty);
  });
});
