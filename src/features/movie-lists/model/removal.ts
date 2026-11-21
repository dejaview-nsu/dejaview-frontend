import { concurrency, createMutation } from "@farfetched/core";
import { createFactory } from "@withease/factories";
import { createEvent, createStore, sample } from "effector";
import { readonly } from "patronum";

import { type ApiError, type ListTypePath, toApiError } from "@/shared/api";

import { changeMovieList } from "../api/request";

export type ListRemoval = { list: ListTypePath; movieId: number };

type RemovalRequest = ListRemoval & { revision: number };

const isSameRemoval = (left: ListRemoval, right: ListRemoval) =>
  left.list === right.list && left.movieId === right.movieId;

export const createListRemovalFactory = createFactory(() => {
  const removePressed = createEvent<ListRemoval>();
  const reset = createEvent();
  const removeStarted = createEvent<RemovalRequest>();
  const removed = createEvent<ListRemoval>();
  const failed = createEvent<ListRemoval & { error: ApiError }>();

  const removeMutation = createMutation({
    name: "movieLists.remove",
    handler: ({ list, movieId }: RemovalRequest) =>
      changeMovieList({ movieId: String(movieId), list, selected: false, onUnauthorized: "login" }),
  });

  const $revision = createStore(0);
  const $pending = createStore<ListRemoval[]>([]);

  concurrency(removeMutation, { strategy: "TAKE_EVERY", abortAll: reset });

  sample({
    clock: removePressed,
    source: { pending: $pending, revision: $revision },
    filter: ({ pending }, removal) => !pending.some((item) => isSameRemoval(item, removal)),
    fn: ({ revision }, { list, movieId }) => ({ list, movieId, revision }),
    target: removeStarted,
  });

  sample({
    clock: removeStarted,
    source: $pending,
    fn: (pending, { list, movieId }) => [...pending, { list, movieId }],
    target: $pending,
  });

  sample({ clock: removeStarted, target: removeMutation.start });

  sample({
    clock: removeMutation.finished.success,
    source: $revision,
    filter: (revision, { params }) => revision === params.revision,
    fn: (_, { params: { list, movieId } }) => ({ list, movieId }),
    target: removed,
  });

  sample({
    clock: removeMutation.finished.failure,
    source: $revision,
    filter: (revision, { params }) => revision === params.revision,
    fn: (_, { params: { list, movieId }, error }) => ({ list, movieId, error: toApiError(error) }),
    target: failed,
  });

  sample({
    clock: [removed, failed],
    source: $pending,
    fn: (pending, removal) => pending.filter((item) => !isSameRemoval(item, removal)),
    target: $pending,
  });

  sample({ clock: reset, source: $revision, fn: (revision) => revision + 1, target: $revision });

  sample({ clock: reset, fn: () => [], target: $pending });

  return {
    inputs: { removePressed, reset },
    outputs: {
      $pending: readonly($pending),
      removed: readonly(removed),
      failed: readonly(failed),
    },
    __: { removeMutation },
  };
});
