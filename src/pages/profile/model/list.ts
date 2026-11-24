import { concurrency, createMutation, onAbort } from "@farfetched/core";
import { createFactory } from "@withease/factories";
import { createEvent, createStore, sample } from "effector";
import { readonly } from "patronum";

import { isSessionError, toApiError, type UserListMovie } from "@/shared/api";

import { getListMovies, type ListQuery, type ListSort } from "../api/request";
import { countPages } from "../lib/pagination";

type Status = "idle" | "loading" | "ready" | "failed";
type Request = { query: ListQuery; revision: number; silent: boolean; fullTotal: number | null; resetTotal?: boolean };
type Removal = { list: ListQuery["list"]; movieId: number };

const isSameQuery = (left: ListQuery | null, right: ListQuery) =>
  left !== null &&
  left.list === right.list &&
  left.sort === right.sort &&
  left.q === right.q &&
  left.page === right.page;

export const createProfileListFactory = createFactory(() => {
  const opened = createEvent<ListQuery>();
  const closed = createEvent();
  const retryPressed = createEvent();
  const pageSelected = createEvent<number>();
  const sortSelected = createEvent<ListSort>();
  const draftChanged = createEvent<string>();
  const searchSubmitted = createEvent();
  const searchCleared = createEvent();
  const movieRemoved = createEvent<Removal>();
  const loadStarted = createEvent<Request>();

  const listMutation = createMutation({
    name: "profile.list",
    handler: async ({ query, fullTotal }: Request) => {
      const controller = new AbortController();
      onAbort(() => controller.abort());

      let result = await getListMovies(query, controller.signal);

      while (query.page > Math.max(1, countPages(result.total)) && !controller.signal.aborted) {
        query = { ...query, page: Math.max(1, countPages(result.total)) };
        if (result.total === 0) break;
        result = await getListMovies(query, controller.signal);
      }

      if (!query.q) fullTotal = result.total;
      if (query.q && result.total === 0 && fullTotal === null && !controller.signal.aborted) {
        fullTotal = (await getListMovies({ ...query, q: "", page: 1 }, controller.signal)).total;
      }

      return { ...result, query, fullTotal };
    },
  });

  const $query = createStore<ListQuery | null>(null);
  const $revision = createStore(0);
  const $movies = createStore<UserListMovie[]>([]);
  const $total = createStore(0);
  const $status = createStore<Status>("idle");

  const $refreshFailed = createStore(false);

  const $draft = createStore("");
  const $fullTotal = createStore<number | null>(null);

  const $pageCount = $total.map(countPages);

  sample({
    clock: pageSelected,
    source: { query: $query, pages: $pageCount },
    filter: ({ query, pages }, page) =>
      query !== null && Number.isSafeInteger(page) && page >= 1 && page <= pages && page !== query.page,
    fn: ({ query }, page) => ({ ...query!, page }),
    target: opened,
  });

  sample({
    clock: sortSelected,
    source: $query,
    filter: (query, sort) => query !== null && query.sort !== sort,
    fn: (query, sort) => ({ ...query!, sort, page: 1 }),
    target: opened,
  });

  sample({ clock: draftChanged, target: $draft });

  sample({ clock: [closed, searchCleared], fn: () => "", target: $draft });

  sample({
    clock: [searchSubmitted, searchCleared],
    source: { query: $query, draft: $draft },
    filter: ({ query }) => query !== null,
    fn: ({ query, draft }) => ({ ...query!, q: draft.trim(), page: 1 }),
    target: opened,
  });

  concurrency(listMutation, { strategy: "TAKE_LATEST", abortAll: closed });

  sample({
    clock: opened,
    source: { query: $query, revision: $revision, fullTotal: $fullTotal },
    filter: ({ query }, next) => !isSameQuery(query, next),
    fn: ({ query: previous, revision, fullTotal }, query) => ({
      query,
      revision: revision + 1,
      silent: false,
      fullTotal: previous?.list === query.list ? fullTotal : null,
      resetTotal: previous?.list !== query.list || previous.q !== query.q,
    }),
    target: loadStarted,
  });

  sample({
    clock: retryPressed,
    source: {
      query: $query,
      revision: $revision,
      status: $status,
      fullTotal: $fullTotal,
      refreshFailed: $refreshFailed,
    },
    filter: ({ query, status, refreshFailed }) => query !== null && (status === "failed" || refreshFailed),
    fn: ({ query, revision, fullTotal, refreshFailed }) => ({
      query: query!,
      revision: revision + 1,
      silent: refreshFailed,
      fullTotal,
    }),
    target: loadStarted,
  });

  sample({
    clock: loadStarted,
    filter: ({ resetTotal }) => resetTotal === true,
    fn: () => 0,
    target: $total,
  });

  sample({ clock: loadStarted, fn: ({ query }) => query, target: $query });

  sample({ clock: loadStarted, fn: ({ revision }) => revision, target: $revision });

  const reloadStarted = sample({ clock: loadStarted, filter: ({ silent }) => !silent });

  sample({ clock: reloadStarted, fn: () => "loading" as const, target: $status });

  sample({ clock: reloadStarted, fn: () => [], target: $movies });

  sample({ clock: loadStarted, fn: ({ fullTotal }) => fullTotal, target: $fullTotal });

  sample({ clock: [loadStarted, closed], fn: () => false, target: $refreshFailed });

  sample({ clock: loadStarted, target: listMutation.start });

  const loaded = sample({
    clock: listMutation.finished.success,
    source: $revision,
    filter: (revision, { params }) => revision === params.revision,
    fn: (_, { result }) => result,
  });

  sample({ clock: loaded, fn: ({ query }) => query, target: $query });

  sample({ clock: loaded, fn: ({ fullTotal }) => fullTotal, target: $fullTotal });

  sample({ clock: loaded, fn: ({ movies }) => movies, target: $movies });

  sample({ clock: loaded, fn: ({ total }) => total, target: $total });

  sample({ clock: loaded, fn: () => "ready" as const, target: $status });

  const loadFailed = sample({
    clock: listMutation.finished.failure,
    source: $revision,
    filter: (revision, { params, error }) => revision === params.revision && !isSessionError(toApiError(error)),
    fn: (_, { params }) => params,
  });

  sample({
    clock: loadFailed,
    filter: ({ silent }) => !silent,
    fn: () => "failed" as const,
    target: $status,
  });

  sample({
    clock: loadFailed,
    filter: ({ silent }) => silent,
    fn: () => true,
    target: $refreshFailed,
  });

  const removalApplied = sample({
    clock: movieRemoved,
    source: {
      query: $query,
      movies: $movies,
      total: $total,
      status: $status,
      pending: listMutation.$pending,
      refreshFailed: $refreshFailed,
      revision: $revision,
      fullTotal: $fullTotal,
    },
    filter: ({ query }, { list }) => query?.list === list,
    fn: ({ query, movies, total, status, pending, refreshFailed, revision, fullTotal }, { movieId }) => {
      const current = query!;
      const remaining = movies.filter((movie) => movie.movie_id !== movieId);
      const visible = remaining.length !== movies.length;
      const nextTotal = visible ? total - 1 : total;
      const knownTotal = fullTotal === null ? null : Math.max(0, fullTotal - 1);
      return {
        query: current,
        revision: revision + 1,
        silent: status === "ready" && remaining.length > 0,
        movies: remaining,
        total: nextTotal,
        fullTotal: knownTotal,
        complete:
          status === "ready" &&
          !pending &&
          !refreshFailed &&
          current.page === 1 &&
          visible &&
          movies.length === total &&
          (!current.q || nextTotal > 0 || knownTotal !== null),
      };
    },
  });

  sample({ clock: removalApplied, fn: ({ movies }) => movies, target: $movies });

  sample({ clock: removalApplied, fn: ({ total }) => total, target: $total });

  sample({ clock: removalApplied, fn: ({ fullTotal }) => fullTotal, target: $fullTotal });

  sample({
    clock: removalApplied,
    filter: ({ complete }) => !complete,
    fn: ({ query, revision, silent, fullTotal }) => ({ query, revision, silent, fullTotal }),
    target: loadStarted,
  });

  sample({ clock: closed, source: $revision, fn: (revision) => revision + 1, target: $revision });

  sample({ clock: closed, fn: () => null, target: [$query, $fullTotal] });

  sample({ clock: closed, fn: () => [], target: $movies });

  sample({ clock: closed, fn: () => 0, target: $total });

  sample({ clock: closed, fn: () => "idle" as const, target: $status });

  return {
    inputs: {
      opened,
      closed,
      retryPressed,
      movieRemoved,
      pageSelected,
      sortSelected,
      draftChanged,
      searchSubmitted,
      searchCleared,
    },
    outputs: {
      $query: readonly($query),
      $movies: readonly($movies),
      $total: readonly($total),
      $status: readonly($status),
      $refreshFailed: readonly($refreshFailed),
      $draft: readonly($draft),
      $fullTotal: readonly($fullTotal),
      $pageCount,
    },
    __: { listMutation },
  };
});
