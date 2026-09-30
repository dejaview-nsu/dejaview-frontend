import { type Route, stringifyQuery } from "@effector/router";
import { createFactory } from "@withease/factories";
import { sample } from "effector";

import { loginRedirectRequested, router } from "@/shared/routes";

import type { $$session } from "./page";
import { chainSessionRoute } from "./session-route";

export const createAuthorizedRouteFactory = createFactory(
  ({ route, session }: { route: Route; session: typeof $$session }) => {
    const { readyRoute, accessDenied } = chainSessionRoute({ route, session, allow: "authenticated" });

    sample({
      clock: accessDenied,
      source: { path: router.$path, query: router.$query },
      fn: ({ path, query }) => {
        const search = stringifyQuery(query);

        return { path: `${path ?? "/"}${search ? `?${search}` : ""}`, replace: true };
      },
      target: loginRedirectRequested,
    });

    return {
      outputs: { readyRoute },
    };
  },
);
