import { createFactory, invoke } from "@withease/factories";
import { combine, createEffect, createEvent, createStore, sample, type Store } from "effector";
import { readonly } from "patronum";

import { createFileSearchFactory, type FileSearchMode } from "@/shared/api";
import { FileValidationError, validateMediaFile } from "@/shared/lib/files";

import { fileConstraints } from "../config/files";

type ValidationRequest = { files: File[]; revision: number };

export const createSearchByFileFactory = createFactory(
  ({ mode, $allowed }: { mode: FileSearchMode; $allowed: Store<boolean> }) => {
    const $$request = invoke(createFileSearchFactory, { mode });

    const filesSelected = createEvent<File[]>();
    const searchPressed = createEvent();
    const cancelled = createEvent();
    const accessLost = createEvent();
    const resumed = createEvent();
    const validationRequested = createEvent<ValidationRequest>();
    const validationSucceeded = createEvent<File>();
    const validationFailed = createEvent<Error>();

    const validateFx = createEffect<ValidationRequest, void, Error>(({ files }) =>
      validateMediaFile(files, fileConstraints[mode]),
    );

    const $files = createStore<File[]>([]);
    const $revision = createStore(0);
    const $validating = createStore(false);
    const $validationError = createStore<string | null>(null);
    const $showResponse = createStore(false);
    const $retryAfterLogin = createStore(false);

    const $pending = combine(
      $validating,
      $$request.outputs.$stage,
      (validating, stage) => validating || stage === "uploading" || stage === "processing",
    );

    sample({ clock: filesSelected, target: $files });

    sample({
      clock: [filesSelected, cancelled, accessLost],
      source: $revision,
      fn: (revision) => revision + 1,
      target: $revision,
    });

    sample({ clock: validationRequested, fn: () => true, target: $validating });

    sample({
      clock: [filesSelected, cancelled, accessLost, validationSucceeded, validationFailed],
      fn: () => false,
      target: $validating,
    });

    sample({
      clock: validationFailed,
      fn: (error) =>
        error instanceof FileValidationError
          ? `Поиск не запущен. ${error.message}`
          : "Не удалось прочитать файл. Выберите другой файл.",
      target: $validationError,
    });

    sample({
      clock: [filesSelected, cancelled, accessLost, validationRequested],
      fn: () => null,
      target: $validationError,
    });

    sample({ clock: validationSucceeded, fn: () => true, target: $showResponse });

    sample({ clock: [filesSelected, validationRequested], fn: () => false, target: $showResponse });

    sample({ clock: [filesSelected, cancelled, accessLost], target: $$request.inputs.cancelled });

    sample({ clock: $allowed, filter: (allowed) => !allowed, target: accessLost });

    sample({ clock: $$request.outputs.sessionLost, fn: () => true, target: $retryAfterLogin });

    sample({ clock: [filesSelected, cancelled, validationRequested], fn: () => false, target: $retryAfterLogin });

    sample({
      clock: $allowed,
      source: $retryAfterLogin,
      filter: (retry, allowed) => retry && allowed,
      target: resumed,
    });

    sample({ clock: resumed, target: searchPressed });

    sample({
      clock: searchPressed,
      source: { files: $files, revision: $revision, allowed: $allowed, pending: $pending },
      filter: ({ allowed, pending }) => allowed && !pending,
      fn: ({ files, revision }) => ({ files, revision }),
      target: validationRequested,
    });

    sample({ clock: validationRequested, target: validateFx });

    sample({
      clock: validateFx.done,
      source: { revision: $revision, allowed: $allowed },
      filter: ({ revision, allowed }, { params }) => allowed && revision === params.revision,
      fn: (_, { params }) => params.files[0],
      target: validationSucceeded,
    });

    sample({ clock: validationSucceeded, target: $$request.inputs.started });

    sample({
      clock: validateFx.fail,
      source: { revision: $revision, allowed: $allowed },
      filter: ({ revision, allowed }, { params }) => allowed && revision === params.revision,
      fn: (_, { error }) => error,
      target: validationFailed,
    });

    const $state = combine(
      {
        files: $files,
        validating: $validating,
        validationError: $validationError,
        showResponse: $showResponse,
        stage: $$request.outputs.$stage,
        progress: $$request.outputs.$progress,
        results: $$request.outputs.$results,
        error: $$request.outputs.$error,
      },
      ({ files, validating, validationError, showResponse, stage, progress, results, error }) => ({
        files,
        stage: validating ? ("validating" as const) : stage,
        progress,
        result: showResponse ? (results?.[0] ?? null) : null,
        isEmpty: showResponse && results !== null && results.length === 0,
        error: validationError ?? (showResponse ? (error?.message ?? null) : null),
      }),
    );

    return {
      __: { $$request, validateFx },

      inputs: { filesSelected, searchPressed, cancelled },

      outputs: { $files: readonly($files), $state, $pending, resumed: readonly(resumed) },
    };
  },
);

export type SearchByFileModel = ReturnType<typeof createSearchByFileFactory>;
