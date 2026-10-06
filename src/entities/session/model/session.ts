import { createFactory } from "@withease/factories";
import { combine, createEvent, createStore, sample } from "effector";
import { not, readonly } from "patronum";

import { type ApiError, sessionRequired, toApiError } from "@/shared/api";
import { appStarted } from "@/shared/config/init";
import { loginRedirectRequested, router, routes } from "@/shared/routes";

import { createSessionApi, type SessionCredentials, type SessionUser } from "../api";
import { toLocationPath } from "./location";

export type SessionStatus = "unknown" | "guest" | "authenticated";

export const createSessionFactory = createFactory(() => {
  const { sessionQuery, signInMutation, signOutMutation } = createSessionApi();

  const sessionCheckRequested = createEvent();
  const signedIn = createEvent<SessionCredentials>();
  const signedOut = createEvent();
  const statusResolved = createEvent<Exclude<SessionStatus, "unknown">>();

  const $status = createStore<SessionStatus>("unknown");
  const $user = createStore<SessionUser | null>(null);
  const $isAuthenticated = $status.map((status) => status === "authenticated");

  sample({ clock: appStarted, target: sessionCheckRequested });
  sample({ clock: sessionCheckRequested, target: sessionQuery.start });

  const $loginError = createStore<ApiError | null>(null);
  const $isSigningIn = signInMutation.$pending;
  const $isCheckingAfterLogin = createStore(false);

  sample({ clock: signedIn, filter: not($isSigningIn), fn: () => null, target: $loginError });
  sample({ clock: signedIn, target: signInMutation.start });
  sample({ clock: signInMutation.finished.success, fn: () => true, target: $isCheckingAfterLogin });
  sample({ clock: signInMutation.finished.success, target: sessionQuery.start });
  sample({ clock: signInMutation.finished.failure, fn: ({ error }) => toApiError(error), target: $loginError });
  sample({
    clock: sessionQuery.finished.failure,
    filter: $isCheckingAfterLogin,
    fn: ({ error }) => toApiError(error),
    target: $loginError,
  });
  sample({ clock: sessionQuery.finished.finally, fn: () => false, target: $isCheckingAfterLogin });
  sample({ clock: routes.login.closed, fn: () => null, target: $loginError });

  sample({ clock: signedOut, target: signOutMutation.start });

  sample({ clock: sessionQuery.finished.success, fn: () => "authenticated" as const, target: statusResolved });
  sample({
    clock: [sessionQuery.finished.failure, signOutMutation.finished.finally],
    fn: () => "guest" as const,
    target: statusResolved,
  });

  sample({ clock: statusResolved, target: $status });
  sample({ clock: sessionQuery.finished.success, fn: ({ result }) => result.user, target: $user });
  sample({ clock: statusResolved, filter: (status) => status === "guest", fn: () => null, target: $user });

  sample({
    clock: signOutMutation.finished.finally,
    fn: () => ({ replace: true, query: {} }),
    target: routes.home.open,
  });

  const protectedRoutes = new Set<unknown>();
  const loginRedirectStarted = createEvent<{ path: string; replace: boolean }>();
  const $isLoginRedirectPending = createStore(false);
  const $isOnAuthPage = combine(
    routes.login.$isOpened,
    routes.register.$isOpened,
    (login, register) => login || register,
  );

  const loginRequired = createEvent<{ path: string; replace: boolean }>();

  sample({ clock: sessionRequired, fn: () => "guest" as const, target: statusResolved });

  sample({
    clock: sessionRequired,
    source: { path: router.$path, query: router.$query, activeRoutes: router.$activeRoutes },
    fn: ({ path, query, activeRoutes }) => ({
      path: toLocationPath({ path, query }),
      replace: activeRoutes.some((route) => protectedRoutes.has(route)),
    }),
    target: loginRequired,
  });

  sample({
    clock: loginRequired,
    source: { isPending: $isLoginRedirectPending, isOnAuthPage: $isOnAuthPage },
    filter: ({ isPending, isOnAuthPage }) => !isPending && !isOnAuthPage,
    fn: (_, redirect) => redirect,
    target: loginRedirectStarted,
  });

  sample({ clock: loginRedirectStarted, fn: () => true, target: $isLoginRedirectPending });
  sample({ clock: loginRedirectStarted, target: loginRedirectRequested });
  sample({ clock: routes.login.opened, fn: () => false, target: $isLoginRedirectPending });

  return {
    __: { sessionQuery, signInMutation, signOutMutation },
    registry: { protectedRoutes },
    inputs: { sessionCheckRequested, signedIn, signedOut, loginRequired },
    outputs: {
      $status: readonly($status),
      $user: readonly($user),
      $isAuthenticated,
      $isSigningIn: readonly($isSigningIn),
      $loginError: readonly($loginError),
      statusResolved: readonly(statusResolved),
    },
  };
});
