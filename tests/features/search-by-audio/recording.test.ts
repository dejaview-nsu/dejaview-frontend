import { invoke } from "@withease/factories";
import { allSettled, createEvent, createStore, type EffectParams, fork, sample, scopeBind } from "effector";
import { describe, expect, it, vi } from "vitest";

import { audioRecordingMessages, checkAudio, createSearchByAudioFactory } from "@/features/search-by-audio";
import type { AudioRecording } from "@/features/search-by-audio/lib/record-audio";

const clip = new File(["wav"], "Запись с микрофона.wav", { type: "audio/wav" });

const setup = ({ manualPermission = false, manualEncoding = false, denied = false } = {}) => {
  const accessChanged = createEvent<boolean>();
  const $allowed = createStore(true);

  sample({ clock: accessChanged, target: $allowed });

  const $$model = invoke(createSearchByAudioFactory, { $allowed });
  const $$recording = $$model.__.$$recording;
  const calls: { signal: AbortSignal; resolve: () => void; recorder: AudioRecording }[] = [];
  const encoding: { resolve: (file: File) => void }[] = [];
  const cancel = vi.fn();
  const stop = vi.fn(() =>
    manualEncoding ? new Promise<File>((resolve) => encoding.push({ resolve })) : Promise.resolve(clip),
  );
  const start = vi.fn((call: EffectParams<typeof $$recording.__.startFx>) => {
    if (denied) throw new DOMException("Denied", "NotAllowedError");
    const recorder = { stop, cancel };
    return new Promise<typeof call & { recorder: AudioRecording }>((resolve) => {
      calls.push({ signal: call.controller.signal, resolve: () => resolve({ ...call, recorder }), recorder });
      if (!manualPermission) calls.at(-1)!.resolve();
    });
  });
  const scope = fork({
    handlers: [
      [$$recording.__.startFx, start],
      [$$model.__.checkFx, ({ files }: { files: File[] }) => checkAudio(files, async () => 5)],
    ],
  });
  const state = () => scope.getState($$model.outputs.$recording);
  const fire = (event: typeof $$recording.inputs.started) => scopeBind(event, { scope })();

  return { $$model, $$recording, scope, state, fire, calls, encoding, start, stop, cancel, accessChanged };
};

describe("audio recording model", () => {
  it("records, encodes WAV, validates and preserves the new file", async () => {
    const ctx = setup();
    await allSettled(ctx.$$model.inputs.recordingStarted, { scope: ctx.scope });
    expect(ctx.state().status).toBe("recording");
    await allSettled(ctx.$$model.inputs.recordingStopped, { scope: ctx.scope });
    expect(ctx.stop).toHaveBeenCalledOnce();
    expect(ctx.calls[0].signal.aborted).toBe(true);
    expect(ctx.state().status).toBe("idle");
    expect(ctx.scope.getState(ctx.$$model.outputs.$state)).toMatchObject({
      files: [clip],
      check: { status: "valid", durationSeconds: 5 },
    });
  });

  it("permission denial shows an actionable message and allows trying again", async () => {
    const ctx = setup({ denied: true });
    await allSettled(ctx.$$model.inputs.recordingStarted, { scope: ctx.scope });
    expect(ctx.scope.getState(ctx.$$model.outputs.$state).error).toBe(audioRecordingMessages.permission);
    expect(ctx.state().status).toBe("idle");
    await allSettled(ctx.$$model.inputs.recordingStarted, { scope: ctx.scope });
    expect(ctx.start).toHaveBeenCalledTimes(2);
  });

  it("cancels while waiting for permission and disposes the late recorder", async () => {
    const ctx = setup({ manualPermission: true });
    ctx.fire(ctx.$$model.inputs.recordingStarted);
    await vi.waitFor(() => expect(ctx.calls).toHaveLength(1));
    expect(ctx.state().status).toBe("requesting");
    ctx.fire(ctx.$$model.inputs.recordingCancelled);
    expect(ctx.calls[0].signal.aborted).toBe(true);
    ctx.calls[0].resolve();
    await allSettled(ctx.scope);
    expect(ctx.cancel).toHaveBeenCalled();
    expect(ctx.state().status).toBe("idle");
    expect(ctx.scope.getState(ctx.$$model.outputs.$state).files).toEqual([]);
  });

  it("an old permission response cannot replace a restarted recording", async () => {
    const ctx = setup({ manualPermission: true });
    ctx.fire(ctx.$$model.inputs.recordingStarted);
    await vi.waitFor(() => expect(ctx.calls).toHaveLength(1));
    ctx.fire(ctx.$$model.inputs.recordingCancelled);
    ctx.fire(ctx.$$model.inputs.recordingStarted);
    await vi.waitFor(() => expect(ctx.calls).toHaveLength(2));
    ctx.calls[1].resolve();
    ctx.calls[0].resolve();
    await allSettled(ctx.scope);
    expect(ctx.state().status).toBe("recording");
    expect(ctx.calls[1].signal.aborted).toBe(false);
    await allSettled(ctx.$$model.inputs.recordingCancelled, { scope: ctx.scope });
  });

  it.each(["cancel", "replace", "deactivate", "logout"])("%s discards a late encoded recording", async (action) => {
    const ctx = setup({ manualEncoding: true });
    await allSettled(ctx.$$model.inputs.recordingStarted, { scope: ctx.scope });
    ctx.fire(ctx.$$model.inputs.recordingStopped);
    expect(ctx.state().status).toBe("encoding");
    const replacement = new File(["mp3"], "replacement.mp3", { type: "audio/mpeg" });
    if (action === "cancel") ctx.fire(ctx.$$model.inputs.recordingCancelled);
    if (action === "deactivate") ctx.fire(ctx.$$model.inputs.deactivated);
    if (action === "logout") scopeBind(ctx.accessChanged, { scope: ctx.scope })(false);
    if (action === "replace") scopeBind(ctx.$$model.inputs.filesSelected, { scope: ctx.scope })([replacement]);
    expect(ctx.calls[0].signal.aborted).toBe(true);
    ctx.encoding[0].resolve(clip);
    await allSettled(ctx.scope);
    expect(ctx.state().status).toBe("idle");
    expect(ctx.scope.getState(ctx.$$model.outputs.$state).files).toEqual(action === "replace" ? [replacement] : []);
  });

  it("blocks search and duplicate recording starts while recording", async () => {
    const ctx = setup();
    await allSettled(ctx.$$model.inputs.recordingStarted, { scope: ctx.scope });
    await allSettled(ctx.$$model.inputs.recordingStarted, { scope: ctx.scope });
    await allSettled(ctx.$$model.inputs.searchPressed, { scope: ctx.scope });
    expect(ctx.start).toHaveBeenCalledOnce();
    expect(ctx.scope.getState(ctx.$$model.outputs.$pending)).toBe(false);
    expect(ctx.scope.getState(ctx.$$model.outputs.$state).error).toBeNull();
    await allSettled(ctx.$$model.inputs.recordingCancelled, { scope: ctx.scope });
  });
});
