import { createFactory, invoke } from "@withease/factories";
import { combine, createEvent, createStore, sample, type Store } from "effector";
import { readonly } from "patronum";

import { createSearchByDescriptionFactory } from "@/features/search-by-description";
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
    const textChanged = createEvent<string>();
    const searchPressed = createEvent();
    const searchCancelled = createEvent();
    const pageClosed = createEvent();
    const loginRequested = createEvent();
    const becameGuest = createEvent();

    const $isAuthenticated = $sessionStatus.map((status) => status === "authenticated");
    const $allowed = combine($isAuthenticated, $isActive, (authenticated, opened) => authenticated && opened);

    const $$imageSearch = invoke(createSearchByFileFactory, { mode: "image", $allowed });
    const $$videoSearch = invoke(createSearchByVideoFactory, { $allowed });
    const $$textSearch = invoke(createSearchByDescriptionFactory, { $allowed: $isActive });

    const $mode = createStore<SearchMode>("text");
    const $text = $$textSearch.outputs.$query;

    const $pending = combine(
      $mode,
      $$imageSearch.outputs.$pending,
      $$videoSearch.outputs.$pending,
      $$textSearch.outputs.$pending,
      (mode, image, video, text) => ({ text, image, video, audio: false })[mode],
    );

    sample({ clock: $sessionStatus, filter: (status) => status === "guest", target: becameGuest });

    sample({ clock: modeAccepted, target: $mode });

    sample({ clock: imagePreviewLoaded, target: $$imageSearch.inputs.previewLoaded });

    sample({
      clock: textChanged,
      fn: (text) => [...text].slice(0, 250).join(""),
      target: $$textSearch.inputs.queryChanged,
    });

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

    for (const [mode, media] of [
      ["image", $$imageSearch],
      ["video", $$videoSearch],
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

    const $isStubMode = $mode.map((mode) => mode === "audio");

    const $currentMedia = combine(
      $mode,
      $$imageSearch.outputs.$state,
      $$videoSearch.outputs.$state,
      (mode, image, video) => (mode === "video" ? video : image),
    );

    const $results = combine($mode, $currentMedia, $$textSearch.outputs.$results, (mode, media, text) =>
      mode === "text" ? text : mode === "audio" || !media.result ? null : [media.result],
    );

    const $error = combine($mode, $currentMedia, $$textSearch.outputs.$error, (mode, media, text) =>
      mode === "text" ? text : mode === "audio" ? null : media.error,
    );

    const $isEmpty = combine($mode, $currentMedia, $$textSearch.outputs.$isEmpty, (mode, media, text) =>
      mode === "text" ? text : mode !== "audio" && media.isEmpty,
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
      __: { $$imageSearch, $$videoSearch },

      inputs: {
        modeSelected,
        textChanged,
        filesSelected,
        imagePreviewLoaded,
        searchPressed,
        searchCancelled,
        pageClosed,
      },

      outputs: {
        loginRequested: readonly(loginRequested),
        $mode: readonly($mode),
        $text: readonly($text),
        $submittedQuery: $$textSearch.outputs.$submittedQuery,
        $image: $$imageSearch.outputs.$state,
        $video: $$videoSearch.outputs.$state,
        $pending,
        $isStubMode,
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
