import { redirect } from "@effector/router";
import { createEvent, sample } from "effector";

import { router, routes } from "./routes";

export const loginRedirectRequested = createEvent<{ path: string; replace?: boolean }>();

sample({
  clock: loginRedirectRequested,
  fn: ({ path, replace }) => ({ query: { redirect: path }, replace }),
  target: redirect({ to: routes.login }),
});

sample({
  clock: routes.login.closed,
  source: router.$query,
  filter: (query) => "redirect" in query,
  fn: (query) => ({
    query: Object.fromEntries(Object.entries(query).filter(([key]) => key !== "redirect")),
    replace: true,
  }),
  target: router.navigate,
});
