import { createRoute, createRouter, historyAdapter } from "@effector/router";
import { sample } from "effector";
import { createBrowserHistory } from "history";

import { appStarted } from "../config/init";

export const routes = {
  home: createRoute({ path: "/" }),
  about: createRoute({ path: "/about" }),
  movie: createRoute({ path: "/movies/:movieId" }),
  login: createRoute({ path: "/login" }),
  register: createRoute({ path: "/register" }),
  profile: createRoute({ path: "/profile" }),
  confirmEmail: createRoute({ path: "/confirm-email" }),
  oidcCallback: createRoute({ path: "/auth/oidc" }),
  notFound: createRoute(),
};

export const router = createRouter({
  routes: [
    routes.home,
    routes.about,
    routes.movie,
    routes.login,
    routes.register,
    routes.profile,
    routes.confirmEmail,
    routes.oidcCallback,
  ],
  notFound: routes.notFound,
});

sample({
  clock: appStarted,
  fn: () => historyAdapter(createBrowserHistory()),
  target: router.setHistory,
});
