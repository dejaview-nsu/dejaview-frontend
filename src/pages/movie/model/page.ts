import { invoke } from "@withease/factories";
import { sample } from "effector";

import { $$movieListIntent, createMovieListsFactory } from "@/features/movie-lists";

import { $$session } from "@/entities/session";

import { routes } from "@/shared/routes";

import { createMoviePageFactory } from "./movie";

export const $$movie = invoke(createMoviePageFactory);
export const $$movieLists = invoke(createMovieListsFactory);

sample({
  clock: [routes.movie.opened, routes.movie.updated],
  source: routes.movie.$params,
  fn: ({ movieId }) => movieId,
  target: $$movie.inputs.opened,
});

sample({ clock: routes.movie.closed, target: $$movie.inputs.closed });

sample({
  clock: $$session.outputs.statusResolved,
  filter: routes.movie.$isOpened,
  target: $$movie.$$reviews.inputs.refreshed,
});

sample({
  clock: $$movie.outputs.$movie,
  filter: (movie) => movie !== null,
  fn: (movie) => String(movie!.movie_id),
  target: $$movieLists.inputs.opened,
});

sample({
  clock: $$movie.outputs.$movie,
  filter: (movie) => movie === null,
  target: $$movieLists.inputs.closed,
});

sample({
  clock: $$session.outputs.statusResolved,
  source: $$session.outputs.$user,
  fn: (user, status) => ({ status, userKey: user?.username ?? null }),
  target: $$movieLists.inputs.sessionChanged,
});

sample({ clock: $$movieLists.outputs.intentRequested, target: $$movieListIntent.inputs.requested });

sample({ clock: $$movieLists.outputs.intentConsumed, target: $$movieListIntent.inputs.consumed });

sample({ clock: $$movieLists.outputs.loginRequested, target: $$session.inputs.loginPressed });

sample({ clock: $$movieLists.outputs.guestDetected, target: $$session.inputs.sessionInvalidated });

sample({
  clock: [$$movieLists.outputs.$state, $$movieListIntent.outputs.$intent],
  source: { state: $$movieLists.outputs.$state, intent: $$movieListIntent.outputs.$intent },
  filter: ({ state, intent }) =>
    intent !== null && state.authenticated && state.canToggle && state.movieId === intent.movieId,
  fn: ({ intent }) => intent!,
  target: $$movieLists.inputs.resumeRequested,
});
