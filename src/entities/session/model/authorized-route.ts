import { chainRoute, type Route } from "@effector/router";
import { createFactory } from "@withease/factories";
import { combine, createEvent, sample } from "effector";

import { loginRedirectRequested, router, routes } from "@/shared/routes";

import type { $$session } from "./page";
import type { SessionStatus } from "./session";

type KnownStatus = Exclude<SessionStatus, "unknown">;

export const createAuthorizedRouteFactory = createFactory(
  ({ route, session }: { route: Route; session: typeof $$session }) => {
    const checkStarted = createEvent();
    const statusChecked = createEvent<KnownStatus>();
    const accessGranted = createEvent();
    const accessDenied = createEvent();

    const readyRoute = chainRoute({
      route,
      beforeOpen: checkStarted,
      openOn: accessGranted,
      cancelOn: accessDenied,
    });

    const $isWaiting = combine(route.$isOpened, readyRoute.$isOpened, (opened, ready) => opened && !ready);

    sample({
      clock: checkStarted,
      source: session.outputs.$status,
      filter: (status) => status === "unknown",
      target: session.inputs.sessionCheckRequested,
    });

    sample({
      clock: checkStarted,
      source: session.outputs.$status,
      filter: (status): status is KnownStatus => status !== "unknown",
      target: statusChecked,
    });

    sample({ clock: session.outputs.statusResolved, filter: $isWaiting, target: statusChecked });

    sample({ clock: statusChecked, filter: (status) => status === "authenticated", target: accessGranted });
    sample({ clock: statusChecked, filter: (status) => status === "guest", target: accessDenied });

    sample({
      clock: accessDenied,
      source: router.$path,
      fn: (path) => ({ path: path ?? "/", replace: true }),
      target: loginRedirectRequested,
    });

    sample({
      clock: session.outputs.statusResolved,
      source: readyRoute.$isOpened,
      filter: (opened, status) => opened && status === "guest",
      fn: () => ({ replace: true }),
      target: routes.home.open,
    });

    return {
      outputs: { readyRoute },
    };
  },
);
