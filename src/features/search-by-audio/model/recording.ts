import { createFactory } from "@withease/factories";
import { combine, createEffect, createEvent, createStore, sample, scopeBind, type Store } from "effector";
import { readonly } from "patronum";

import { audioRecordingMessages } from "../config/audio";
import { type AudioRecording, startAudioRecording } from "../lib/record-audio";

type RecordingStatus = "idle" | "requesting" | "recording" | "encoding";
type RecordingCall = { id: number; controller: AbortController };
type ReadyCall = RecordingCall & { recorder: AudioRecording };

const recordingError = (error: Error): string => {
  if (error.name === "NotAllowedError" || error.name === "SecurityError") return audioRecordingMessages.permission;
  if (error.name === "NotSupportedError") return audioRecordingMessages.unsupported;
  return audioRecordingMessages.unavailable;
};

export const createAudioRecordingFactory = createFactory(({ $allowed }: { $allowed: Store<boolean> }) => {
  const started = createEvent();
  const stopped = createEvent();
  const cancelled = createEvent();
  const fileRecorded = createEvent<File>();
  const elapsed = createEvent<{ id: number; seconds: number }>();
  const limitReached = createEvent<number>();
  const captureFailed = createEvent<number>();
  const levelChanged = createEvent<{ id: number; level: number }>();

  const createCallFx = createEffect((id: number): RecordingCall => ({ id, controller: new AbortController() }));
  const startFx = createEffect<RecordingCall, ReadyCall>(async (call) => {
    const reportElapsed = scopeBind(elapsed, { safe: true });
    const reportLimit = scopeBind(limitReached, { safe: true });
    const reportLevel = scopeBind(levelChanged, { safe: true });
    const reportFailure = scopeBind(captureFailed, { safe: true });
    const recorder = await startAudioRecording({
      signal: call.controller.signal,
      onElapsed: (seconds) => reportElapsed({ id: call.id, seconds }),
      onLimit: () => reportLimit(call.id),
      onError: () => reportFailure(call.id),
      onLevel: (level) => reportLevel({ id: call.id, level }),
    });
    return { ...call, recorder };
  });
  const stopFx = createEffect<ReadyCall, File>(({ recorder }) => recorder.stop());
  const cancelFx = createEffect((call: RecordingCall | ReadyCall | null) => {
    call?.controller.abort();
    if (call && "recorder" in call) call.recorder.cancel();
  });

  const $id = createStore(0);
  const $call = createStore<RecordingCall | ReadyCall | null>(null, { serialize: "ignore" });
  const $status = createStore<RecordingStatus>("idle");
  const $seconds = createStore(0);
  const $level = createStore(0);
  const $levels = createStore<number[]>(Array.from({ length: 80 }, () => 0));
  const $error = createStore<string | null>(null);

  const $busy = $status.map((status) => status !== "idle");
  const $state = combine({ status: $status, seconds: $seconds, level: $level, levels: $levels });

  const accepted = sample({
    clock: started,
    source: { allowed: $allowed, status: $status, id: $id },
    filter: ({ allowed, status }) => allowed && status === "idle",
    fn: ({ id }) => id + 1,
  });

  sample({ clock: accepted, target: $id });

  sample({ clock: accepted, fn: (): RecordingStatus => "requesting", target: $status });

  sample({ clock: accepted, fn: () => 0, target: $seconds });

  sample({ clock: [accepted, cancelled], fn: () => 0, target: $level });

  sample({ clock: [accepted, cancelled], fn: () => Array.from({ length: 80 }, () => 0), target: $levels });

  const activeLevel = sample({
    clock: levelChanged,
    source: { id: $id, status: $status },
    filter: ({ id, status }, update) => id === update.id && status === "recording",
    fn: (_, { level }) => level,
  });

  sample({ clock: activeLevel, target: $level });

  sample({
    clock: activeLevel,
    source: $levels,
    fn: (levels, level) => [...levels.slice(1), Math.min(1, Math.sqrt(level) * 3)],
    target: $levels,
  });

  sample({ clock: [accepted, cancelled], fn: () => null, target: $error });

  sample({ clock: accepted, target: createCallFx });

  const callCreated = sample({
    clock: createCallFx.doneData,
    source: $id,
    filter: (id, call) => id === call.id,
    fn: (_, call) => call,
  });

  sample({ clock: callCreated, target: $call });

  sample({ clock: callCreated, target: startFx });

  const ready = sample({
    clock: startFx.doneData,
    source: $id,
    filter: (id, call) => id === call.id,
    fn: (_, call) => call,
  });

  sample({ clock: ready, target: $call });

  sample({ clock: ready, fn: (): RecordingStatus => "recording", target: $status });

  sample({
    clock: startFx.doneData,
    source: $id,
    filter: (id, call) => id !== call.id,
    fn: (_, call) => call,
    target: cancelFx,
  });

  sample({
    clock: elapsed,
    source: { id: $id, status: $status },
    filter: ({ id, status }, tick) => status === "recording" && tick.id === id,
    fn: (_, { seconds }) => seconds,
    target: $seconds,
  });

  sample({ clock: limitReached, source: $id, filter: (id, limitId) => id === limitId, target: stopped });

  const stopAccepted = sample({
    clock: stopped,
    source: { call: $call, status: $status },
    filter: ({ call, status }) => status === "recording" && call !== null && "recorder" in call,
    fn: ({ call }) => call as ReadyCall,
  });

  sample({ clock: stopAccepted, fn: (): RecordingStatus => "encoding", target: $status });

  sample({ clock: stopAccepted, target: stopFx });

  sample({
    clock: stopFx.done,
    source: $id,
    filter: (id, { params }) => id === params.id,
    fn: (_, { result }) => result,
    target: fileRecorded,
  });

  const startFailed = sample({
    clock: startFx.fail,
    source: $id,
    filter: (id, { params }) => id === params.id,
    fn: (_, { error }) => recordingError(error),
  });

  const stopFailed = sample({
    clock: stopFx.fail,
    source: $id,
    filter: (id, { params }) => id === params.id,
    fn: (_, { error }) =>
      error.name === "NoAudioSignalError" ? audioRecordingMessages.noSignal : audioRecordingMessages.encoding,
  });

  const deviceFailed = sample({
    clock: captureFailed,
    source: $id,
    filter: (id, failedId) => id === failedId,
    fn: () => audioRecordingMessages.encoding,
  });

  sample({ clock: [startFailed, stopFailed, deviceFailed], target: $error });

  sample({
    clock: [startFailed, stopFailed, deviceFailed, fileRecorded],
    fn: (): RecordingStatus => "idle",
    target: $status,
  });

  sample({ clock: [cancelled, startFailed, stopFailed, deviceFailed, fileRecorded], source: $call, target: cancelFx });

  sample({ clock: [cancelled, startFailed, stopFailed, deviceFailed, fileRecorded], fn: () => null, target: $call });

  sample({ clock: cancelled, source: $id, fn: (id) => id + 1, target: $id });

  sample({ clock: cancelled, fn: (): RecordingStatus => "idle", target: $status });

  sample({ clock: $allowed, filter: (allowed) => !allowed, target: cancelled });

  return {
    __: { startFx, stopFx },
    inputs: { started, stopped, cancelled },
    outputs: {
      started: readonly(accepted),
      fileRecorded: readonly(fileRecorded),
      $busy,
      $state,
      $error: readonly($error),
    },
  };
});
