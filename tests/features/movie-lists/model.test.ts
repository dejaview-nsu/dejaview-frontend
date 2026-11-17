import { invoke } from "@withease/factories";
import { allSettled, createEffect, fork, sample } from "effector";
import { describe, expect, it, vi } from "vitest";

import { createMovieListsFactory } from "@/features/movie-lists/model/lists";

import { type ListTypePath, transportFx, type UserMovieState } from "@/shared/api";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";

const empty = { want_to_watch: false, watched: false };
const guest = { status: "guest", userKey: null } as const;
const viewer = { status: "authenticated", userKey: "first_user" } as const;

const setup = () => {
  const $$model = invoke(createMovieListsFactory);
  const transport = createControlledTransport({ ignoreAbort: true });
  const intent = vi.fn();
  const login = vi.fn();
  const consumed = vi.fn();
  const intentFx = createEffect(intent);
  const loginFx = createEffect(login);
  const consumedFx = createEffect(consumed);

  sample({ clock: $$model.outputs.intentRequested, target: intentFx });

  sample({ clock: $$model.outputs.loginRequested, target: loginFx });

  sample({ clock: $$model.outputs.intentConsumed, target: consumedFx });

  const scope = fork({ handlers: [[transportFx, transport.transport]] });

  return { $$model, scope, transport, intent, login, consumed };
};

const load = async (context: ReturnType<typeof setup>, membership: UserMovieState = empty) => {
  const { $$model, scope, transport } = context;
  await allSettled($$model.inputs.sessionChanged, { scope, params: viewer });
  const loading = allSettled($$model.inputs.opened, { scope, params: "157336" });
  await transport.waitForCalls(1);
  transport.current().resolve(jsonResponse(200, membership));
  await loading;
};

describe("movie list controls", () => {
  it("does not request private state for guests and remembers an explicit add intent", async () => {
    const { $$model, scope, transport, intent, login } = setup();
    await allSettled($$model.inputs.opened, { scope, params: "157336" });
    expect(scope.getState($$model.outputs.$state).canToggle).toBe(false);
    await allSettled($$model.inputs.sessionChanged, { scope, params: guest });
    await allSettled($$model.inputs.togglePressed, { scope, params: "watched" });

    expect(transport.calls).toHaveLength(0);
    expect(intent).toHaveBeenCalledWith({ movieId: "157336", list: "watched", selected: true });
    expect(login).toHaveBeenCalledOnce();
    expect(scope.getState($$model.outputs.$state)).toMatchObject({ membership: empty, canToggle: true });
  });

  it.each(["want_to_watch", "watched"] as const)(
    "adds and removes %s independently and prevents duplicate writes",
    async (list) => {
      const context = setup();
      const { $$model, scope, transport } = context;
      const other: ListTypePath = list === "watched" ? "want_to_watch" : "watched";
      await load(context, { ...empty, [other]: true });

      const adding = allSettled($$model.inputs.togglePressed, { scope, params: list });
      const duplicate = allSettled($$model.inputs.togglePressed, { scope, params: list });
      await transport.waitForCalls(2);
      expect(transport.current().request).toMatchObject({ method: "PUT", path: `/users/me/lists/${list}/157336` });
      expect(scope.getState($$model.outputs.$state)).toMatchObject({ pending: true, canToggle: false });
      transport.current().resolve(jsonResponse(204, ""));
      await Promise.all([adding, duplicate]);
      expect(scope.getState($$model.outputs.$state).membership).toEqual({ watched: true, want_to_watch: true });

      const removing = allSettled($$model.inputs.togglePressed, { scope, params: list });
      await transport.waitForCalls(3);
      expect(transport.current().request.method).toBe("DELETE");
      transport.current().resolve(jsonResponse(204, ""));
      await removing;
      expect(scope.getState($$model.outputs.$state).membership).toEqual({ ...empty, [other]: true });
    },
  );

  it("replays an add idempotently when the movie was already in the user's list", async () => {
    const context = setup();
    const { $$model, scope, transport, consumed } = context;
    await load(context, { ...empty, watched: true });
    const replay = allSettled($$model.inputs.resumeRequested, {
      scope,
      params: { movieId: "157336", list: "watched", selected: true },
    });
    await transport.waitForCalls(2);
    expect(transport.current().request.method).toBe("PUT");
    transport.current().resolve(jsonResponse(204, ""));
    await replay;
    expect(consumed).toHaveBeenCalledOnce();
    expect(scope.getState($$model.outputs.$state).membership?.watched).toBe(true);
  });

  it("treats a state-read 401 as guest without opening login", async () => {
    const { $$model, scope, transport, login } = setup();
    await allSettled($$model.inputs.sessionChanged, { scope, params: viewer });
    const loading = allSettled($$model.inputs.opened, { scope, params: "157336" });
    await transport.waitForCalls(1);
    transport.current().resolve(jsonResponse(401, { code: "SESSION_EXPIRED", message: "Войдите снова", field: null }));
    await loading;

    expect(login).not.toHaveBeenCalled();
    expect(scope.getState($$model.outputs.$state)).toMatchObject({
      authenticated: false,
      membership: empty,
      canToggle: true,
      error: null,
    });
  });

  it("keeps the desired removal after an expired session and repeats it after login", async () => {
    const context = setup();
    const { $$model, scope, transport, intent, login } = context;
    await load(context, { ...empty, watched: true });
    const removing = allSettled($$model.inputs.togglePressed, { scope, params: "watched" });
    await transport.waitForCalls(2);
    transport.current().resolve(jsonResponse(401, { code: "SESSION_EXPIRED", message: "Войдите снова", field: null }));
    await removing;
    expect(login).toHaveBeenCalledOnce();
    const desired = { movieId: "157336", list: "watched" as const, selected: false };
    expect(intent.mock.calls[0][0]).toMatchObject(desired);
    expect(scope.getState($$model.outputs.$state).authenticated).toBe(false);

    const signedIn = allSettled($$model.inputs.sessionChanged, { scope, params: viewer });
    await transport.waitForCalls(3);
    transport.current().resolve(jsonResponse(200, { ...empty, watched: true }));
    await signedIn;
    const resuming = allSettled($$model.inputs.resumeRequested, { scope, params: desired });
    await transport.waitForCalls(4);
    expect(transport.current().request.method).toBe("DELETE");
    transport.current().resolve(jsonResponse(204, ""));
    await resuming;
    expect(scope.getState($$model.outputs.$state).membership).toEqual(empty);
  });

  it("keeps a failed write unchecked and retries the same idempotent operation", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;
    await load(context);
    const saving = allSettled($$model.inputs.togglePressed, { scope, params: "watched" });
    await transport.waitForCalls(2);
    transport
      .current()
      .resolve(jsonResponse(500, { code: "INTERNAL_ERROR", message: "Попробуйте позже", field: null }));
    await saving;
    expect(scope.getState($$model.outputs.$state)).toMatchObject({
      membership: empty,
      error: "Попробуйте позже",
      pending: false,
    });
    const retry = allSettled($$model.inputs.retryPressed, { scope });
    const duplicate = allSettled($$model.inputs.retryPressed, { scope });
    await transport.waitForCalls(3);
    expect(transport.current().request.method).toBe("PUT");
    transport.current().resolve(jsonResponse(204, ""));
    await Promise.all([retry, duplicate]);
    expect(scope.getState($$model.outputs.$state)).toMatchObject({
      membership: { ...empty, watched: true },
      error: null,
    });
  });

  it("retries failed state loading without allowing a toggle of unknown membership", async () => {
    const { $$model, scope, transport } = setup();
    await allSettled($$model.inputs.sessionChanged, { scope, params: viewer });
    const loading = allSettled($$model.inputs.opened, { scope, params: "157336" });
    await transport.waitForCalls(1);
    transport
      .current()
      .resolve(jsonResponse(500, { code: "INTERNAL_ERROR", message: "Попробуйте позже", field: null }));
    await loading;
    await allSettled($$model.inputs.togglePressed, { scope, params: "watched" });
    expect(transport.calls).toHaveLength(1);
    const retry = allSettled($$model.inputs.retryPressed, { scope });
    const duplicate = allSettled($$model.inputs.retryPressed, { scope });
    await transport.waitForCalls(2);
    transport.current().resolve(jsonResponse(200, empty));
    await Promise.all([retry, duplicate]);
    expect(scope.getState($$model.outputs.$state)).toMatchObject({ canToggle: true, error: null });
  });

  it.each([200, 401, 500])(
    "aborts on close and ignores a late write response %s after reopening the same movie",
    async (status) => {
      const context = setup();
      const { $$model, scope, transport, login } = context;
      await load(context);
      const saving = allSettled($$model.inputs.togglePressed, { scope, params: "watched" });
      await transport.waitForCalls(2);
      const closing = allSettled($$model.inputs.closed, { scope });
      const reopening = allSettled($$model.inputs.opened, { scope, params: "157336" });
      await transport.waitForCalls(3);
      expect(transport.calls[1].request.signal?.aborted).toBe(true);
      transport.calls[2].resolve(jsonResponse(200, { ...empty, want_to_watch: true }));
      transport.calls[1].resolve(
        jsonResponse(
          status,
          status === 200
            ? ""
            : { code: status === 401 ? "SESSION_EXPIRED" : "INTERNAL_ERROR", message: "Старый ответ", field: null },
        ),
      );
      await Promise.all([saving, closing, reopening]);
      expect(login).not.toHaveBeenCalled();
      expect(scope.getState($$model.outputs.$state)).toMatchObject({
        membership: { ...empty, want_to_watch: true },
        error: null,
        pending: false,
      });

      const restarted = allSettled($$model.inputs.togglePressed, { scope, params: "watched" });
      await transport.waitForCalls(4);
      transport.current().resolve(jsonResponse(204, ""));
      await restarted;
      expect(scope.getState($$model.outputs.$state).membership?.watched).toBe(true);
    },
  );

  it("discards private state and a late response after switching accounts", async () => {
    const { $$model, scope, transport } = setup();
    await allSettled($$model.inputs.sessionChanged, { scope, params: viewer });
    const first = allSettled($$model.inputs.opened, { scope, params: "157336" });
    await transport.waitForCalls(1);
    const switching = allSettled($$model.inputs.sessionChanged, {
      scope,
      params: { ...viewer, userKey: "second_user" },
    });
    await transport.waitForCalls(2);
    expect(transport.calls[0].request.signal?.aborted).toBe(true);
    transport.calls[1].resolve(jsonResponse(200, empty));
    transport.calls[0].resolve(jsonResponse(200, { watched: true, want_to_watch: true }));
    await Promise.all([first, switching]);
    expect(scope.getState($$model.outputs.$state).membership).toEqual(empty);
  });
});
