import { invoke } from "@withease/factories";
import { sample } from "effector";

import { createMovieSearchFactory } from "@/widgets/movie-search";

import { $$session } from "@/entities/session";

import { loginRedirectRequested, routes } from "@/shared/routes";

const $$search = invoke(createMovieSearchFactory, {
  $isActive: routes.home.$isOpened,
  $sessionStatus: $$session.outputs.$status,
});

sample({ clock: $$search.outputs.loginRequested, fn: () => ({ path: "/" }), target: loginRedirectRequested });

sample({ clock: routes.home.closed, target: $$search.inputs.pageClosed });

sample({
  clock: routes.login.closed,
  source: $$session.outputs.$status,
  filter: (status) => status !== "authenticated",
  target: $$search.inputs.loginCancelled,
});

export const $$home = {
  $$search,
  outputs: { readyRoute: routes.home },
};
