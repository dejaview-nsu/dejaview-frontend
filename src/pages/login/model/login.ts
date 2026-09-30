import { type Route } from "@effector/router";
import { createFactory } from "@withease/factories";
import { createEvent, sample } from "effector";

import { type $$session } from "@/entities/session";

import { loginReturnRequested } from "@/shared/routes";

export const createLoginPageFactory = createFactory(
  ({ route, session }: { route: Route; session: typeof $$session }) => {
    const stubLoginPressed = createEvent();

    sample({ clock: stubLoginPressed, target: session.inputs.signedIn });

    sample({
      clock: session.outputs.statusResolved,
      source: route.$isOpened,
      filter: (opened, status) => opened && status === "authenticated",
      target: loginReturnRequested,
    });

    return {
      inputs: { stubLoginPressed },
    };
  },
);
