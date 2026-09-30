import { type Route } from "@effector/router";
import { createFactory } from "@withease/factories";
import { sample } from "effector";

import { routes } from "@/shared/routes";

import type { $$session } from "./page";
import { chainSessionRoute } from "./session-route";

export const createGuestRouteFactory = createFactory(
  ({ route, session }: { route: Route; session: typeof $$session }) => {
    const { readyRoute, accessDenied } = chainSessionRoute({ route, session, allow: "guest" });

    sample({
      clock: accessDenied,
      fn: () => ({ replace: true, query: {} }),
      target: routes.home.open,
    });

    return {
      outputs: { readyRoute },
    };
  },
);
