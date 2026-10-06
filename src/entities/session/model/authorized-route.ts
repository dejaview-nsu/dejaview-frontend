import { type Route } from "@effector/router";
import { createFactory } from "@withease/factories";
import { sample } from "effector";

import { router } from "@/shared/routes";

import { toLocationPath } from "./location";
import type { $$session } from "./page";
import { chainSessionRoute } from "./session-route";

export const createAuthorizedRouteFactory = createFactory(
  ({ route, session }: { route: Route; session: typeof $$session }) => {
    const { readyRoute, accessDenied } = chainSessionRoute({ route, session, allow: "authenticated" });

    session.registry.protectedRoutes.add(route);

    sample({
      clock: accessDenied,
      source: { path: router.$path, query: router.$query },
      fn: (location) => ({ path: toLocationPath(location), replace: true }),
      target: session.inputs.loginRequired,
    });

    return {
      outputs: { readyRoute },
    };
  },
);
