import { createFactory, invoke } from "@withease/factories";
import { combine, createEvent, createStore, sample, type Store } from "effector";
import { readonly } from "patronum";

import { createSearchByAudioFactory } from "@/features/search-by-audio";
import { createSearchByDescriptionFactory, type QueryChange, textSearchTexts } from "@/features/search-by-description";
import { createSearchByFileFactory } from "@/features/search-by-file";
import { createSearchByVideoFactory } from "@/features/search-by-video";

import { type SessionStatus } from "@/entities/session";

import { type FileSearchMode } from "@/shared/api";
import { createModelView } from "@/shared/lib/effector/model-view";

import { type SearchMode } from "../config/search";

export const createMovieSearchFactory = createFactory(
  ({ $isActive, $sessionStatus }: { $isActive: Store<boolean>; $sessionStatus: Store<SessionStatus> }) => {
    const modeSelected = createEvent<SearchMode>();
    const modeAccepted = createEvent<SearchMode>();
    const filesSelected = createEvent<{ mode: FileSearchMode; files: File[] }>();
    const imagePreviewLoaded = createEvent<File>();
    const textChanged = createEvent<QueryChange>();
    const searchPressed = createEvent();
    const searchCancelled = createEvent();
    const pageClosed = createEvent();
    const loginRequested = createEvent();
    const becameGuest = createEvent();
    const loginCancelled = createEvent();

    const $isAuthenticated = $sessionStatus.map((status) => status === "authenticated");
    const $allowed = combine($isAuthenticated, $isActive, (authenticated, opened) => authenticated && opened);

    const $$audioSearch = invoke(createSearchByAudioFactory, { $allowed });
    const $$imageSearch = invoke(createSearchByFileFactory, { mode: "image", $allowed });
    const $$videoSearch = invoke(createSearchByVideoFactory, { $allowed });
    const $$textSearch = invoke(createSearchByDescriptionFactory, { $allowed: $isActive });

    const $mode = createStore<SearchMode>("text");
    const $text = $$textSearch.outputs.$query;
    const $pendingMode = createStore<SearchMode | null>(null);

    const $pending = combine(
      $mode,
      $$imageSearch.outputs.$pending,
      $$videoSearch.outputs.$pending,
      $$textSearch.outputs.$pending,
      $$audioSearch.outputs.$pending,
      (mode, image, video, text, audio) => ({ text, image, video, audio })[mode],
    );

    sample({ clock: $sessionStatus, filter: (status) => status === "guest", target: becameGuest });

    sample({ clock: modeAccepted, target: $mode });

    sample({ clock: imagePreviewLoaded, target: $$imageSearch.inputs.previewLoaded });

    sample({ clock: textChanged, target: $$textSearch.inputs.queryChanged });

    sample({ clock: becameGuest, fn: () => "text" as const, target: $mode });

    sample({
      clock: modeSelected,
      source: $isAuthenticated,
      filter: (authenticated, mode) => authenticated || mode === "text",
      fn: (_, mode) => mode,
      target: modeAccepted,
    });

    sample({
      clock: modeSelected,
      source: $isAuthenticated,
      filter: (authenticated, mode) => !authenticated && mode !== "text",
      target: loginRequested,
    });

    sample({
      clock: modeSelected,
      source: $isAuthenticated,
      filter: (authenticated, mode) => !authenticated && mode !== "text",
      fn: (_, mode) => mode,
      target: $pendingMode,
    });

    sample({
      clock: $sessionStatus,
      source: $pendingMode,
      filter: (pending, status): pending is SearchMode => status === "authenticated" && pending !== null,
      target: modeAccepted,
    });

    sample({ clock: [modeAccepted, loginCancelled], fn: () => null, target: $pendingMode });

    for (const [mode, media] of [
      ["image", $$imageSearch],
      ["video", $$videoSearch],
      ["audio", $$audioSearch],
    ] as const) {
      sample({
        clock: filesSelected,
        filter: (selection) => selection.mode === mode,
        fn: ({ files }) => files,
        target: media.inputs.filesSelected,
      });

      sample({ clock: media.outputs.resumed, fn: () => mode, target: modeAccepted });
    }

    for (const [mode, search] of [
      ["text", $$textSearch],
      ["image", $$imageSearch],
      ["video", $$videoSearch],
      ["audio", $$audioSearch],
    ] as const) {
      sample({
        clock: searchPressed,
        source: $mode,
        filter: (current) => current === mode,
        target: search.inputs.searchPressed,
      });

      sample({
        clock: searchCancelled,
        source: $mode,
        filter: (current) => current === mode,
        target: search.inputs.cancelled,
      });
    }

    sample({ clock: pageClosed, target: $$videoSearch.inputs.deactivated });

    sample({ clock: pageClosed, target: $$audioSearch.inputs.deactivated });

    sample({
      clock: modeAccepted,
      filter: (mode) => mode !== "audio",
      target: $$audioSearch.inputs.recordingCancelled,
    });

    const $currentMedia = combine(
      $mode,
      $$imageSearch.outputs.$state,
      $$videoSearch.outputs.$state,
      $$audioSearch.outputs.$state,
      (mode, image, video, audio) => ({ image, video, audio, text: image })[mode],
    );

    const $results = combine($mode, $currentMedia, $$textSearch.outputs.$results, (mode, media, text) =>
      mode === "text" ? text : !media.result ? null : [media.result],
    );

    const $error = combine($mode, $currentMedia, $$textSearch.outputs.$isUnavailable, (mode, media, unavailable) => {
      if (mode === "text") return unavailable ? textSearchTexts.unavailableText : null;

      return media.error;
    });

    const $isEmpty = combine($mode, $currentMedia, $$textSearch.outputs.$isEmpty, (mode, media, text) =>
      mode === "text" ? text : media.isEmpty,
    );

    const $hasSearchOutput = combine(
      $pending,
      $results,
      $error,
      $isEmpty,
      (pending, results, error, isEmpty) => pending || results !== null || error !== null || isEmpty,
    );

    const $progressMessage = combine($mode, $currentMedia, (mode, media) => {
      if (mode === "text") return "Ищем фильм по описанию…";

      if (media.stage === "uploading") return `Загружаем файл${media.progress === null ? "…" : `: ${media.progress}%`}`;

      if (media.stage === "processing") return "Файл загружен. Ищем фильм…";

      return "Проверяем файл…";
    });

    return {
      __: { $$imageSearch, $$videoSearch, $$audioSearch, $$textSearch },

      inputs: {
        modeSelected,
        textChanged,
        filesSelected,
        imagePreviewLoaded,
        searchPressed,
        searchCancelled,
        pageClosed,
        loginCancelled,
        recordingStarted: $$audioSearch.inputs.recordingStarted,
        recordingStopped: $$audioSearch.inputs.recordingStopped,
        recordingCancelled: $$audioSearch.inputs.recordingCancelled,
      },

      outputs: {
        loginRequested: readonly(loginRequested),
        $mode: readonly($mode),
        $pendingMode: readonly($pendingMode),
        $text: readonly($text),
        $textLength: $$textSearch.outputs.$length,
        $textOverLimit: $$textSearch.outputs.$isOverLimit,
        $textFieldError: $$textSearch.outputs.$fieldError,
        $submittedQuery: $$textSearch.outputs.$submittedQuery,
        $image: $$imageSearch.outputs.$state,
        $video: $$videoSearch.outputs.$state,
        $audio: $$audioSearch.outputs.$state,
        $recording: $$audioSearch.outputs.$recording,
        $recordingBusy: $$audioSearch.outputs.$recordingBusy,
        $pending,
        $currentMedia,
        $results,
        $error,
        $isEmpty,
        $hasSearchOutput,
        $progressMessage,
        $isAuthenticated,
      },
    };
  },
);

export type MovieSearchModel = ReturnType<typeof createMovieSearchFactory>;

export const [movieSearchModelView, useMovieSearchModel] = createModelView<MovieSearchModel>();
