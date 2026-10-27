import { type Route } from "@effector/router";
import { createFactory, invoke } from "@withease/factories";
import { sample } from "effector";

import { createLoginFormFactory } from "@/widgets/login-form";

import { type $$session } from "@/entities/session";

import { loginReturnRequested } from "@/shared/routes";

export const createLoginPageFactory = createFactory(
  ({ route, session }: { route: Route; session: typeof $$session }) => {
    const $$form = invoke(createLoginFormFactory, { session, $active: route.$isOpened });

    sample({
      clock: session.outputs.statusResolved,
      source: route.$isOpened,
      filter: (opened, status) => opened && status === "authenticated",
      target: loginReturnRequested,
    });

    return $$form;
  },
);
