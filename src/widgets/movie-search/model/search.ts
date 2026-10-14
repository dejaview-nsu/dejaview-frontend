import { createFactory, invoke } from "@withease/factories";
import { combine, createEvent, createStore, sample, type Store } from "effector";
import { readonly } from "patronum";

import { createSearchByDescriptionFactory } from "@/features/search-by-description";
import { createSearchByFileFactory } from "@/features/search-by-file";

import { type SessionStatus } from "@/entities/session";

import { type FileSearchMode } from "@/shared/api";
import { createModelView } from "@/shared/lib/effector/model-view";

import { type SearchMode } from "../config/search";

export const createMovieSearchFactory = createFactory(
  ({ $isActive, $sessionStatus }: { $isActive: Store<boolean>; $sessionStatus: Store<SessionStatus> }) => {
    const modeSelected = createEvent<SearchMode>();
    const modeAccepted = createEvent<SearchMode>();
    const filesSelected = createEvent<{ mode: FileSearchMode; files: File[] }>();
    const searchPressed = createEvent();
    const searchCancelled = createEvent();
    const loginRequested = createEvent();
    const becameGuest = createEvent();

    const $isAuthenticated = $sessionStatus.map((status) => status === "authenticated");
    const $allowed = combine($isAuthenticated, $isActive, (authenticated, opened) => authenticated && opened);

    const $$imageSearch = invoke(createSearchByFileFactory, { mode: "image", $allowed });
    const $$videoSearch = invoke(createSearchByFileFactory, { mode: "video", $allowed });
    const $$textSearch = invoke(createSearchByDescriptionFactory, { $allowed: $isActive });

    const textChanged = $$textSearch.inputs.queryChanged;

    const $mode = createStore<SearchMode>("text");
    const $text = $$textSearch.outputs.$query;

    const $pending = combine(
      $$imageSearch.outputs.$pending,
      $$videoSearch.outputs.$pending,
      $$textSearch.outputs.$pending,
      (image, video, text) => image || video || text,
    );

    sample({ clock: $sessionStatus, filter: (status) => status === "guest", target: becameGuest });

    sample({ clock: modeAccepted, target: $mode });

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

      sample({
        clock: searchPressed,
        source: { mode: $mode, pending: $pending },
        filter: (state) => state.mode === mode && !state.pending,
        target: media.inputs.searchPressed,
      });

      sample({ clock: searchCancelled, target: media.inputs.cancelled });

      sample({ clock: media.outputs.resumed, fn: () => mode, target: modeAccepted });
    }

    sample({
      clock: searchPressed,
      source: { mode: $mode, pending: $pending },
      filter: ({ mode, pending }) => mode === "text" && !pending,
      target: $$textSearch.inputs.searchPressed,
    });

    sample({ clock: searchCancelled, target: $$textSearch.inputs.cancelled });

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

    const $activeSearchMode = combine(
      $mode,
      $$imageSearch.outputs.$pending,
      $$videoSearch.outputs.$pending,
      $$textSearch.outputs.$pending,
      (mode, image, video, text): SearchMode => (image ? "image" : video ? "video" : text ? "text" : mode),
    );

    const $progressMessage = combine(
      $$imageSearch.outputs.$state,
      $$videoSearch.outputs.$state,
      $$textSearch.outputs.$pending,
      (image, video, textPending) => {
        if (textPending) return "Ищем фильм по описанию…";

        const activeMedia = ["idle", "done", "failed"].includes(image.stage) ? video : image;

        if (activeMedia.stage === "uploading")
          return `Загружаем файл${activeMedia.progress === null ? "…" : `: ${activeMedia.progress}%`}`;

        if (activeMedia.stage === "processing") return "Файл загружен. Ищем фильм…";

        return "Проверяем файл…";
      },
    );

    return {
      __: { $$imageSearch, $$videoSearch },

      inputs: { modeSelected, textChanged, filesSelected, searchPressed, searchCancelled },

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
        $activeSearchMode,
        $progressMessage,
        $isAuthenticated,
      },
    };
  },
);

export type MovieSearchModel = ReturnType<typeof createMovieSearchFactory>;

export const [movieSearchModelView, useMovieSearchModel] = createModelView<MovieSearchModel>();
