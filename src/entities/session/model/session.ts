import { createFactory } from "@withease/factories";
import { createEvent, createStore, sample } from "effector";
import { readonly } from "patronum";

import { appStarted } from "@/shared/config/init";

import { createSessionStub, type SessionUser } from "../api";

export type SessionStatus = "unknown" | "guest" | "authenticated";

export const createSessionFactory = createFactory(() => {
  const { sessionQuery, signInMutation, signOutMutation } = createSessionStub();

  const sessionCheckRequested = createEvent();
  const signedIn = createEvent();
  const signedOut = createEvent();
  const statusResolved = createEvent<Exclude<SessionStatus, "unknown">>();

  const $status = createStore<SessionStatus>("unknown");
  const $user = createStore<SessionUser | null>(null);
  const $isAuthenticated = $status.map((status) => status === "authenticated");

  sample({ clock: appStarted, target: sessionCheckRequested });
  sample({ clock: sessionCheckRequested, target: sessionQuery.start });

  sample({ clock: signedIn, target: signInMutation.start });
  sample({ clock: signInMutation.finished.success, target: sessionQuery.start });

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

  return {
    __: { sessionQuery, signInMutation, signOutMutation },
    inputs: { sessionCheckRequested, signedIn, signedOut },
    outputs: {
      $status: readonly($status),
      $user: readonly($user),
      $isAuthenticated,
      statusResolved: readonly(statusResolved),
    },
  };
});
