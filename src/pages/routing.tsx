import { createRoutesView, createRouteView, withLayout } from "@effector/router-react";

import { BaseLayout } from "@/layouts/base";

import { routes } from "@/shared/routes";

import { AboutPage } from "./about";
import { $$home } from "./home";
import { HomePage } from "./home";
import { NotFoundPage } from "./not-found";

const PageLoader = () => {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <span className="size-8 animate-spin rounded-full border-2 border-border-base border-t-system-primary" />
    </div>
  );
};

export const Routing = createRoutesView({
  routes: withLayout(BaseLayout, [
    createRouteView({ route: $$home.outputs.readyRoute, view: HomePage }),
    createRouteView({ route: routes.about, view: AboutPage }),
    createRouteView({ route: routes.notFound, view: NotFoundPage }),
  ]),
  otherwise: PageLoader,
});
