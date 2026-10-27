import { createFactory, invoke } from "@withease/factories";
import { combine, createEffect, createEvent, createStore, sample, type Store } from "effector";
import { readonly } from "patronum";

import { createFileSearchFactory } from "@/shared/api";

import { audioCheckMessages, type AudioCheckReason } from "../config/audio";
import { type AudioCheckResult, checkAudio } from "../lib/check-audio";
import { type AudioSearchError, toAudioCheckReason, toAudioSearchError } from "../lib/search-error";
import { createAudioRecordingFactory } from "./recording";

type CheckRequest = { files: File[]; submit: boolean };

type CheckCall = CheckRequest & { id: number };

type CheckSettled = { call: CheckCall; result: AudioCheckResult };

type CheckPassed = { call: CheckCall; result: Extract<AudioCheckResult, { ok: true }> };

type CheckFailed = { call: CheckCall; result: Extract<AudioCheckResult, { ok: false }> };

export type AudioCheck =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "valid"; durationSeconds: number }
  | { status: "invalid"; reason: AudioCheckReason; durationSeconds?: number };

const durationOf = (check: AudioCheck) =>
  (check.status === "valid" || check.status === "invalid") && check.durationSeconds !== undefined
    ? check.durationSeconds
    : null;

export const createSearchByAudioFactory = createFactory(({ $allowed }: { $allowed: Store<boolean> }) => {
  const $$recording = invoke(createAudioRecordingFactory, { $allowed });
  const $$audioSearch = invoke(createFileSearchFactory, { mode: "audio" });

  const filesSelected = createEvent<File[]>();
  const searchPressed = createEvent();
  const cancelled = createEvent();
  const deactivated = createEvent();
  const stopped = createEvent();
  const resumed = createEvent();
  const checkRequested = createEvent<CheckRequest>();
  const checkSettled = createEvent<CheckSettled>();

  const checkFx = createEffect<CheckCall, AudioCheckResult>(({ files }) => checkAudio(files));

  const $files = createStore<File[]>([]);
  const $checkId = createStore(0);
  const $check = createStore<AudioCheck>({ status: "idle" });
  const $submitting = createStore(false);
  const $submitError = createStore<AudioCheckReason | null>(null);
  const $showResponse = createStore(false);
  const $retryAfterLogin = createStore(false);

  const $pending = combine(
    $submitting,
    $$audioSearch.outputs.$stage,
    (submitting, stage) => submitting || stage === "uploading" || stage === "processing",
  );

  sample({ clock: filesSelected, target: $files });

  sample({ clock: $$recording.outputs.fileRecorded, fn: (file) => [file], target: filesSelected });

  sample({ clock: [filesSelected, stopped], target: $$recording.inputs.cancelled });

  sample({ clock: $$recording.outputs.started, target: $$audioSearch.inputs.cancelled });

  sample({ clock: $$recording.outputs.started, source: $checkId, fn: (id) => id + 1, target: $checkId });

  sample({ clock: $$recording.outputs.started, fn: () => false, target: $submitting });

  sample({ clock: $$recording.outputs.started, fn: () => false, target: $showResponse });

  sample({ clock: $$recording.outputs.started, fn: () => null, target: $submitError });

  sample({ clock: [cancelled, deactivated], target: stopped });

  sample({ clock: [filesSelected, stopped], source: $checkId, fn: (id) => id + 1, target: $checkId });

  sample({ clock: [filesSelected, stopped], target: $$audioSearch.inputs.cancelled });

  sample({ clock: [filesSelected, stopped], fn: () => false, target: $submitting });

  sample({ clock: filesSelected, fn: () => null, target: $submitError });

  sample({ clock: filesSelected, fn: () => false, target: $showResponse });

  sample({
    clock: filesSelected,
    filter: (files) => files.length > 0,
    fn: (files) => ({ files, submit: false }),
    target: checkRequested,
  });

  sample({
    clock: filesSelected,
    filter: (files) => files.length === 0,
    fn: (): AudioCheck => ({ status: "idle" }),
    target: $check,
  });

  sample({
    clock: [stopped, $$recording.outputs.started],
    source: $check,
    filter: (check) => check.status === "checking",
    fn: (): AudioCheck => ({ status: "idle" }),
    target: $check,
  });

  sample({ clock: $allowed, filter: (allowed) => !allowed, target: deactivated });

  sample({ clock: $$audioSearch.outputs.sessionLost, fn: () => true, target: $retryAfterLogin });

  sample({
    clock: $allowed,
    source: $retryAfterLogin,
    filter: (retry, allowed) => retry && allowed,
    target: resumed,
  });

  sample({ clock: resumed, target: searchPressed });

  const searchAccepted = sample({
    clock: searchPressed,
    source: { files: $files, allowed: $allowed, pending: $pending, recording: $$recording.outputs.$busy },
    filter: ({ allowed, pending, recording }) => allowed && !pending && !recording,
    fn: ({ files }) => files,
  });

  sample({ clock: searchAccepted, target: $$recording.inputs.cancelled });

  sample({
    clock: [filesSelected, cancelled, searchAccepted, $$recording.outputs.started],
    fn: () => false,
    target: $retryAfterLogin,
  });

  sample({ clock: searchAccepted, fn: (files) => ({ files, submit: true }), target: checkRequested });

  sample({ clock: searchAccepted, fn: () => true, target: $submitting });

  sample({ clock: searchAccepted, fn: () => null, target: $submitError });

  sample({ clock: searchAccepted, fn: () => false, target: $showResponse });

  const checkStarted = sample({
    clock: checkRequested,
    source: $checkId,
    fn: (id, request): CheckCall => ({ ...request, id: id + 1 }),
  });

  sample({ clock: checkStarted, fn: ({ id }) => id, target: $checkId });

  sample({
    clock: checkStarted,
    filter: ({ submit }) => !submit,
    fn: (): AudioCheck => ({ status: "checking" }),
    target: $check,
  });

  sample({ clock: checkStarted, target: checkFx });

  sample({
    clock: checkFx.done,
    source: { id: $checkId, allowed: $allowed },
    filter: ({ id, allowed }, { params }) => allowed && id === params.id,
    fn: (_, { params, result }): CheckSettled => ({ call: params, result }),
    target: checkSettled,
  });

  sample({
    clock: checkFx.fail,
    source: { id: $checkId, allowed: $allowed },
    filter: ({ id, allowed }, { params }) => allowed && id === params.id,
    fn: (_, { params }): CheckSettled => ({ call: params, result: { ok: false, reason: "corrupted" } }),
    target: checkSettled,
  });

  sample({
    clock: checkSettled,
    fn: ({ result }): AudioCheck =>
      result.ok
        ? { status: "valid", durationSeconds: result.durationSeconds }
        : { status: "invalid", reason: result.reason, durationSeconds: result.durationSeconds },
    target: $check,
  });

  const fileRejected = $$audioSearch.outputs.failed.filterMap((error) => toAudioCheckReason(error) ?? undefined);

  sample({
    clock: fileRejected,
    source: $check,
    fn: (check, reason): AudioCheck => ({ status: "invalid", reason, durationSeconds: durationOf(check) ?? undefined }),
    target: $check,
  });

  sample({ clock: checkSettled, fn: () => false, target: $submitting });

  const submitPassed = sample({
    clock: checkSettled,
    filter: (settled): settled is CheckPassed => settled.call.submit && settled.result.ok,
  });

  const submitFailed = sample({
    clock: checkSettled,
    filter: (settled): settled is CheckFailed => settled.call.submit && !settled.result.ok,
  });

  sample({ clock: submitPassed, fn: () => true, target: $showResponse });

  sample({ clock: submitPassed, fn: ({ result }) => result.file, target: $$audioSearch.inputs.started });

  sample({ clock: submitFailed, fn: ({ result }) => result.reason, target: $submitError });

  const $stage = combine($submitting, $$audioSearch.outputs.$stage, (submitting, stage) =>
    submitting ? ("validating" as const) : stage,
  );

  const $result = combine($showResponse, $$audioSearch.outputs.$results, (show, results) =>
    show ? (results?.[0] ?? null) : null,
  );

  const $isEmpty = combine($showResponse, $$audioSearch.outputs.$isEmpty, (show, isEmpty) => show && isEmpty);

  const $error = combine(
    $submitError,
    $$recording.outputs.$error,
    $showResponse,
    $$audioSearch.outputs.$error,
    (reason, recordingError, show, error): AudioSearchError | null => {
      if (recordingError) return { kind: "recording", message: recordingError };
      if (reason) return { kind: reason === "missing" ? "missing" : "file", message: audioCheckMessages[reason] };

      return show && error ? toAudioSearchError(error) : null;
    },
  );

  const $state = combine(
    {
      files: $files,
      stage: $stage,
      progress: $$audioSearch.outputs.$progress,
      result: $result,
      isEmpty: $isEmpty,
      error: $error,
      check: $check,
    },
    ({ error, ...state }) => ({
      ...state,
      durationSeconds: durationOf(state.check),
      error: error?.message ?? null,
      errorKind: error?.kind ?? null,
    }),
  );

  return {
    __: { $$audioSearch, $$recording, checkFx },

    inputs: {
      filesSelected,
      searchPressed,
      cancelled,
      deactivated,
      recordingStarted: $$recording.inputs.started,
      recordingStopped: $$recording.inputs.stopped,
      recordingCancelled: $$recording.inputs.cancelled,
    },

    outputs: {
      $recording: $$recording.outputs.$state,
      $recordingBusy: $$recording.outputs.$busy,
      $files: readonly($files),
      $check: readonly($check),
      $state,
      $pending,
      resumed: readonly(resumed),
    },
  };
});

export type SearchByAudioModel = ReturnType<typeof createSearchByAudioFactory>;
