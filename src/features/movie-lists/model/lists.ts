import { concurrency, createMutation } from "@farfetched/core";
import { createFactory } from "@withease/factories";
import { combine, createEvent, createStore, sample } from "effector";
import { readonly } from "patronum";

import { isSessionError, type ListTypePath, toApiError, type UserMovieState } from "@/shared/api";

import { changeMovieList, getMovieLists } from "../api/request";

type Viewer = { status: "unknown" | "guest" | "authenticated"; userKey: string | null };
type Context = Viewer & { movieId: string | null };
type Request = { movieId: string; revision: number };
type Intent = { movieId: string; list: ListTypePath; selected: boolean };
type Change = Intent & { revision: number };
type Status = "idle" | "loading" | "ready" | "failed";

const emptyMembership: UserMovieState = { want_to_watch: false, watched: false };

export const createMovieListsFactory = createFactory(() => {
  const opened = createEvent<string>();
  const closed = createEvent();
  const sessionChanged = createEvent<Viewer>();
  const togglePressed = createEvent<ListTypePath>();
  const retryPressed = createEvent();
  const resumeRequested = createEvent<Intent>();
  const contextChanged = createEvent<Context>();
  const loadRequested = createEvent<Request>();
  const changeRequested = createEvent<Change>();
  const intentRequested = createEvent<Intent>();
  const intentConsumed = createEvent();
  const loginRequested = createEvent();
  const guestDetected = createEvent();

  const stateMutation = createMutation({
    name: "movieLists.state",
    handler: ({ movieId }: Request) => getMovieLists(movieId),
  });
  const changeMutation = createMutation({
    name: "movieLists.change",
    handler: (change: Change) => changeMovieList(change),
  });

  const $context = createStore<Context>({ movieId: null, status: "unknown", userKey: null });
  const $revision = createStore(0);
  const $membership = createStore<UserMovieState | null>(null);
  const $status = createStore<Status>("idle");
  const $change = createStore<Change | null>(null);
  const $pending = createStore(false);
  const $error = createStore<string | null>(null);

  const $canToggle = combine(
    $context,
    $status,
    $pending,
    (context, status, pending) => context.movieId !== null && status === "ready" && !pending,
  );
  const $state = combine(
    {
      context: $context,
      status: $status,
      membership: $membership,
      pending: $pending,
      error: $error,
      canToggle: $canToggle,
    },
    ({ context, ...state }) => ({
      ...state,
      movieId: context.movieId,
      authenticated: context.status === "authenticated",
    }),
  );

  concurrency(stateMutation, { strategy: "TAKE_LATEST", abortAll: contextChanged });
  concurrency(changeMutation, { strategy: "TAKE_LATEST", abortAll: contextChanged });

  sample({
    clock: opened,
    source: $context,
    filter: (context, movieId) => context.movieId !== movieId,
    fn: (context, movieId) => ({ ...context, movieId }),
    target: contextChanged,
  });

  sample({ clock: closed, source: $context, fn: (context) => ({ ...context, movieId: null }), target: contextChanged });

  sample({
    clock: sessionChanged,
    source: $context,
    filter: (context, viewer) => context.status !== viewer.status || context.userKey !== viewer.userKey,
    fn: (context, viewer) => ({ ...context, ...viewer }),
    target: contextChanged,
  });

  sample({ clock: contextChanged, target: $context });

  sample({ clock: contextChanged, source: $revision, fn: (revision) => revision + 1, target: $revision });

  sample({ clock: contextChanged, fn: () => null, target: [$membership, $change, $error] });

  sample({ clock: contextChanged, fn: () => false, target: $pending });

  sample({
    clock: contextChanged,
    fn: ({ movieId, status }) => (movieId && status === "guest" ? "ready" : "idle") as Status,
    target: $status,
  });

  sample({
    clock: contextChanged,
    filter: ({ movieId, status }) => movieId !== null && status === "guest",
    fn: () => emptyMembership,
    target: $membership,
  });

  sample({
    clock: contextChanged,
    source: $revision,
    filter: (_, context) => context.movieId !== null && context.status === "authenticated",
    fn: (revision, context) => ({ movieId: context.movieId!, revision }),
    target: loadRequested,
  });

  sample({
    clock: retryPressed,
    source: { context: $context, revision: $revision, status: $status },
    filter: ({ context, status }) =>
      context.movieId !== null && context.status === "authenticated" && status === "failed",
    fn: ({ context, revision }) => ({ movieId: context.movieId!, revision }),
    target: loadRequested,
  });

  sample({ clock: loadRequested, fn: () => "loading" as const, target: $status });

  sample({ clock: [loadRequested, changeRequested], fn: () => null, target: $error });

  sample({ clock: loadRequested, target: stateMutation.start });

  const stateLoaded = sample({
    clock: stateMutation.finished.success,
    source: $revision,
    filter: (revision, { params }) => revision === params.revision,
    fn: (_, { result }) => result,
  });

  sample({ clock: stateLoaded, target: $membership });

  sample({ clock: stateLoaded, fn: () => "ready" as const, target: $status });

  const loadFailed = sample({
    clock: stateMutation.finished.failure,
    source: $revision,
    filter: (revision, { params }) => revision === params.revision,
    fn: (_, { error }) => toApiError(error),
  });

  sample({ clock: loadFailed, filter: isSessionError, target: guestDetected });

  sample({
    clock: guestDetected,
    source: $context,
    fn: (context) => ({ ...context, status: "guest" as const, userKey: null }),
    target: contextChanged,
  });

  sample({
    clock: loadFailed,
    filter: (error) => !isSessionError(error),
    fn: () => "failed" as const,
    target: $status,
  });

  sample({
    clock: loadFailed,
    filter: (error) => !isSessionError(error),
    fn: (error) => error.message,
    target: $error,
  });

  sample({
    clock: togglePressed,
    source: { context: $context, canToggle: $canToggle },
    filter: ({ context, canToggle }) => canToggle && context.status === "guest",
    fn: ({ context }, list) => ({ movieId: context.movieId!, list, selected: true }),
    target: intentRequested,
  });

  sample({
    clock: togglePressed,
    source: { context: $context, membership: $membership, revision: $revision, canToggle: $canToggle },
    filter: ({ context, canToggle }) => canToggle && context.status === "authenticated",
    fn: ({ context, membership, revision }, list) => ({
      movieId: context.movieId!,
      revision,
      list,
      selected: !membership![list],
    }),
    target: changeRequested,
  });

  sample({ clock: intentRequested, target: loginRequested });

  sample({
    clock: resumeRequested,
    source: { context: $context, revision: $revision, canToggle: $canToggle },
    filter: ({ context, canToggle }, intent) =>
      canToggle && context.status === "authenticated" && context.movieId === intent.movieId,
    fn: ({ revision }, intent) => ({ ...intent, revision }),
    target: changeRequested,
  });

  sample({
    clock: retryPressed,
    source: { change: $change, canToggle: $canToggle, error: $error },
    filter: ({ change, canToggle, error }) => change !== null && canToggle && error !== null,
    fn: ({ change }) => change!,
    target: changeRequested,
  });

  sample({ clock: changeRequested, target: $change });

  sample({ clock: changeRequested, fn: () => true, target: $pending });

  sample({ clock: changeRequested, target: intentConsumed });

  sample({ clock: changeRequested, target: changeMutation.start });

  const changed = sample({
    clock: changeMutation.finished.success,
    source: $revision,
    filter: (revision, { params }) => revision === params.revision,
    fn: (_, { params }) => params,
  });

  sample({
    clock: changed,
    source: $membership,
    fn: (membership, { list, selected }) => ({ ...membership!, [list]: selected }),
    target: $membership,
  });

  sample({ clock: changed, fn: () => null, target: $change });

  const changeFailed = sample({
    clock: changeMutation.finished.failure,
    source: $revision,
    filter: (revision, { params }) => revision === params.revision,
    fn: (_, { params, error }) => ({ params, error: toApiError(error) }),
  });

  sample({ clock: [changed, changeFailed], fn: () => false, target: $pending });

  sample({
    clock: changeFailed,
    filter: ({ error }) => !isSessionError(error),
    fn: ({ error }) => error.message,
    target: $error,
  });

  sample({ clock: changeFailed, filter: ({ error }) => isSessionError(error), target: guestDetected });

  sample({
    clock: changeFailed,
    filter: ({ error }) => isSessionError(error),
    fn: ({ params }) => params,
    target: intentRequested,
  });

  return {
    inputs: { opened, closed, sessionChanged, togglePressed, retryPressed, resumeRequested },
    outputs: {
      $state,
      intentRequested: readonly(intentRequested),
      intentConsumed: readonly(intentConsumed),
      loginRequested: readonly(loginRequested),
      guestDetected: readonly(guestDetected),
    },
    __: { stateMutation, changeMutation },
  };
});
