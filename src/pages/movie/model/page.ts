import { invoke } from "@withease/factories";
import { sample } from "effector";

import { $$session } from "@/entities/session";

import { routes } from "@/shared/routes";

import { createMoviePageFactory } from "./movie";

export const $$movie = invoke(createMoviePageFactory);

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
