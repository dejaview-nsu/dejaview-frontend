import { parseQuery, type Query, type QueryValue, redirect } from "@effector/router";
import { createEvent, sample } from "effector";

import { router, routes } from "./routes";

type ReturnTarget = { path: string; query: Query };

const HOME_TARGET: ReturnTarget = { path: "/", query: {} };

const parseReturnPath = (value: QueryValue | undefined): ReturnTarget => {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return HOME_TARGET;
  }

  const url = new URL(value, "http://localhost");

  if (url.origin !== "http://localhost") {
    return HOME_TARGET;
  }

  return { path: url.pathname, query: parseQuery(url.search) };
};

export const loginRedirectRequested = createEvent<{ path: string; replace?: boolean }>();
export const loginReturnRequested = createEvent();

sample({
  clock: loginRedirectRequested,
  fn: ({ path, replace }) => ({ query: { redirect: path }, replace }),
  target: redirect({ to: routes.login }),
});

sample({
  clock: loginReturnRequested,
  source: router.$query,
  fn: (query) => ({ ...parseReturnPath(query.redirect), replace: true }),
  target: router.navigate,
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
