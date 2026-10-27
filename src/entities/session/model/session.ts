import { concurrency } from "@farfetched/core";
import { createFactory } from "@withease/factories";
import { combine, createEvent, createStore, merge, sample } from "effector";
import { not, readonly } from "patronum";

import { type ApiError, sessionRequired, toApiError } from "@/shared/api";
import { appStarted } from "@/shared/config/init";
import { $$notifications } from "@/shared/lib/notifications";
import { loginRedirectRequested, router, routes } from "@/shared/routes";

import { createSessionApi, type SessionCredentials, type SessionInfo, type SessionUser } from "../api";
import { toLocationPath } from "./location";

export type SessionStatus = "unknown" | "guest" | "authenticated";

export const createSessionFactory = createFactory(() => {
  const { sessionQuery, signInMutation, signOutMutation } = createSessionApi();

  const sessionCheckRequested = createEvent();
  const signedIn = createEvent<SessionCredentials>();
  const signInStarted = createEvent<SessionCredentials>();
  const signInCancelled = createEvent();
  const signedOut = createEvent();
  const signOutStarted = createEvent();
  const signOutCompleted = createEvent();
  const sessionCreated = createEvent<SessionInfo>();
  const statusResolved = createEvent<Exclude<SessionStatus, "unknown">>();
  const loginDialogRequested = createEvent<{ path: string; replace: boolean }>();
  const loginPressed = createEvent();
  const loginDialogDismissed = createEvent();
  const loginDialogClosed = createEvent();

  const authCancelled = merge([signInCancelled, signOutStarted]);

  const $status = createStore<SessionStatus>("unknown");
  const $user = createStore<SessionUser | null>(null);
  const $loginDialogPath = createStore<string | null>(null);
  const $loginError = createStore<ApiError | null>(null);
  const $isCheckingAfterLogin = createStore(false);

  const $isAuthenticated = $status.map((status) => status === "authenticated");
  const $isLoginDialogOpened = $loginDialogPath.map((path) => path !== null);
  const $isSigningIn = combine(signInMutation.$pending, $isCheckingAfterLogin, (login, checking) => login || checking);
  const $isSigningOut = signOutMutation.$pending;
  const $canSignIn = combine($isSigningIn, $isSigningOut, (signingIn, signingOut) => !signingIn && !signingOut);
  const $canSignOut = combine($isAuthenticated, $isSigningOut, (authenticated, pending) => authenticated && !pending);

  concurrency(sessionQuery, { strategy: "TAKE_LATEST", abortAll: authCancelled });

  // TAKE_FIRST retains its lock after abort; duplicate submissions are gated by $canSignIn.
  concurrency(signInMutation, { strategy: "TAKE_LATEST", abortAll: authCancelled });

  concurrency(signOutMutation, { strategy: "TAKE_FIRST" });

  sample({ clock: appStarted, target: sessionCheckRequested });

  sample({ clock: sessionCheckRequested, filter: not($isSigningOut), target: sessionQuery.start });

  sample({ clock: signedIn, filter: $canSignIn, target: signInStarted });

  sample({ clock: signInStarted, fn: () => null, target: $loginError });

  sample({ clock: signInStarted, target: signInMutation.start });

  sample({ clock: signInMutation.finished.success, fn: () => true, target: $isCheckingAfterLogin });

  sample({ clock: signInMutation.finished.success, target: sessionQuery.start });

  sample({ clock: signInMutation.finished.failure, fn: ({ error }) => toApiError(error), target: $loginError });

  sample({
    clock: sessionQuery.finished.failure,
    filter: $isCheckingAfterLogin,
    fn: ({ error }) => toApiError(error),
    target: $loginError,
  });

  sample({ clock: [sessionQuery.finished.finally, authCancelled], fn: () => false, target: $isCheckingAfterLogin });

  sample({ clock: [routes.login.closed, authCancelled], fn: () => null, target: $loginError });

  sample({ clock: signedOut, filter: $canSignOut, target: signOutStarted });

  sample({ clock: signOutStarted, target: signOutMutation.start });

  sample({ clock: signOutMutation.finished.success, target: signOutCompleted });

  sample({
    clock: signOutMutation.finished.failure,
    filter: ({ error }) => toApiError(error).status === 401,
    target: signOutCompleted,
  });

  sample({
    clock: signOutMutation.finished.failure,
    filter: ({ error }) => toApiError(error).status !== 401,
    fn: ({ error }) => ({ text: toApiError(error).message, tone: "error" as const }),
    target: $$notifications.inputs.shown,
  });

  sample({ clock: sessionQuery.finished.success, fn: () => "authenticated" as const, target: statusResolved });

  sample({
    clock: [sessionQuery.finished.failure, signOutCompleted],
    fn: () => "guest" as const,
    target: statusResolved,
  });

  sample({ clock: statusResolved, target: $status });

  sample({ clock: sessionQuery.finished.success, fn: ({ result }) => result.user, target: $user });

  sample({ clock: sessionCreated, fn: ({ user }) => user, target: $user });

  sample({ clock: sessionCreated, fn: () => "authenticated" as const, target: statusResolved });

  sample({ clock: statusResolved, filter: (status) => status === "guest", fn: () => null, target: $user });

  sample({
    clock: signOutCompleted,
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

  sample({
    clock: loginPressed,
    source: { path: router.$path, query: router.$query },
    fn: (location) => ({ path: toLocationPath(location), replace: false }),
    target: loginRequired,
  });

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
    source: { isPending: $isLoginRedirectPending, isOnAuthPage: $isOnAuthPage, isSigningOut: $isSigningOut },
    filter: ({ isPending, isOnAuthPage, isSigningOut }) => !isPending && !isOnAuthPage && !isSigningOut,
    fn: (_, redirect) => redirect,
    target: loginRedirectStarted,
  });

  sample({ clock: loginRedirectStarted, fn: () => true, target: $isLoginRedirectPending });

  sample({ clock: loginRedirectStarted, filter: ({ replace }) => replace, target: loginRedirectRequested });

  sample({ clock: loginRedirectStarted, filter: ({ replace }) => !replace, target: loginDialogRequested });

  sample({ clock: loginDialogRequested, fn: ({ path }) => path, target: $loginDialogPath });

  sample({ clock: loginDialogDismissed, target: loginDialogClosed });

  sample({ clock: router.$path, filter: $isLoginDialogOpened, target: loginDialogDismissed });

  sample({ clock: statusResolved, filter: (status) => status === "authenticated", target: loginDialogClosed });

  sample({ clock: loginDialogClosed, fn: () => null, target: $loginDialogPath });

  sample({ clock: loginDialogClosed, fn: () => false, target: $isLoginRedirectPending });

  sample({ clock: routes.login.opened, fn: () => false, target: $isLoginRedirectPending });

  return {
    __: { sessionQuery, signInMutation, signOutMutation },
    registry: { protectedRoutes },
    inputs: {
      sessionCheckRequested,
      signedIn,
      signInCancelled,
      signedOut,
      sessionCreated,
      loginRequired,
      loginPressed,
      loginDialogDismissed,
    },
    outputs: {
      $status: readonly($status),
      $user: readonly($user),
      $isAuthenticated,
      $isSigningIn: readonly($isSigningIn),
      $isSigningOut: readonly($isSigningOut),
      $loginError: readonly($loginError),
      $isLoginDialogOpened,
      $loginDialogPath: readonly($loginDialogPath),
      loginDialogDismissed: readonly(loginDialogDismissed),
      statusResolved: readonly(statusResolved),
    },
  };
});
