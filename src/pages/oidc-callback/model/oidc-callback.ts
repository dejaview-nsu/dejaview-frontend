import { createFactory, invoke } from "@withease/factories";
import { createEffect, createEvent, createStore, sample } from "effector";
import { readonly } from "patronum";

import { getOidcProviderName, takeOidcReturnPath } from "@/features/oidc-sign-in";

import { $$session } from "@/entities/session";

import { toApiError } from "@/shared/api";
import { INTERNAL_ERROR_MESSAGE, OIDC_MESSAGES } from "@/shared/config/auth-messages";
import { $$notifications } from "@/shared/lib/notifications";
import { parseReturnPath, router, routes } from "@/shared/routes";

import { createOidcCallbackApi } from "../api/request";
import { createOidcCompletionFactory } from "./completion";
import { createOidcLinkFactory } from "./link";

export type OidcScreen = "pending" | "registration" | "link" | "blocked" | "unavailable";

const RESULTS = ["success", "registration_required", "link_required", "account_blocked", "error"] as const;

export type OidcResult = (typeof RESULTS)[number];

const toResult = (value: unknown): OidcResult => RESULTS.find((result) => result === value) ?? "error";

export const createOidcCallbackPageFactory = createFactory(() => {
  const { pendingQuery, completeMutation } = createOidcCallbackApi();
  const $$completion = invoke(createOidcCompletionFactory, { completeMutation });
  const $$link = invoke(createOidcLinkFactory);

  const failed = createEvent();
  const signedIn = createEvent();

  const takeReturnPathFx = createEffect(takeOidcReturnPath);

  const $result = createStore<OidcResult | null>(null);
  const $providerName = createStore<string | null>(null);
  const $screen = createStore<OidcScreen>("pending");
  const $error = createStore<string | null>(null);

  const opened = sample({
    clock: routes.oidcCallback.opened,
    source: router.$query,
    fn: (query) => ({ result: toResult(query.result), providerName: getOidcProviderName(query.provider) }),
  });

  sample({ clock: opened, fn: ({ result }) => result, target: $result });

  sample({ clock: opened, fn: ({ providerName }) => providerName, target: $providerName });

  sample({ clock: opened, fn: () => "pending" as const, target: $screen });

  sample({
    clock: opened,
    filter: ({ result }) => result === "success",
    target: $$session.inputs.sessionCheckRequested,
  });

  sample({
    clock: opened,
    filter: ({ result }) => result === "registration_required" || result === "link_required",
    target: pendingQuery.start,
  });

  sample({
    clock: opened,
    filter: ({ result }) => result === "account_blocked",
    fn: () => "blocked" as const,
    target: $screen,
  });

  sample({ clock: opened, filter: ({ result }) => result === "error", target: failed });

  sample({
    clock: $$session.outputs.statusResolved,
    source: { result: $result, opened: routes.oidcCallback.$isOpened },
    filter: ({ result, opened }, status) => opened && result === "success" && status === "authenticated",
    target: takeReturnPathFx,
  });

  sample({
    clock: $$session.outputs.statusResolved,
    source: { result: $result, opened: routes.oidcCallback.$isOpened },
    filter: ({ result, opened }, status) => opened && result === "success" && status === "guest",
    target: failed,
  });

  sample({
    clock: takeReturnPathFx.doneData,
    fn: (path) => ({ ...parseReturnPath(path ?? "/"), replace: true }),
    target: router.navigate,
  });

  sample({
    clock: pendingQuery.finished.success,
    fn: ({ result }) => getOidcProviderName(result.provider),
    target: $providerName,
  });

  sample({
    clock: pendingQuery.finished.success,
    fn: ({ result }) => (result.kind === "registration" ? ("registration" as const) : ("link" as const)),
    target: $screen,
  });

  sample({
    clock: pendingQuery.finished.success,
    filter: ({ result }) => result.kind === "registration",
    fn: ({ result }) => result.suggested_username ?? "",
    target: $$completion.inputs.prefilled,
  });

  sample({
    clock: pendingQuery.finished.success,
    filter: ({ result }) => result.kind === "link",
    fn: ({ result }) => result.email,
    target: $$link.inputs.emailReceived,
  });

  sample({
    clock: pendingQuery.finished.failure,
    filter: ({ error }) => toApiError(error).code === "AUTH_OIDC_EXPIRED",
    target: failed,
  });

  sample({
    clock: pendingQuery.finished.failure,
    filter: ({ error }) => toApiError(error).code !== "AUTH_OIDC_EXPIRED",
    fn: ({ error }) =>
      toApiError(error).code === "INTERNAL_ERROR" ? INTERNAL_ERROR_MESSAGE : toApiError(error).message,
    target: $error,
  });

  sample({
    clock: pendingQuery.finished.failure,
    filter: ({ error }) => toApiError(error).code !== "AUTH_OIDC_EXPIRED",
    fn: () => "unavailable" as const,
    target: $screen,
  });

  sample({ clock: [$$completion.outputs.expired, $$link.outputs.expired], target: failed });

  sample({ clock: $$completion.outputs.completed, target: $$session.inputs.sessionCreated });

  sample({ clock: $$completion.outputs.completed, target: signedIn });

  sample({
    clock: $$session.outputs.statusResolved,
    source: { screen: $screen, opened: routes.oidcCallback.$isOpened },
    filter: ({ screen, opened }, status) => opened && screen === "link" && status === "authenticated",
    target: signedIn,
  });

  sample({ clock: signedIn, fn: () => ({ replace: true, query: {} }), target: routes.home.open });

  sample({
    clock: failed,
    source: $providerName,
    filter: (provider): provider is string => provider !== null,
    fn: (provider) => ({ text: OIDC_MESSAGES.signInFailed(provider as string), tone: "error" as const }),
    target: $$notifications.inputs.shown,
  });

  sample({ clock: failed, fn: () => ({ replace: true, query: {} }), target: routes.register.open });

  sample({ clock: routes.oidcCallback.closed, fn: () => null, target: [$result, $providerName, $error] });

  sample({ clock: routes.oidcCallback.closed, fn: () => "pending" as const, target: $screen });

  sample({ clock: routes.oidcCallback.closed, target: [$$completion.inputs.reset, $$link.inputs.reset] });

  return {
    __: { takeReturnPathFx },

    outputs: {
      $$completion,
      $$link,
      $screen: readonly($screen),
      $providerName: readonly($providerName),
      $error: readonly($error),
    },
  };
});
