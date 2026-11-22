import { type Query } from "@effector/router";
import { createFactory, invoke } from "@withease/factories";
import { createEffect, createEvent, createStore, sample } from "effector";

import { $$session } from "@/entities/session";

import { router } from "@/shared/routes";

import {
  createStoredIntent,
  isIntentLocation,
  isMovieListIntent,
  type MovieListIntent,
  readMovieListIntent,
  saveMovieListIntent,
  type StoredMovieListIntent,
} from "../lib/intent-storage";

export const createMovieListIntentFactory = createFactory(() => {
  const requested = createEvent<MovieListIntent>();
  const consumed = createEvent();
  const cancelled = createEvent();
  const restoreStarted = createEvent<number>();
  const recordChanged = createEvent<StoredMovieListIntent | null>();
  const recordRequested = createEvent<{ intent: MovieListIntent; query: Query; revision: number }>();

  const createRecordFx = createEffect(
    ({ intent, query, revision }: { intent: MovieListIntent; query: Query; revision: number }) => ({
      record: createStoredIntent(intent, query),
      revision,
    }),
  );
  const saveRecordFx = createEffect(saveMovieListIntent);
  const readRecordFx = createEffect((revision: number) => ({ revision, record: readMovieListIntent() }));

  const $record = createStore<StoredMovieListIntent | null>(null);
  const $revision = createStore(0);
  const $restored = createStore(false);

  const $intent = $record.map((record) => record?.intent ?? null);

  sample({
    clock: router.$path,
    source: { restored: $restored, revision: $revision },
    filter: ({ restored }, path) => !restored && path !== null,
    fn: ({ revision }) => revision,
    target: restoreStarted,
  });

  sample({ clock: restoreStarted, fn: () => true, target: $restored });

  sample({ clock: restoreStarted, target: readRecordFx });

  sample({
    clock: readRecordFx.doneData,
    source: { revision: $revision, path: router.$path, query: router.$query },
    filter: ({ revision }, response) => revision === response.revision,
    fn: ({ path, query }, { record }) => (record && isIntentLocation(record, { path, query }) ? record : null),
    target: recordChanged,
  });

  sample({
    clock: requested,
    source: { path: router.$path, query: router.$query, revision: $revision },
    filter: ({ path }, intent) => isMovieListIntent(intent) && path === `/movies/${intent.movieId}`,
    fn: ({ query, revision }, intent) => ({ intent, query, revision: revision + 1 }),
    target: recordRequested,
  });

  sample({ clock: recordRequested, fn: ({ revision }) => revision, target: $revision });

  sample({ clock: recordRequested, target: createRecordFx });

  sample({
    clock: createRecordFx.doneData,
    source: { revision: $revision, path: router.$path, query: router.$query },
    filter: ({ revision, path, query }, response) =>
      revision === response.revision && isIntentLocation(response.record, { path, query }),
    fn: (_, { record }) => record,
    target: recordChanged,
  });

  sample({ clock: [consumed, cancelled], source: $revision, fn: (revision) => revision + 1, target: $revision });

  sample({ clock: [consumed, cancelled], fn: () => null, target: recordChanged });

  sample({ clock: recordChanged, target: $record });

  sample({ clock: recordChanged, target: saveRecordFx });

  sample({
    clock: [router.$path, router.$query],
    source: { record: $record, path: router.$path, query: router.$query },
    filter: ({ record, path, query }) => record !== null && !isIntentLocation(record, { path, query }),
    target: cancelled,
  });

  sample({
    clock: $$session.outputs.loginDialogDismissed,
    source: { record: $record, path: router.$path },
    filter: ({ record, path }) => record !== null && path === `/movies/${record.intent.movieId}`,
    target: cancelled,
  });

  sample({ clock: $$session.inputs.signOutRequested, target: cancelled });

  return {
    inputs: { requested, consumed, cancelled },
    outputs: { $intent },
    __: { createRecordFx, saveRecordFx, readRecordFx },
  };
});

export const $$movieListIntent = invoke(createMovieListIntentFactory);

export type { MovieListIntent } from "../lib/intent-storage";
