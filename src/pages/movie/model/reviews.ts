import { concurrency, createMutation } from "@farfetched/core";
import { createFactory } from "@withease/factories";
import { createEvent, createStore, sample } from "effector";
import { readonly } from "patronum";

import { type MovieReview } from "@/shared/api";

import { getReviews, type ReviewSort } from "../api/request";

type ReviewRequest = { movieId: string; sort: ReviewSort; page: number; revision: number };

export const createMovieReviewsFactory = createFactory(() => {
  const opened = createEvent<string>();
  const closed = createEvent();
  const sortChanged = createEvent<ReviewSort>();
  const morePressed = createEvent();
  const retryPressed = createEvent();
  const refreshed = createEvent();
  const restarted = createEvent<{ movieId: string; sort: ReviewSort }>();
  const requested = createEvent<ReviewRequest>();

  const reviewsMutation = createMutation({
    name: "movieReviews",
    handler: (request: ReviewRequest) => getReviews(request),
  });

  concurrency(reviewsMutation, { strategy: "TAKE_LATEST", abortAll: closed });

  const $request = createStore<ReviewRequest | null>(null);
  const $revision = createStore(0);
  const $reviews = createStore<MovieReview[]>([]);
  const $hasMore = createStore(false);
  const $pending = createStore(false);
  const $error = createStore(false);

  const $sort = $request.map((request) => request?.sort ?? "best");

  sample({ clock: opened, fn: (movieId) => ({ movieId, sort: "best" as const }), target: restarted });

  sample({
    clock: sortChanged,
    source: $request,
    filter: (request, sort) => request !== null && request.sort !== sort,
    fn: (request, sort) => ({ movieId: request!.movieId, sort }),
    target: restarted,
  });

  sample({
    clock: refreshed,
    source: $request,
    filter: (request) => request !== null,
    fn: (request) => ({ movieId: request!.movieId, sort: request!.sort }),
    target: restarted,
  });

  sample({
    clock: restarted,
    source: $revision,
    fn: (revision, request) => ({ ...request, page: 1, revision: revision + 1 }),
    target: requested,
  });

  sample({
    clock: morePressed,
    source: { request: $request, pending: $pending, hasMore: $hasMore, error: $error },
    filter: ({ request, pending, hasMore, error }) => request !== null && !pending && hasMore && !error,
    fn: ({ request }) => ({ ...request!, page: request!.page + 1 }),
    target: requested,
  });

  sample({
    clock: retryPressed,
    source: { request: $request, pending: $pending, error: $error },
    filter: ({ request, pending, error }) => request !== null && !pending && error,
    fn: ({ request }) => request!,
    target: requested,
  });

  sample({ clock: requested, fn: ({ revision }) => revision, target: $revision });

  sample({ clock: closed, source: $revision, fn: (revision) => revision + 1, target: $revision });

  sample({ clock: requested, target: $request });

  sample({ clock: [restarted, closed], fn: () => [], target: $reviews });

  sample({ clock: [restarted, closed], fn: () => false, target: $hasMore });

  sample({ clock: [requested, closed], fn: () => false, target: $error });

  sample({ clock: requested, fn: () => true, target: $pending });

  sample({ clock: closed, fn: () => false, target: $pending });

  sample({ clock: closed, fn: () => null, target: $request });

  sample({ clock: requested, target: reviewsMutation.start });

  const succeeded = sample({
    clock: reviewsMutation.finished.success,
    source: $request,
    filter: (request, { params }) => request?.revision === params.revision && request.page === params.page,
    fn: (_, response) => response,
  });

  const failed = sample({
    clock: reviewsMutation.finished.failure,
    source: $request,
    filter: (request, { params }) => request?.revision === params.revision && request.page === params.page,
  });

  sample({
    clock: succeeded,
    source: $reviews,
    fn: (reviews, { params, result }) => {
      const combined = params.page === 1 ? result.reviews : [...reviews, ...result.reviews];

      // Reactions can change between page requests, moving a review across the page boundary.
      return [...new Map(combined.map((review) => [review.review_id, review])).values()];
    },
    target: $reviews,
  });

  sample({ clock: succeeded, fn: ({ result }) => result.has_more, target: $hasMore });

  sample({ clock: [succeeded, failed], fn: () => false, target: $pending });

  sample({ clock: failed, fn: () => true, target: $error });

  return {
    inputs: { opened, closed, sortChanged, morePressed, retryPressed, refreshed },
    outputs: {
      $reviews: readonly($reviews),
      $hasMore: readonly($hasMore),
      $pending: readonly($pending),
      $error: readonly($error),
      $sort,
    },
    __: { reviewsMutation },
  };
});
