import { type Query } from "@effector/router";

import { parseReturnPath } from "@/shared/routes";

export type MovieListIntent = {
  movieId: string;
  list: "want_to_watch" | "watched";
  selected: boolean;
};

export type StoredMovieListIntent = {
  intent: MovieListIntent;
  returnPath: string;
  expiresAt: number;
};

export const MOVIE_LIST_INTENT_KEY = "dejaview:movie-list-intent";

const INTENT_LIFETIME = 24 * 60 * 60 * 1000;

export const isMovieListIntent = (value: unknown): value is MovieListIntent => {
  if (typeof value !== "object" || value === null) return false;

  const intent = value as Partial<MovieListIntent>;

  return (
    typeof intent.movieId === "string" &&
    /^[1-9]\d*$/.test(intent.movieId) &&
    Number.isSafeInteger(Number(intent.movieId)) &&
    (intent.list === "want_to_watch" || intent.list === "watched") &&
    typeof intent.selected === "boolean"
  );
};

export const createStoredIntent = (intent: MovieListIntent, query: Query): StoredMovieListIntent => {
  const search = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) =>
      (Array.isArray(value) ? value : [value]).filter((item) => item !== null).map((item) => [key, String(item)]),
    ),
  ).toString();
  const path = `/movies/${intent.movieId}`;

  return { intent, returnPath: search ? `${path}?${search}` : path, expiresAt: Date.now() + INTENT_LIFETIME };
};

export const isIntentLocation = (
  record: StoredMovieListIntent,
  { path, query }: { path: string | null; query: Query },
) => {
  if (path === null) return true;

  const moviePath = `/movies/${record.intent.movieId}`;

  if (path === moviePath) return true;

  if (path === "/login" || path === "/register") return parseReturnPath(query.redirect).path === moviePath;

  // These callbacks have no redirect parameter: the browser retained the intent before leaving for authentication.
  return path === "/auth/oidc" || path === "/confirm-email";
};

export const saveMovieListIntent = (record: StoredMovieListIntent | null) => {
  try {
    if (record) sessionStorage.setItem(MOVIE_LIST_INTENT_KEY, JSON.stringify(record));
    else sessionStorage.removeItem(MOVIE_LIST_INTENT_KEY);
  } catch {
    return;
  }
};

export const readMovieListIntent = (): StoredMovieListIntent | null => {
  try {
    const value = JSON.parse(sessionStorage.getItem(MOVIE_LIST_INTENT_KEY) ?? "null") as unknown;

    if (typeof value === "object" && value !== null) {
      const record = value as Partial<StoredMovieListIntent>;

      if (
        isMovieListIntent(record.intent) &&
        typeof record.returnPath === "string" &&
        parseReturnPath(record.returnPath).path === `/movies/${record.intent.movieId}` &&
        typeof record.expiresAt === "number" &&
        record.expiresAt > Date.now() &&
        record.expiresAt <= Date.now() + INTENT_LIFETIME
      ) {
        return record as StoredMovieListIntent;
      }
    }
  } catch {
    // Storage may be disabled or contain an incomplete value from an older application version.
  }

  saveMovieListIntent(null);

  return null;
};
