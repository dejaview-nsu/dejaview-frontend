import { concurrency, createMutation } from "@farfetched/core";
import { createFactory } from "@withease/factories";
import { createEvent, createStore, sample } from "effector";
import { readonly } from "patronum";

import { isSessionError, toApiError, type UserListMovie } from "@/shared/api";

import { getListMovies, type ListQuery } from "../api/request";

type Status = "idle" | "loading" | "ready" | "failed";
type Request = { query: ListQuery; revision: number; silent: boolean };
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
  const refreshed = createEvent();
  const movieRemoved = createEvent<Removal>();
  const loadStarted = createEvent<Request>();

  const listMutation = createMutation({
    name: "profile.list",
    handler: ({ query }: Request) => getListMovies(query),
  });

  const $query = createStore<ListQuery | null>(null);
  const $revision = createStore(0);
  const $movies = createStore<UserListMovie[]>([]);
  const $total = createStore(0);
  const $status = createStore<Status>("idle");

  concurrency(listMutation, { strategy: "TAKE_LATEST", abortAll: closed });

  sample({
    clock: opened,
    source: { query: $query, revision: $revision },
    filter: ({ query }, next) => !isSameQuery(query, next),
    fn: ({ revision }, query) => ({ query, revision: revision + 1, silent: false }),
    target: loadStarted,
  });

  sample({
    clock: retryPressed,
    source: { query: $query, revision: $revision, status: $status },
    filter: ({ query, status }) => query !== null && status === "failed",
    fn: ({ query, revision }) => ({ query: query!, revision: revision + 1, silent: false }),
    target: loadStarted,
  });

  sample({
    clock: refreshed,
    source: { query: $query, revision: $revision, status: $status },
    filter: ({ query, status }) => query !== null && status === "ready",
    fn: ({ query, revision }) => ({ query: query!, revision: revision + 1, silent: true }),
    target: loadStarted,
  });

  sample({ clock: loadStarted, fn: ({ query }) => query, target: $query });

  sample({ clock: loadStarted, fn: ({ revision }) => revision, target: $revision });

  const reloadStarted = sample({ clock: loadStarted, filter: ({ silent }) => !silent });

  sample({ clock: reloadStarted, fn: () => "loading" as const, target: $status });

  sample({ clock: reloadStarted, fn: () => [], target: $movies });

  sample({ clock: reloadStarted, fn: () => 0, target: $total });

  sample({ clock: loadStarted, target: listMutation.start });

  const loaded = sample({
    clock: listMutation.finished.success,
    source: $revision,
    filter: (revision, { params }) => revision === params.revision,
    fn: (_, { result }) => result,
  });

  sample({ clock: loaded, fn: ({ movies }) => movies, target: $movies });

  sample({ clock: loaded, fn: ({ total }) => total, target: $total });

  sample({ clock: loaded, fn: () => "ready" as const, target: $status });

  sample({
    clock: listMutation.finished.failure,
    source: $revision,
    filter: (revision, { params, error }) =>
      revision === params.revision && !params.silent && !isSessionError(toApiError(error)),
    fn: () => "failed" as const,
    target: $status,
  });

  const removedLocally = sample({
    clock: movieRemoved,
    source: { query: $query, movies: $movies, total: $total, status: $status, revision: $revision },
    filter: ({ query, movies, status }, { list, movieId }) =>
      status === "ready" && query?.list === list && movies.some((movie) => movie.movie_id === movieId),
    fn: ({ movies, total, revision }, { movieId }) => ({
      movies: movies.filter((movie) => movie.movie_id !== movieId),
      total: Math.max(total - 1, 0),
      revision: revision + 1,
    }),
  });

  sample({ clock: removedLocally, fn: ({ movies }) => movies, target: $movies });

  sample({ clock: removedLocally, fn: ({ total }) => total, target: $total });

  sample({ clock: removedLocally, fn: ({ revision }) => revision, target: $revision });

  sample({ clock: removedLocally, filter: ({ movies, total }) => total > movies.length, target: refreshed });

  sample({ clock: closed, source: $revision, fn: (revision) => revision + 1, target: $revision });

  sample({ clock: closed, fn: () => null, target: $query });

  sample({ clock: closed, fn: () => [], target: $movies });

  sample({ clock: closed, fn: () => 0, target: $total });

  sample({ clock: closed, fn: () => "idle" as const, target: $status });

  return {
    inputs: { opened, closed, retryPressed, movieRemoved },
    outputs: {
      $query: readonly($query),
      $movies: readonly($movies),
      $total: readonly($total),
      $status: readonly($status),
    },
    __: { listMutation },
  };
});
