import { invoke } from "@withease/factories";
import { sample } from "effector";

import { createRequestPasswordResetFactory } from "@/features/request-password-reset";

import { $$session, createGuestRouteFactory } from "@/entities/session";

import { routes } from "@/shared/routes";

export const $$forgotPasswordRoute = invoke(createGuestRouteFactory, {
  route: routes.forgotPassword,
  session: $$session,
});

export const $$forgotPassword = invoke(createRequestPasswordResetFactory);

sample({
  clock: [$$forgotPasswordRoute.outputs.readyRoute.opened, routes.forgotPassword.closed],
  target: $$forgotPassword.inputs.reset,
});
