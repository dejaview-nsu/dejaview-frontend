import { concurrency, createMutation, onAbort } from "@farfetched/core";
import { createFactory } from "@withease/factories";
import { createEvent, createStore, sample, scopeBind } from "effector";
import { readonly } from "patronum";

import { type ApiError, isSessionError, toApiError } from "../errors";
import type { MovieSearchResult } from "../generated";
import type { FileSearchMode } from "./modes";
import { searchByFile } from "./request";

export type FileSearchStage = "idle" | "uploading" | "processing" | "done" | "failed";

type SearchCall = { file: File; callId: number };

const ACTIVE_STAGES: readonly FileSearchStage[] = ["uploading", "processing"];

export const createFileSearchFactory = createFactory(({ mode }: { mode: FileSearchMode }) => {
  const started = createEvent<File>();
  const cancelled = createEvent();
  const callStarted = createEvent<SearchCall>();
  const cancelConfirmed = createEvent();
  const uploadProgressed = createEvent<{ callId: number; fraction: number | null }>();
  const uploadCompleted = createEvent<{ callId: number }>();
  const processingStarted = createEvent();
  const succeeded = createEvent<MovieSearchResult[]>();
  const failed = createEvent<ApiError>();
  const sessionLost = createEvent();

  const searchMutation = createMutation({
    name: `fileSearch.${mode}`,
    handler: ({ file, callId }: SearchCall) => {
      const controller = new AbortController();
      const reportProgress = scopeBind(uploadProgressed, { safe: true });
      const reportUploadComplete = scopeBind(uploadCompleted, { safe: true });

      onAbort(() => controller.abort());

      return searchByFile({
        mode,
        file,
        signal: controller.signal,
        onUploadProgress: (fraction) => reportProgress({ callId, fraction }),
        onUploadComplete: () => reportUploadComplete({ callId }),
      });
    },
  });

  concurrency(searchMutation, { strategy: "TAKE_LATEST", abortAll: cancelConfirmed });

  const $stage = createStore<FileSearchStage>("idle");
  const $progress = createStore<number | null>(0);
  const $results = createStore<MovieSearchResult[] | null>(null);
  const $error = createStore<ApiError | null>(null);
  const $activeCallId = createStore(0);
  const $isEmpty = $results.map((results) => results !== null && results.length === 0);

  const isActiveCall = (activeCallId: number, { callId }: { callId: number }) => callId === activeCallId;

  sample({
    clock: started,
    source: $activeCallId,
    fn: (callId, file) => ({ file, callId: callId + 1 }),
    target: callStarted,
  });
  sample({ clock: callStarted, fn: ({ callId }) => callId, target: $activeCallId });
  sample({ clock: callStarted, fn: () => "uploading" as const, target: $stage });
  sample({ clock: callStarted, fn: () => 0, target: $progress });
  sample({ clock: callStarted, fn: () => null, target: [$results, $error] });
  sample({ clock: callStarted, target: searchMutation.start });

  sample({
    clock: uploadProgressed,
    source: { stage: $stage, activeCallId: $activeCallId },
    filter: ({ stage, activeCallId }, progress) => stage === "uploading" && isActiveCall(activeCallId, progress),
    fn: (_, { fraction }) => (fraction === null ? null : Math.round(fraction * 100)),
    target: $progress,
  });

  sample({
    clock: uploadCompleted,
    source: { stage: $stage, activeCallId: $activeCallId },
    filter: ({ stage, activeCallId }, upload) => stage === "uploading" && isActiveCall(activeCallId, upload),
    target: processingStarted,
  });
  sample({ clock: processingStarted, fn: () => "processing" as const, target: $stage });
  sample({ clock: processingStarted, fn: () => 100, target: $progress });

  sample({
    clock: searchMutation.finished.success,
    source: $activeCallId,
    filter: (activeCallId, { params }) => isActiveCall(activeCallId, params),
    fn: (_, { result }) => result.results,
    target: succeeded,
  });
  sample({ clock: succeeded, target: $results });
  sample({ clock: succeeded, fn: () => "done" as const, target: $stage });

  const activeFailure = sample({
    clock: searchMutation.finished.failure,
    source: $activeCallId,
    filter: (activeCallId, { params }) => isActiveCall(activeCallId, params),
    fn: (_, { error }) => error,
  });

  sample({ clock: activeFailure, filter: (error) => isSessionError(error), target: sessionLost });
  sample({ clock: sessionLost, fn: () => "idle" as const, target: $stage });
  sample({ clock: sessionLost, fn: () => 0, target: $progress });

  sample({ clock: activeFailure, filter: (error) => !isSessionError(error), fn: toApiError, target: failed });
  sample({ clock: failed, target: $error });
  sample({ clock: failed, fn: () => "failed" as const, target: $stage });

  sample({
    clock: cancelled,
    source: $stage,
    filter: (stage) => ACTIVE_STAGES.includes(stage),
    target: cancelConfirmed,
  });
  sample({ clock: cancelConfirmed, source: $activeCallId, fn: (callId) => callId + 1, target: $activeCallId });
  sample({ clock: cancelConfirmed, fn: () => "idle" as const, target: $stage });
  sample({ clock: cancelConfirmed, fn: () => 0, target: $progress });
  sample({ clock: cancelConfirmed, fn: () => null, target: $error });

  return {
    __: { searchMutation },
    inputs: { started, cancelled },
    outputs: {
      $stage: readonly($stage),
      $progress: readonly($progress),
      $results: readonly($results),
      $isEmpty,
      $error: readonly($error),
      succeeded: readonly(succeeded),
      failed: readonly(failed),
    },
  };
});
