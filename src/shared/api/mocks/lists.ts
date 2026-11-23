import { z } from "zod";

import type { ListTypePath, UserListMovie, UserMovieState } from "../generated";
import { TransportError } from "../transport/errors";
import { COMMON_ERRORS } from "./fixtures";
import { findMockMovie } from "./movies";
import { clearMockSession, getMockUsername, hasMockSession } from "./session";
import { MOCK_STORAGE_KEYS, type MockStorage } from "./storage";
import { type MockHandler, mockResponse, wait } from "./utils";

type UserLists = Record<ListTypePath, number[]>;

const zStoredLists = z.object({
  want_to_watch: z.array(z.number().int().positive().safe()),
  watched: z.array(z.number().int().positive().safe()),
});

const storageKey = (storage: MockStorage) =>
  `${MOCK_STORAGE_KEYS.lists}:${encodeURIComponent(getMockUsername(storage))}`;

const DEMO_LISTS: UserLists = {
  want_to_watch: [157336, 603, 27205, 530915, 423, 49046, 332562, 1000001, 900000, 900001, 900002, 900003, 900004],
  watched: [603, 27205, 423, 157336],
};

const parseLists = (storage: MockStorage): UserLists | null => {
  try {
    const result = zStoredLists.safeParse(JSON.parse(storage.get(storageKey(storage)) ?? "null"));

    if (result.success) return result.data;
  } catch {
    // Old or manually edited development storage must not break the mock API.
  }

  return null;
};

export const readMockLists = (storage: MockStorage): UserLists => {
  const lists = parseLists(storage);

  if (lists) return lists;

  if (storage.get(MOCK_STORAGE_KEYS.listScenario) === "demo") {
    storage.set(storageKey(storage), JSON.stringify(DEMO_LISTS));

    return structuredClone(DEMO_LISTS);
  }

  return { want_to_watch: [], watched: [] };
};

const demoRating = (movieId: number) => (movieId === 1000001 ? null : (60 + (movieId % 40)) / 10);

const isListType = (value: string): value is ListTypePath => value === "want_to_watch" || value === "watched";
const isMovieId = (value: string) => /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
const notFound = () => mockResponse(404, { code: "MOVIE_NOT_FOUND", message: "Фильм не найден", field: null });
const invalid = (field: string) =>
  mockResponse(400, { code: "INVALID_PARAMETER", message: "Некорректный запрос", field });

type Failure = (storage: MockStorage) => ReturnType<typeof mockResponse>;

const expireSession: Failure = (storage) => {
  clearMockSession(storage);

  return mockResponse(401, COMMON_ERRORS.SESSION_EXPIRED);
};

const FAILURES: Record<string, Failure> = {
  error: () => mockResponse(500, COMMON_ERRORS.INTERNAL_ERROR),
  RATE_LIMITED: () => mockResponse(429, COMMON_ERRORS.RATE_LIMITED),
  INVALID_RESPONSE: () => mockResponse(200, { unexpected: true }),
  NETWORK_ERROR: () => {
    throw new TransportError("network");
  },
  TIMEOUT: () => {
    throw new TransportError("timeout");
  },
  SESSION_EXPIRED: expireSession,
};

const REMOVE_FAILURES: Record<string, Failure> = {
  error: FAILURES.error,
  rate_limited: FAILURES.RATE_LIMITED,
  invalid_parameter: () => invalid("list_type"),
  not_found: () => notFound(),
  invalid_response: () => mockResponse(418, "<html>I'm a teapot</html>"),
  network_error: FAILURES.NETWORK_ERROR,
  timeout: FAILURES.TIMEOUT,
  session_expired: expireSession,
};

const toListMovie = (movieId: number, demo: boolean): UserListMovie | null => {
  const movie = findMockMovie(movieId);

  return movie
    ? {
        movie_id: movieId,
        title: movie.title,
        poster_url: movie.poster_url,
        average_rating: demo ? demoRating(movieId) : null,
        user_rating: null,
      }
    : null;
};

export const userMovieLists: MockHandler = async ({ request, storage, delays }) => {
  const username = getMockUsername(storage);
  const authenticated = hasMockSession(storage);

  await wait(delays.jsonMs, request.signal);

  if (!authenticated || !hasMockSession(storage) || username !== getMockUsername(storage))
    return mockResponse(401, COMMON_ERRORS.SESSION_REQUIRED);

  const scenario = storage.get(MOCK_STORAGE_KEYS.listScenario);
  const failure =
    scenario?.startsWith("remove_") && request.method === "DELETE"
      ? REMOVE_FAILURES[scenario.slice("remove_".length)]
      : scenario
        ? FAILURES[scenario]
        : undefined;

  if (failure) return failure(storage);

  const url = new URL(request.path, "http://localhost");
  const parts = url.pathname.split("/");
  const lists = readMockLists(storage);

  if (parts[3] === "movies") {
    if (!isMovieId(parts[4])) return notFound();

    const movieId = Number(parts[4]);
    const state: UserMovieState = {
      want_to_watch: lists.want_to_watch.includes(movieId),
      watched: lists.watched.includes(movieId),
    };

    return mockResponse(200, state);
  }

  const listType = parts[4];

  if (!isListType(listType)) return invalid("list_type");

  if (request.method === "GET") {
    const sort = url.searchParams.get("sort") ?? "newest";
    const page = url.searchParams.get("page") ?? "1";

    if (!["newest", "oldest", "title_asc", "title_desc", "best", "worst"].includes(sort)) return invalid("sort");
    if (!isMovieId(page)) return invalid("page");

    const query = (url.searchParams.get("q") ?? "").trim().toLocaleLowerCase("ru");
    const movies = lists[listType]
      .map((movieId) => toListMovie(movieId, scenario === "demo"))
      .filter((movie): movie is UserListMovie => movie !== null && movie.title.toLocaleLowerCase("ru").includes(query));

    if (sort !== "oldest") movies.reverse();
    if (sort === "title_asc" || sort === "title_desc") {
      const direction = sort === "title_asc" ? 1 : -1;

      movies.sort((a, b) => direction * a.title.localeCompare(b.title, "ru"));
    }
    if (sort === "best" || sort === "worst") {
      const direction = sort === "best" ? -1 : 1;

      movies.sort((a, b) => {
        const left = a.average_rating;
        const right = b.average_rating;
        if (left === right) return 0;
        if (left === null) return 1;
        if (right === null) return -1;

        return direction * (left - right);
      });
    }

    return mockResponse(200, {
      movies: movies.slice((Number(page) - 1) * 24, Number(page) * 24),
      total: movies.length,
    });
  }

  if (!isMovieId(parts[5])) return notFound();

  const movieId = Number(parts[5]);

  if (request.method === "PUT") {
    if (!findMockMovie(movieId)) return notFound();
    if (!lists[listType].includes(movieId)) lists[listType].push(movieId);
  } else {
    lists[listType] = lists[listType].filter((id) => id !== movieId);
  }

  storage.set(storageKey(storage), JSON.stringify(lists));

  return mockResponse(204);
};
