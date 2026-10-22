import { invoke } from "@withease/factories";
import { sample } from "effector";

import { createOidcStartFactory } from "@/features/oidc-sign-in";
import { createRegisterFactory, type RegisterConfirmation } from "@/features/register";
import { createResendConfirmationFactory } from "@/features/resend-confirmation";

import { $$session, createGuestRouteFactory } from "@/entities/session";

import { routes } from "@/shared/routes";

export const $$register = invoke(createGuestRouteFactory, { route: routes.register, session: $$session });

export const $$registerForm = invoke(createRegisterFactory);

export const $$resendConfirmation = invoke(createResendConfirmationFactory);

export const $$oidcStart = invoke(createOidcStartFactory);

sample({ clock: $$register.outputs.readyRoute.opened, target: $$registerForm.inputs.reset });

sample({
  clock: [$$register.outputs.readyRoute.opened, $$register.outputs.readyRoute.closed],
  target: $$resendConfirmation.inputs.reset,
});

sample({
  clock: $$registerForm.outputs.$confirmation,
  filter: Boolean,
  fn: ({ email, resendAfter }: RegisterConfirmation) => ({ request: { login: email }, resendAfter }),
  target: $$resendConfirmation.inputs.started,
});
