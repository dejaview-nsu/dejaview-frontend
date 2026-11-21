import { invoke } from "@withease/factories";
import { allSettled, createEffect, fork, sample } from "effector";
import { describe, expect, it, vi } from "vitest";

import { createListRemovalFactory } from "@/features/movie-lists";

import { transportFx } from "@/shared/api";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";

const serverError = { code: "INTERNAL_ERROR", message: "Произошла ошибка. Попробуйте позже", field: null };

const setup = () => {
  const $$model = invoke(createListRemovalFactory);
  const transport = createControlledTransport({ ignoreAbort: true });
  const removed = vi.fn();
  const failed = vi.fn();
  const removedFx = createEffect(removed);
  const failedFx = createEffect(failed);

  sample({ clock: $$model.outputs.removed, target: removedFx });

  sample({ clock: $$model.outputs.failed, target: failedFx });

  const scope = fork({ handlers: [[transportFx, transport.transport]] });

  return { $$model, scope, transport, removed, failed };
};

describe("list removal", () => {
  it("removes a movie from the list and reports it", async () => {
    const { $$model, scope, transport, removed, failed } = setup();

    const removing = allSettled($$model.inputs.removePressed, { scope, params: { list: "watched", movieId: 603 } });
    await transport.waitForCalls(1);

    expect(transport.current().request).toMatchObject({ method: "DELETE", path: "/users/me/lists/watched/603" });
    expect(scope.getState($$model.outputs.$pending)).toEqual([{ list: "watched", movieId: 603 }]);

    transport.current().resolve(jsonResponse(204, ""));
    await removing;

    expect(removed).toHaveBeenCalledExactlyOnceWith({ list: "watched", movieId: 603 });
    expect(failed).not.toHaveBeenCalled();
    expect(scope.getState($$model.outputs.$pending)).toEqual([]);
  });

  it("ignores a repeated press while the same removal is pending", async () => {
    const { $$model, scope, transport, removed } = setup();
    const params = { list: "want_to_watch", movieId: 157336 } as const;

    const first = allSettled($$model.inputs.removePressed, { scope, params });
    const second = allSettled($$model.inputs.removePressed, { scope, params });
    await transport.waitForCalls(1);
    await Promise.resolve();

    expect(transport.calls).toHaveLength(1);

    transport.current().resolve(jsonResponse(204, ""));
    await Promise.all([first, second]);

    expect(removed).toHaveBeenCalledOnce();
  });

  it("removes different movies independently", async () => {
    const { $$model, scope, transport, removed } = setup();

    const first = allSettled($$model.inputs.removePressed, { scope, params: { list: "watched", movieId: 603 } });
    const second = allSettled($$model.inputs.removePressed, { scope, params: { list: "watched", movieId: 423 } });
    const otherList = allSettled($$model.inputs.removePressed, {
      scope,
      params: { list: "want_to_watch", movieId: 603 },
    });
    await transport.waitForCalls(3);

    expect(scope.getState($$model.outputs.$pending)).toHaveLength(3);

    transport.calls[1].resolve(jsonResponse(204, ""));
    await vi.waitFor(() => expect(removed).toHaveBeenCalledWith({ list: "watched", movieId: 423 }));

    expect(scope.getState($$model.outputs.$pending)).toEqual([
      { list: "watched", movieId: 603 },
      { list: "want_to_watch", movieId: 603 },
    ]);

    transport.calls[0].resolve(jsonResponse(204, ""));
    transport.calls[2].resolve(jsonResponse(204, ""));
    await Promise.all([first, second, otherList]);

    expect(removed).toHaveBeenCalledTimes(3);
    expect(scope.getState($$model.outputs.$pending)).toEqual([]);
  });

  it("reports a failed removal and allows another attempt", async () => {
    const { $$model, scope, transport, removed, failed } = setup();
    const params = { list: "watched", movieId: 603 } as const;

    const removing = allSettled($$model.inputs.removePressed, { scope, params });
    await transport.waitForCalls(1);
    transport.current().resolve(jsonResponse(500, serverError));
    await removing;

    expect(removed).not.toHaveBeenCalled();
    expect(failed).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ ...params, error: expect.objectContaining({ message: serverError.message }) }),
    );
    expect(scope.getState($$model.outputs.$pending)).toEqual([]);

    const retry = allSettled($$model.inputs.removePressed, { scope, params });
    await transport.waitForCalls(2);
    transport.current().resolve(jsonResponse(204, ""));
    await retry;

    expect(removed).toHaveBeenCalledExactlyOnceWith(params);
  });

  it("aborts pending removals on reset and ignores late responses", async () => {
    const { $$model, scope, transport, removed, failed } = setup();

    const removing = allSettled($$model.inputs.removePressed, { scope, params: { list: "watched", movieId: 603 } });
    await transport.waitForCalls(1);
    const signal = transport.current().request.signal;

    const resetting = allSettled($$model.inputs.reset, { scope });

    await vi.waitFor(() => expect(signal?.aborted).toBe(true));
    expect(scope.getState($$model.outputs.$pending)).toEqual([]);

    transport.current().resolve(jsonResponse(204, ""));
    await Promise.all([removing, resetting]);

    expect(removed).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
  });
});
