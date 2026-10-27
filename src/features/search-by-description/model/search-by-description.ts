import { concurrency, createMutation, onAbort } from "@farfetched/core";
import { createFactory } from "@withease/factories";
import { createEvent, createStore, sample, type Store } from "effector";
import { readonly } from "patronum";

import { type MovieSearchResult, searchByText, toApiError } from "@/shared/api";

import { QUERY_MAX_LENGTH, type QueryErrorCode } from "../config";
import { checkQuery, countCharacters, normalizeQuery, type TextSearchError, toTextSearchError } from "../lib";

export const TEXT_SEARCH_RESULTS_LIMIT = 10;

export type QueryChange = { text: string; pasted?: boolean };

const isAcceptedChange = (current: string, { text, pasted = false }: QueryChange) => {
  const length = countCharacters(text);

  return pasted || length <= QUERY_MAX_LENGTH || length <= countCharacters(current);
};

export const createSearchByDescriptionFactory = createFactory(({ $allowed }: { $allowed: Store<boolean> }) => {
  const queryChanged = createEvent<QueryChange>();
  const queryAccepted = createEvent<string>();
  const searchPressed = createEvent();
  const cancelled = createEvent();
  const queryRejected = createEvent<QueryErrorCode>();

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
  const $error = createStore<TextSearchError | null>(null);
  const $pending = searchMutation.$pending;

  const $length = $query.map(countCharacters);
  const $isOverLimit = $length.map((length) => length > QUERY_MAX_LENGTH);
  const $fieldError = $error.map((error) => (error?.kind === "query" ? error.code : null));
  const $isUnavailable = $error.map((error) => error?.kind === "unavailable");
  const $isEmpty = $results.map((results) => results !== null && results.length === 0);

  sample({
    clock: queryChanged,
    source: $query,
    filter: isAcceptedChange,
    fn: (_, { text }) => text,
    target: queryAccepted,
  });

  sample({ clock: queryAccepted, target: $query });

  sample({
    clock: queryAccepted,
    source: $error,
    filter: (error) => error?.kind === "query",
    fn: () => null,
    target: $error,
  });

  const queryValidated = sample({
    clock: searchPressed,
    source: { query: $query, allowed: $allowed, pending: $pending },
    filter: ({ allowed, pending }) => allowed && !pending,
    fn: ({ query }) => {
      const normalized = normalizeQuery(query);

      return { query: normalized, error: checkQuery(normalized) };
    },
  });

  sample({
    clock: queryValidated,
    filter: ({ error }) => error !== null,
    fn: ({ error }) => error as QueryErrorCode,
    target: queryRejected,
  });

  sample({ clock: queryRejected, fn: (code): TextSearchError => ({ kind: "query", code }), target: $error });

  sample({
    clock: queryValidated,
    filter: ({ error }) => error === null,
    fn: ({ query }) => query,
    target: searchMutation.start,
  });

  sample({ clock: searchMutation.start, target: $submittedQuery });

  sample({ clock: [searchMutation.start, queryRejected], fn: () => null, target: $results });

  sample({ clock: searchMutation.start, fn: () => null, target: $error });

  sample({
    clock: searchMutation.finished.success,
    fn: ({ result }) => result.results.slice(0, TEXT_SEARCH_RESULTS_LIMIT),
    target: $results,
  });

  sample({
    clock: searchMutation.finished.failure,
    fn: ({ error }) => toTextSearchError(toApiError(error)),
    target: $error,
  });

  sample({ clock: $allowed, filter: (allowed) => !allowed, target: cancelled });

  return {
    __: { searchMutation },

    inputs: { queryChanged, searchPressed, cancelled },

    outputs: {
      $query: readonly($query),
      $length,
      $isOverLimit,
      $submittedQuery: readonly($submittedQuery),
      $results: readonly($results),
      $error: readonly($error),
      $fieldError,
      $isUnavailable,
      $pending,
      $isEmpty,
    },
  };
});
