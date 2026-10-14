import { invoke } from "@withease/factories";
import { allSettled, createEvent, createStore, type EffectParams, fork, sample, scopeBind } from "effector";
import { describe, expect, it, vi } from "vitest";

import { createSearchByFileFactory, fileConstraints } from "@/features/search-by-file";

import { transportFx } from "@/shared/api";
import { validateFileSelection } from "@/shared/lib/files";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";

const imageFile = () => new File(["image"], "frame.png", { type: "image/png" });

const movie = { movie_id: 1, title: "Фильм", year: null, poster_url: null, overview: null };

describe("search by file feature", () => {
  it.each(["cancel", "replace"] as const)("%s clears the search waiting for login", async (action) => {
    const accessChanged = createEvent<boolean>();
    const $allowed = createStore(true);

    sample({ clock: accessChanged, target: $allowed });

    const model = invoke(createSearchByFileFactory, { mode: "image", $allowed });
    const controlled = createControlledTransport();
    const scope = fork({
      handlers: [
        [model.__.validateFx, () => {}],
        [transportFx, controlled.transport],
      ],
    });

    await allSettled(model.inputs.filesSelected, { scope, params: [imageFile()] });
    scopeBind(model.inputs.searchPressed, { scope })();
    await controlled.waitForCalls(1);
    controlled.current().resolve(jsonResponse(401, { code: "SESSION_EXPIRED", message: "Сессия истекла" }));
    await allSettled(scope);
    await allSettled(accessChanged, { scope, params: false });

    if (action === "cancel") await allSettled(model.inputs.cancelled, { scope });
    else await allSettled(model.inputs.filesSelected, { scope, params: [imageFile()] });

    await allSettled(accessChanged, { scope, params: true });
    expect(controlled.calls).toHaveLength(1);
    expect(scope.getState(model.outputs.$pending)).toBe(false);
  });

  it("losing access cancels an upload without relying on a widget", async () => {
    const accessChanged = createEvent<boolean>();
    const $allowed = createStore(true);

    sample({ clock: accessChanged, target: $allowed });

    const model = invoke(createSearchByFileFactory, { mode: "image", $allowed });
    const controlled = createControlledTransport({ ignoreAbort: true });
    const scope = fork({
      handlers: [
        [model.__.validateFx, () => {}],
        [transportFx, controlled.transport],
      ],
    });
    const file = imageFile();

    await allSettled(model.inputs.filesSelected, { scope, params: [file] });
    scopeBind(model.inputs.searchPressed, { scope })();
    await controlled.waitForCalls(1);
    const call = controlled.current();

    scopeBind(accessChanged, { scope })(false);
    expect(call.request.signal?.aborted).toBe(true);
    expect(scope.getState(model.outputs.$pending)).toBe(false);

    call.resolve(jsonResponse(200, { results: [movie] }));
    await allSettled(scope);
    expect(scope.getState(model.outputs.$state).result).toBeNull();
    expect(scope.getState(model.outputs.$files)).toEqual([file]);
  });

  it("ignores validation from a previous access period and allows a fresh search", async () => {
    const accessChanged = createEvent<boolean>();
    const $allowed = createStore(true);

    sample({ clock: accessChanged, target: $allowed });

    const model = invoke(createSearchByFileFactory, { mode: "image", $allowed });
    let finishValidation!: () => void;
    const validation = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishValidation = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const controlled = createControlledTransport();
    const scope = fork({
      handlers: [
        [model.__.validateFx, validation],
        [transportFx, controlled.transport],
      ],
    });

    await allSettled(model.inputs.filesSelected, { scope, params: [imageFile()] });
    scopeBind(model.inputs.searchPressed, { scope })();
    await vi.waitFor(() => expect(finishValidation).toBeDefined());
    expect(scope.getState(model.outputs.$pending)).toBe(true);

    scopeBind(accessChanged, { scope })(false);
    expect(scope.getState(model.outputs.$pending)).toBe(false);
    scopeBind(accessChanged, { scope })(true);
    finishValidation();
    await allSettled(scope);
    expect(controlled.calls).toHaveLength(0);

    scopeBind(model.inputs.searchPressed, { scope })();
    await controlled.waitForCalls(1);
    controlled.current().resolve(jsonResponse(200, { results: [movie] }));
    await allSettled(scope);
    expect(scope.getState(model.outputs.$state).result).toEqual(movie);
  });

  it("cannot start validation or a request when search is not allowed", async () => {
    const model = invoke(createSearchByFileFactory, { mode: "image", $allowed: createStore(false) });
    const validate = vi.fn();
    const transport = vi.fn();
    const scope = fork({
      handlers: [
        [model.__.validateFx, validate],
        [transportFx, transport],
      ],
    });
    const file = imageFile();
    await allSettled(model.inputs.filesSelected, { scope, params: [file] });
    await allSettled(model.inputs.searchPressed, { scope });
    expect(validate).not.toHaveBeenCalled();
    expect(transport).not.toHaveBeenCalled();
    expect(scope.getState(model.outputs.$files)).toEqual([file]);
    expect(scope.getState(model.outputs.$pending)).toBe(false);
  });

  it("keeps image and video instances independent while cancelling one request", async () => {
    const $allowed = createStore(true);
    const image = invoke(createSearchByFileFactory, { mode: "image", $allowed });
    const video = invoke(createSearchByFileFactory, { mode: "video", $allowed });
    const controlled = createControlledTransport();
    const scope = fork({
      handlers: [
        [transportFx, controlled.transport],
        [
          image.__.validateFx,
          ({ files }: EffectParams<typeof image.__.validateFx>) => validateFileSelection(files, fileConstraints.image),
        ],
        [
          video.__.validateFx,
          ({ files }: EffectParams<typeof video.__.validateFx>) => validateFileSelection(files, fileConstraints.video),
        ],
      ],
    });
    await allSettled(image.inputs.filesSelected, { scope, params: [imageFile()] });
    await allSettled(video.inputs.filesSelected, {
      scope,
      params: [new File(["video"], "scene.mp4", { type: "video/mp4" })],
    });
    scopeBind(image.inputs.searchPressed, { scope })();
    await controlled.waitForCalls(1);
    const imageCall = controlled.current();
    scopeBind(video.inputs.searchPressed, { scope })();
    await controlled.waitForCalls(2);
    const videoCall = controlled.current();
    scopeBind(image.inputs.cancelled, { scope })();
    expect(imageCall.request.signal?.aborted).toBe(true);
    expect(videoCall.request.signal?.aborted).toBe(false);
    videoCall.resolve(jsonResponse(200, { results: [movie] }));
    await allSettled(scope);
    expect(scope.getState(image.outputs.$state).result).toBeNull();
    expect(scope.getState(video.outputs.$state).result).toEqual(movie);
    expect(scope.getState(image.outputs.$files)[0].name).toBe("frame.png");
    expect(scope.getState(video.outputs.$files)[0].name).toBe("scene.mp4");
  });
});
