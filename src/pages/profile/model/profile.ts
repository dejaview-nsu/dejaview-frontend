import { concurrency, createMutation } from "@farfetched/core";
import { createFactory } from "@withease/factories";
import { createEvent, createStore, sample } from "effector";
import { readonly } from "patronum";

import { isSessionError, toApiError, type UserProfile } from "@/shared/api";

import { getProfile } from "../api/request";

type Status = "idle" | "loading" | "ready" | "failed";
type Request = { revision: number; silent: boolean };

export const createProfileFactory = createFactory(() => {
  const opened = createEvent();
  const closed = createEvent();
  const retryPressed = createEvent();
  const refreshed = createEvent();
  const loadStarted = createEvent<Request>();

  const profileMutation = createMutation<Request, UserProfile>({ name: "profile.get", handler: getProfile });

  const $revision = createStore(0);
  const $profile = createStore<UserProfile | null>(null);
  const $status = createStore<Status>("idle");

  concurrency(profileMutation, { strategy: "TAKE_LATEST", abortAll: closed });

  sample({
    clock: [opened, retryPressed],
    source: { revision: $revision, status: $status },
    filter: ({ status }) => status === "idle" || status === "failed",
    fn: ({ revision }) => ({ revision: revision + 1, silent: false }),
    target: loadStarted,
  });

  sample({
    clock: refreshed,
    source: { revision: $revision, status: $status },
    filter: ({ status }) => status === "ready",
    fn: ({ revision }) => ({ revision: revision + 1, silent: true }),
    target: loadStarted,
  });

  sample({ clock: loadStarted, fn: ({ revision }) => revision, target: $revision });

  sample({ clock: loadStarted, filter: ({ silent }) => !silent, fn: () => "loading" as const, target: $status });

  sample({ clock: loadStarted, target: profileMutation.start });

  const loaded = sample({
    clock: profileMutation.finished.success,
    source: $revision,
    filter: (revision, { params }) => revision === params.revision,
    fn: (_, { result }) => result,
  });

  sample({ clock: loaded, target: $profile });

  sample({ clock: loaded, fn: () => "ready" as const, target: $status });

  sample({
    clock: profileMutation.finished.failure,
    source: $revision,
    filter: (revision, { params, error }) =>
      revision === params.revision && !params.silent && !isSessionError(toApiError(error)),
    fn: () => "failed" as const,
    target: $status,
  });

  sample({ clock: closed, source: $revision, fn: (revision) => revision + 1, target: $revision });

  sample({ clock: closed, fn: () => null, target: $profile });

  sample({ clock: closed, fn: () => "idle" as const, target: $status });

  return {
    inputs: { opened, closed, retryPressed, refreshed },
    outputs: { $profile: readonly($profile), $status: readonly($status) },
    __: { profileMutation },
  };
});
