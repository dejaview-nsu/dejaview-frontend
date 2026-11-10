import { type Query, type QueryValue } from "@effector/router";
import { invoke } from "@withease/factories";
import { sample } from "effector";

import { createResetPasswordFactory } from "@/features/reset-password";

import { $$session } from "@/entities/session";

import { PASSWORD_MESSAGES } from "@/shared/config/auth-messages";
import { $$notifications } from "@/shared/lib/notifications";
import { router, routes } from "@/shared/routes";

const readToken = (value: QueryValue | undefined) => {
  const token = typeof value === "string" ? value.trim() : "";

  return token.length > 0 ? token : null;
};

const withoutToken = (query: Query): Query =>
  Object.fromEntries(Object.entries(query).filter(([key]) => key !== "token"));

export const $$resetPassword = invoke(createResetPasswordFactory);

const tokenRead = sample({
  clock: routes.resetPassword.opened,
  source: router.$query,
  fn: (query) => readToken(query.token),
});

sample({ clock: tokenRead, target: $$resetPassword.inputs.tokenReceived });

sample({
  clock: tokenRead,
  source: router.$query,
  filter: (query) => "token" in query,
  fn: (query) => ({ query: withoutToken(query), replace: true }),
  target: router.navigate,
});

sample({ clock: routes.resetPassword.closed, target: $$resetPassword.inputs.reset });

sample({ clock: $$resetPassword.outputs.completed, target: $$session.inputs.sessionCreated });

sample({
  clock: $$resetPassword.outputs.completed,
  fn: () => ({ text: PASSWORD_MESSAGES.changed, tone: "success" as const }),
  target: $$notifications.inputs.shown,
});

sample({
  clock: $$resetPassword.outputs.completed,
  fn: () => ({ replace: true, query: {} }),
  target: routes.home.open,
});
