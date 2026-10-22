import { type QueryValue } from "@effector/router";
import { createFactory, invoke } from "@withease/factories";
import { createEvent, createStore, sample } from "effector";
import { readonly } from "patronum";

import { createResendConfirmationFactory } from "@/features/resend-confirmation";

import { $$session } from "@/entities/session";

import { toApiError } from "@/shared/api";
import { CONFIRMATION_MESSAGES } from "@/shared/config/auth-messages";
import { $$notifications } from "@/shared/lib/notifications";
import { router, routes } from "@/shared/routes";

import { createConfirmEmailApi } from "../api/request";

export type ConfirmEmailScreen = "pending" | "failed" | "expired" | "sent";

const readToken = (value: QueryValue | undefined) => {
  const token = typeof value === "string" ? value.trim() : "";

  return token.length > 0 ? token : null;
};

export const createConfirmEmailPageFactory = createFactory(() => {
  const { confirmMutation } = createConfirmEmailApi();
  const $$resend = invoke(createResendConfirmationFactory);

  const retryPressed = createEvent();
  const confirmationRequested = createEvent<string>();
  const linkExpired = createEvent<string>();

  const $token = createStore<string | null>(null);
  const $requestedToken = createStore<string | null>(null);
  const $screen = createStore<ConfirmEmailScreen>("pending");
  const $error = createStore<string | null>(null);
  const $pending = confirmMutation.$pending;

  const tokenRead = sample({
    clock: routes.confirmEmail.opened,
    source: router.$query,
    fn: (query) => readToken(query.token),
  });

  sample({ clock: tokenRead, target: $token });

  sample({
    clock: tokenRead,
    filter: (token) => token === null,
    fn: () => ({ replace: true, query: {} }),
    target: routes.login.open,
  });

  sample({
    clock: [$token, $$session.outputs.statusResolved],
    source: {
      token: $token,
      requested: $requestedToken,
      opened: routes.confirmEmail.$isOpened,
      status: $$session.outputs.$status,
    },
    filter: ({ token, requested, opened, status }) =>
      opened && status !== "unknown" && token !== null && token !== requested,
    fn: ({ token }) => token as string,
    target: confirmationRequested,
  });

  sample({
    clock: retryPressed,
    source: { token: $token, pending: $pending },
    filter: ({ token, pending }) => token !== null && !pending,
    fn: ({ token }) => token as string,
    target: confirmationRequested,
  });

  sample({ clock: confirmationRequested, target: $requestedToken });

  sample({ clock: confirmationRequested, fn: () => "pending" as const, target: $screen });

  sample({ clock: confirmationRequested, fn: () => null, target: $error });

  sample({ clock: confirmationRequested, target: confirmMutation.start });

  sample({
    clock: confirmMutation.finished.success,
    fn: ({ result }) => result,
    target: $$session.inputs.sessionCreated,
  });

  sample({
    clock: confirmMutation.finished.success,
    fn: () => ({ text: CONFIRMATION_MESSAGES.confirmed, tone: "success" as const }),
    target: $$notifications.inputs.shown,
  });

  sample({
    clock: confirmMutation.finished.success,
    fn: () => ({ replace: true, query: {} }),
    target: routes.home.open,
  });

  const expiredFailure = sample({
    clock: confirmMutation.finished.failure,
    source: $$session.outputs.$isAuthenticated,
    filter: (_, { error }) => toApiError(error).code === "AUTH_CONFIRMATION_LINK_EXPIRED",
    fn: (isAuthenticated, { params }) => ({ isAuthenticated, token: params }),
  });

  sample({
    clock: expiredFailure,
    filter: ({ isAuthenticated }) => isAuthenticated,
    fn: () => ({ replace: true, query: {} }),
    target: routes.home.open,
  });

  sample({
    clock: expiredFailure,
    filter: ({ isAuthenticated }) => !isAuthenticated,
    fn: ({ token }) => token,
    target: linkExpired,
  });

  sample({
    clock: confirmMutation.finished.failure,
    filter: ({ error }) => toApiError(error).code !== "AUTH_CONFIRMATION_LINK_EXPIRED",
    fn: ({ error }) => toApiError(error).message,
    target: $error,
  });

  sample({
    clock: confirmMutation.finished.failure,
    filter: ({ error }) => toApiError(error).code !== "AUTH_CONFIRMATION_LINK_EXPIRED",
    fn: () => "failed" as const,
    target: $screen,
  });

  sample({ clock: linkExpired, fn: () => "expired" as const, target: $screen });

  sample({
    clock: linkExpired,
    fn: (token) => ({ request: { token }, resendAfter: 0 }),
    target: $$resend.inputs.started,
  });

  sample({ clock: $$resend.outputs.sent, fn: () => "sent" as const, target: $screen });

  sample({ clock: routes.confirmEmail.closed, fn: () => null, target: [$token, $requestedToken, $error] });

  sample({ clock: routes.confirmEmail.closed, fn: () => "pending" as const, target: $screen });

  sample({ clock: routes.confirmEmail.closed, target: $$resend.inputs.reset });

  return {
    inputs: { retryPressed },

    outputs: {
      $$resend,
      $screen: readonly($screen),
      $error: readonly($error),
      $pending: readonly($pending),
    },
  };
});

export type ConfirmEmailPageModel = ReturnType<typeof createConfirmEmailPageFactory>;
