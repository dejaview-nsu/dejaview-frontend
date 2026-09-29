import { createRoute, createRouter, historyAdapter } from "@effector/router";
import { sample } from "effector";
import { createBrowserHistory } from "history";

import { appStarted } from "../config/init";

export const routes = {
  home: createRoute({ path: "/" }),
  about: createRoute({ path: "/about" }),
  notFound: createRoute(),
};

export const router = createRouter({
  routes: [routes.home, routes.about],
  notFound: routes.notFound,
});

sample({
  clock: appStarted,
  fn: () => historyAdapter(createBrowserHistory()),
  target: router.setHistory,
});
