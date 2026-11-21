import { invoke } from "@withease/factories";
import { allSettled, fork } from "effector";
import { describe, expect, it, vi } from "vitest";

import { createProfileFactory } from "@/pages/profile/model/profile";

import { transportFx } from "@/shared/api";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";

const profile = (watched: number) => ({
  username: "movie_fan_42",
  birth_year: 2001,
  registered_at: "2026-09-14T09:00:00Z",
  stats: { watched_count: watched, ratings_count: 38, average_rating: 7.8, reviews_count: 12 },
});

const serverError = { code: "INTERNAL_ERROR", message: "Произошла ошибка. Попробуйте позже", field: null };

const setup = () => {
  const $$model = invoke(createProfileFactory);
  const transport = createControlledTransport({ ignoreAbort: true });
  const scope = fork({ handlers: [[transportFx, transport.transport]] });

  return { $$model, scope, transport };
};

const open = async ({ $$model, scope, transport }: ReturnType<typeof setup>, body: unknown = profile(4)) => {
  const count = transport.calls.length;
  const opening = allSettled($$model.inputs.opened, { scope });
  await transport.waitForCalls(count + 1);
  transport.current().resolve(jsonResponse(200, body));
  await opening;
};

describe("profile model", () => {
  it("loads the profile of the session owner", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;

    const opening = allSettled($$model.inputs.opened, { scope });
    await transport.waitForCalls(1);

    expect(transport.current().request).toMatchObject({ method: "GET", path: "/users/me" });
    expect(scope.getState($$model.outputs.$status)).toBe("loading");

    transport.current().resolve(jsonResponse(200, profile(4)));
    await opening;

    expect(scope.getState($$model.outputs.$status)).toBe("ready");
    expect(scope.getState($$model.outputs.$profile)).toEqual(profile(4));
  });

  it("shows a failure and loads again on retry", async () => {
    const { $$model, scope, transport } = setup();

    const opening = allSettled($$model.inputs.opened, { scope });
    await transport.waitForCalls(1);
    transport.current().resolve(jsonResponse(500, serverError));
    await opening;

    expect(scope.getState($$model.outputs.$status)).toBe("failed");

    const retrying = allSettled($$model.inputs.retryPressed, { scope });
    await transport.waitForCalls(2);

    expect(scope.getState($$model.outputs.$status)).toBe("loading");

    transport.current().resolve(jsonResponse(200, profile(1)));
    await retrying;

    expect(scope.getState($$model.outputs.$profile)?.stats.watched_count).toBe(1);
  });

  it("refreshes in the background without hiding the loaded profile", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;
    await open(context);

    const refreshing = allSettled($$model.inputs.refreshed, { scope });
    await transport.waitForCalls(2);

    expect(scope.getState($$model.outputs.$status)).toBe("ready");
    expect(scope.getState($$model.outputs.$profile)?.stats.watched_count).toBe(4);

    transport.current().resolve(jsonResponse(200, profile(3)));
    await refreshing;

    expect(scope.getState($$model.outputs.$profile)?.stats.watched_count).toBe(3);
  });

  it("keeps the loaded profile when a background refresh fails", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;
    await open(context);

    const refreshing = allSettled($$model.inputs.refreshed, { scope });
    await transport.waitForCalls(2);
    transport.current().resolve(jsonResponse(500, serverError));
    await refreshing;

    expect(scope.getState($$model.outputs.$status)).toBe("ready");
    expect(scope.getState($$model.outputs.$profile)?.stats.watched_count).toBe(4);
  });

  it("does not reload when opened again while ready", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;
    await open(context);

    await allSettled($$model.inputs.opened, { scope });

    expect(transport.calls).toHaveLength(1);
  });

  it("aborts the request on close and ignores the late response", async () => {
    const { $$model, scope, transport } = setup();

    const opening = allSettled($$model.inputs.opened, { scope });
    await transport.waitForCalls(1);
    const closing = allSettled($$model.inputs.closed, { scope });
    await vi.waitFor(() => expect(transport.calls[0].request.signal?.aborted).toBe(true));

    transport.calls[0].resolve(jsonResponse(200, profile(4)));
    await Promise.all([opening, closing]);

    expect(scope.getState($$model.outputs.$status)).toBe("idle");
    expect(scope.getState($$model.outputs.$profile)).toBeNull();
  });

  it("ignores an older refresh that finishes after a newer one", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;
    await open(context);

    const first = allSettled($$model.inputs.refreshed, { scope });
    await transport.waitForCalls(2);
    const second = allSettled($$model.inputs.refreshed, { scope });
    await transport.waitForCalls(3);

    transport.calls[2].resolve(jsonResponse(200, profile(2)));
    transport.calls[1].resolve(jsonResponse(200, profile(3)));
    await Promise.all([first, second]);

    expect(scope.getState($$model.outputs.$profile)?.stats.watched_count).toBe(2);
  });
});
