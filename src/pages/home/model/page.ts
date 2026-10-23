import { invoke } from "@withease/factories";
import { sample } from "effector";

import { createMovieSearchFactory, isSearchMode, type SearchMode } from "@/widgets/movie-search";

import { $$session } from "@/entities/session";

import { loginRedirectRequested, router, routes } from "@/shared/routes";

const $$search = invoke(createMovieSearchFactory, {
  $isActive: routes.home.$isOpened,
  $sessionStatus: $$session.outputs.$status,
});

sample({
  clock: $$search.outputs.loginRequested,
  source: $$search.outputs.$pendingMode,
  fn: (mode) => ({ path: mode ? `/?mode=${mode}` : "/" }),
  target: loginRedirectRequested,
});

sample({ clock: routes.home.closed, target: $$search.inputs.pageClosed });

sample({
  clock: routes.login.closed,
  source: $$session.outputs.$status,
  filter: (status) => status !== "authenticated",
  target: $$search.inputs.loginCancelled,
});

const modeReturned = sample({
  clock: [routes.home.opened, $$session.outputs.statusResolved],
  source: { query: router.$query, opened: routes.home.$isOpened, status: $$session.outputs.$status },
  filter: ({ query, opened, status }) => opened && status === "authenticated" && isSearchMode(query.mode),
  fn: ({ query }) => query,
});

sample({
  clock: modeReturned,
  fn: ({ mode }) => mode as SearchMode,
  target: $$search.inputs.modeSelected,
});

sample({
  clock: modeReturned,
  fn: (query) => ({
    query: Object.fromEntries(Object.entries(query).filter(([key]) => key !== "mode")),
    replace: true,
  }),
  target: routes.home.open,
});

export const $$home = {
  $$search,
  outputs: { readyRoute: routes.home },
};
