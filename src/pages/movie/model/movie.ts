import { concurrency, createMutation } from "@farfetched/core";
import { createFactory, invoke } from "@withease/factories";
import { createEvent, createStore, sample } from "effector";
import { readonly } from "patronum";

import { ApiError, type MovieCard } from "@/shared/api";

import { getMovie } from "../api/request";
import { createMovieReviewsFactory } from "./reviews";

type MovieRequest = { movieId: string; revision: number };
type MovieStatus = "idle" | "loading" | "ready" | "not-found" | "failed";

const isMovieId = (movieId: string) => /^[1-9]\d*$/.test(movieId) && Number.isSafeInteger(Number(movieId));

export const createMoviePageFactory = createFactory(() => {
  const opened = createEvent<string>();
  const closed = createEvent();
  const retryPressed = createEvent();
  const requested = createEvent<MovieRequest>();
  const aborted = createEvent();

  const movieMutation = createMutation({
    name: "movieCard",
    handler: ({ movieId }: MovieRequest) => getMovie(movieId),
  });

  concurrency(movieMutation, { strategy: "TAKE_LATEST", abortAll: aborted });

  const $$reviews = invoke(createMovieReviewsFactory);

  const $request = createStore<MovieRequest | null>(null);
  const $revision = createStore(0);
  const $movie = createStore<MovieCard | null>(null);
  const $status = createStore<MovieStatus>("idle");

  sample({
    clock: opened,
    source: { revision: $revision, request: $request },
    filter: ({ request }, movieId) => request?.movieId !== movieId,
    fn: ({ revision }, movieId) => ({ movieId, revision: revision + 1 }),
    target: requested,
  });

  sample({
    clock: retryPressed,
    source: { request: $request, status: $status, revision: $revision },
    filter: ({ request, status }) => request !== null && status === "failed",
    fn: ({ request, revision }) => ({ movieId: request!.movieId, revision: revision + 1 }),
    target: requested,
  });

  sample({ clock: requested, fn: ({ revision }) => revision, target: $revision });

  sample({ clock: requested, target: $request });

  sample({ clock: [requested, closed], fn: () => null, target: $movie });

  sample({ clock: [requested, closed], target: $$reviews.inputs.closed });

  sample({
    clock: requested,
    fn: ({ movieId }) => (isMovieId(movieId) ? "loading" : "not-found") as MovieStatus,
    target: $status,
  });

  sample({ clock: requested, filter: ({ movieId }) => isMovieId(movieId), target: movieMutation.start });

  // An invalid route must also abort a previous valid request.
  sample({ clock: requested, filter: ({ movieId }) => !isMovieId(movieId), target: aborted });

  sample({ clock: closed, target: aborted });

  sample({ clock: closed, fn: () => null, target: $request });

  sample({ clock: closed, fn: () => "idle" as const, target: $status });

  const succeeded = sample({
    clock: movieMutation.finished.success,
    source: $request,
    filter: (request, { params }) => request?.revision === params.revision,
    fn: (_, response) => response,
  });

  sample({ clock: succeeded, fn: ({ result }) => result, target: $movie });

  sample({ clock: succeeded, fn: () => "ready" as const, target: $status });

  sample({ clock: succeeded, fn: ({ params }) => params.movieId, target: $$reviews.inputs.opened });

  sample({
    clock: movieMutation.finished.failure,
    source: $request,
    filter: (request, { params }) => request?.revision === params.revision,
    fn: (_, { error }) =>
      error instanceof ApiError && error.status === 404 ? ("not-found" as const) : ("failed" as const),
    target: $status,
  });

  return {
    inputs: { opened, closed, retryPressed },
    outputs: { $movie: readonly($movie), $status: readonly($status) },
    $$reviews,
    __: { movieMutation },
  };
});
