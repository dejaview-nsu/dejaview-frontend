import { concurrency, createMutation, onAbort } from "@farfetched/core";
import { createFactory } from "@withease/factories";
import { createEvent, createStore, sample, type Store } from "effector";
import { readonly } from "patronum";

import { type MovieSearchResult, searchByText, toApiError } from "@/shared/api";

const validateQuery = (rawQuery: string) => {
  const query = rawQuery.trim();
  const length = [...query].length;
  const error =
    length === 0
      ? "Введите описание фильма перед началом поиска."
      : length < 3
        ? "Описание должно содержать не менее 3 символов."
        : length > 250
          ? "Описание должно содержать не более 250 символов."
          : null;
  return { query, error };
};

export const createSearchByDescriptionFactory = createFactory(({ $allowed }: { $allowed: Store<boolean> }) => {
  const queryChanged = createEvent<string>();
  const searchPressed = createEvent();
  const cancelled = createEvent();

  const searchMutation = createMutation({
    name: "textSearch",
    handler: (query: string) => {
      const controller = new AbortController();
      onAbort(() => controller.abort());
      return searchByText({ query, signal: controller.signal });
    },
  });

  concurrency(searchMutation, { strategy: "TAKE_LATEST", abortAll: cancelled });

  const $query = createStore("");
  const $submittedQuery = createStore("");
  const $results = createStore<MovieSearchResult[] | null>(null);
  const $error = createStore<string | null>(null);
  const $pending = searchMutation.$pending;

  sample({ clock: queryChanged, target: $query });

  sample({ clock: searchMutation.start, target: $submittedQuery });

  const queryValidated = sample({
    clock: searchPressed,
    source: { query: $query, allowed: $allowed, pending: $pending },
    filter: ({ allowed, pending }) => allowed && !pending,
    fn: ({ query }) => validateQuery(query),
  });

  sample({ clock: queryChanged, target: cancelled });

  sample({ clock: $allowed, filter: (allowed) => !allowed, target: cancelled });

  sample({ clock: [queryChanged, cancelled, queryValidated], fn: () => null, target: $results });

  sample({ clock: [queryChanged, cancelled], fn: () => null, target: $error });

  sample({ clock: queryValidated, fn: ({ error }) => error, target: $error });

  sample({
    clock: queryValidated,
    filter: ({ error }) => error === null,
    fn: ({ query }) => query,
    target: searchMutation.start,
  });

  sample({ clock: searchMutation.finished.success, fn: ({ result }) => result.results, target: $results });

  sample({ clock: searchMutation.finished.failure, fn: ({ error }) => toApiError(error).message, target: $error });

  return {
    inputs: { queryChanged, searchPressed, cancelled },

    outputs: {
      $query: readonly($query),
      $submittedQuery: readonly($submittedQuery),
      $results: readonly($results),
      $error: readonly($error),
      $pending,
      $isEmpty: $results.map((results) => results !== null && results.length === 0),
    },
  };
});
