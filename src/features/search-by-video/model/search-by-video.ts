import { createFactory, invoke } from "@withease/factories";
import { combine, createEffect, createEvent, createStore, sample, type Store } from "effector";
import { readonly } from "patronum";

import { createFileSearchFactory } from "@/shared/api";

import { videoCheckMessages, type VideoCheckReason } from "../config";
import {
  checkVideo,
  toVideoCheckReason,
  toVideoSearchError,
  type VideoCheckResult,
  type VideoSearchError,
} from "../lib";

type CheckRequest = { files: File[]; submit: boolean };

type CheckCall = CheckRequest & { id: number };

type CheckSettled = { call: CheckCall; result: VideoCheckResult };

type CheckPassed = { call: CheckCall; result: Extract<VideoCheckResult, { ok: true }> };

type CheckFailed = { call: CheckCall; result: Extract<VideoCheckResult, { ok: false }> };

export type VideoCheck =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "valid"; durationSeconds: number }
  | { status: "invalid"; reason: VideoCheckReason; durationSeconds?: number };

const durationOf = (check: VideoCheck) =>
  (check.status === "valid" || check.status === "invalid") && check.durationSeconds !== undefined
    ? check.durationSeconds
    : null;

export const createSearchByVideoFactory = createFactory(({ $allowed }: { $allowed: Store<boolean> }) => {
  const $$videoSearch = invoke(createFileSearchFactory, { mode: "video" });

  const filesSelected = createEvent<File[]>();
  const searchPressed = createEvent();
  const cancelled = createEvent();
  const checkRequested = createEvent<CheckRequest>();
  const checkSettled = createEvent<CheckSettled>();

  const checkFx = createEffect<CheckCall, VideoCheckResult>(({ files }) => checkVideo(files));

  const $files = createStore<File[]>([]);
  const $checkId = createStore(0);
  const $check = createStore<VideoCheck>({ status: "idle" });
  const $submitting = createStore(false);
  const $submitError = createStore<VideoCheckReason | null>(null);
  const $showResponse = createStore(false);

  const $pending = combine(
    $submitting,
    $$videoSearch.outputs.$stage,
    (submitting, stage) => submitting || stage === "uploading" || stage === "processing",
  );

  sample({ clock: filesSelected, target: $files });

  sample({ clock: [filesSelected, cancelled], source: $checkId, fn: (id) => id + 1, target: $checkId });

  sample({ clock: [filesSelected, cancelled], target: $$videoSearch.inputs.cancelled });

  sample({ clock: [filesSelected, cancelled], fn: () => false, target: $submitting });

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
    fn: (): VideoCheck => ({ status: "idle" }),
    target: $check,
  });

  sample({
    clock: cancelled,
    source: $check,
    filter: (check) => check.status === "checking",
    fn: (): VideoCheck => ({ status: "idle" }),
    target: $check,
  });

  sample({ clock: $allowed, filter: (allowed) => !allowed, target: cancelled });

  const searchAccepted = sample({
    clock: searchPressed,
    source: { files: $files, allowed: $allowed, pending: $pending },
    filter: ({ allowed, pending }) => allowed && !pending,
    fn: ({ files }) => files,
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
    fn: (): VideoCheck => ({ status: "checking" }),
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
    fn: ({ result }): VideoCheck =>
      result.ok
        ? { status: "valid", durationSeconds: result.durationSeconds }
        : { status: "invalid", reason: result.reason, durationSeconds: result.durationSeconds },
    target: $check,
  });

  const fileRejected = $$videoSearch.outputs.failed.filterMap((error) => toVideoCheckReason(error) ?? undefined);

  sample({
    clock: fileRejected,
    source: $check,
    fn: (check, reason): VideoCheck => ({ status: "invalid", reason, durationSeconds: durationOf(check) ?? undefined }),
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

  sample({ clock: submitPassed, fn: ({ result }) => result.file, target: $$videoSearch.inputs.started });

  sample({ clock: submitFailed, fn: ({ result }) => result.reason, target: $submitError });

  const $stage = combine($submitting, $$videoSearch.outputs.$stage, (submitting, stage) =>
    submitting ? ("validating" as const) : stage,
  );

  const $result = combine($showResponse, $$videoSearch.outputs.$results, (show, results) =>
    show ? (results?.[0] ?? null) : null,
  );

  const $isEmpty = combine($showResponse, $$videoSearch.outputs.$isEmpty, (show, isEmpty) => show && isEmpty);

  const $error = combine(
    $submitError,
    $showResponse,
    $$videoSearch.outputs.$error,
    (reason, show, error): VideoSearchError | null => {
      if (reason) return { kind: reason === "missing" ? "missing" : "file", message: videoCheckMessages[reason] };

      return show && error ? toVideoSearchError(error) : null;
    },
  );

  const $state = combine(
    {
      files: $files,
      stage: $stage,
      progress: $$videoSearch.outputs.$progress,
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
    __: { $$videoSearch, checkFx },

    inputs: { filesSelected, searchPressed, cancelled },

    outputs: { $files: readonly($files), $check: readonly($check), $state, $pending },
  };
});

export type SearchByVideoModel = ReturnType<typeof createSearchByVideoFactory>;
