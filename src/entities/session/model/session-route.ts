import { chainRoute, type Route } from "@effector/router";
import { combine, createEvent, sample } from "effector";

import type { $$session } from "./page";
import type { SessionStatus } from "./session";

type KnownStatus = Exclude<SessionStatus, "unknown">;

export const chainSessionRoute = ({
  route,
  session,
  allow,
}: {
  route: Route;
  session: typeof $$session;
  allow: KnownStatus;
}) => {
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
    filter: (status): status is KnownStatus => status !== "unknown",
    target: statusChecked,
  });

  sample({ clock: session.outputs.statusResolved, filter: $isWaiting, target: statusChecked });

  sample({ clock: statusChecked, filter: (status) => status === allow, target: accessGranted });
  sample({ clock: statusChecked, filter: (status) => status !== allow, target: accessDenied });

  return { readyRoute, accessDenied };
};
