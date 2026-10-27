import { TransportError } from "../transport/errors";
import {
  COMMON_ERRORS,
  EMPTY_RESULTS,
  NGINX_BAD_GATEWAY_HTML,
  RATE_LIMIT_RETRY_AFTER_SECONDS,
  TEXT_FOUND_RESULTS,
} from "./fixtures";
import { MOCK_STORAGE_KEYS, type MockStorage } from "./storage";
import { type MockHandler, mockResponse, wait } from "./utils";

export const TEXT_SEARCH_SCENARIOS = [
  "found",
  "many",
  "empty",
  "QUERY_EMPTY",
  "QUERY_TOO_SHORT",
  "QUERY_TOO_LONG",
  "QUERY_NOT_ALLOWED",
  "SEARCH_UNAVAILABLE",
  "SERVER_BUSY",
  "NGINX_502",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "NETWORK_ERROR",
  "TIMEOUT",
] as const;
type TextSearchScenario = (typeof TEXT_SEARCH_SCENARIOS)[number];

const EDGE_WHITESPACE = /^\p{White_Space}+|\p{White_Space}+$/gu;

const MANY_RESULTS = {
  results: Array.from({ length: 12 }, (_, index) => ({
    ...TEXT_FOUND_RESULTS.results[index % TEXT_FOUND_RESULTS.results.length],
    movie_id: 900_000 + index,
  })),
};

const QUERY_ERRORS = {
  QUERY_EMPTY: "Невозможно выполнить поиск по запросу: запрос пустой",
  QUERY_TOO_SHORT: "Невозможно выполнить поиск по запросу: запрос короче 3 символов",
  QUERY_TOO_LONG: "Невозможно выполнить поиск по запросу: запрос длиннее 250 символов",
  QUERY_NOT_ALLOWED: "Невозможно выполнить поиск по запросу: запрос содержит недопустимое содержимое",
} as const;

const resolveScenario = (storage: MockStorage): TextSearchScenario => {
  const value = storage.get(MOCK_STORAGE_KEYS.searchScenario);
  if (value === null) return "found";
  if ((TEXT_SEARCH_SCENARIOS as readonly string[]).includes(value)) return value as TextSearchScenario;
  console.warn(`Заглушки: неизвестный сценарий текстового поиска «${value}», используется «found»`);
  return "found";
};

const queryError = (code: keyof typeof QUERY_ERRORS) =>
  mockResponse(code === "QUERY_EMPTY" ? 400 : 422, { code, message: QUERY_ERRORS[code], field: "query" });

export const textSearch: MockHandler = async ({ request, storage, delays }) => {
  await wait(delays.textSearchMs, request.signal);
  const query = (request.body as { query?: unknown } | undefined)?.query;
  const length = typeof query === "string" ? [...query.replaceAll(EDGE_WHITESPACE, "")].length : 0;
  if (length === 0) return queryError("QUERY_EMPTY");
  if (length < 3) return queryError("QUERY_TOO_SHORT");
  if (length > 250) return queryError("QUERY_TOO_LONG");

  switch (resolveScenario(storage)) {
    case "found":
      return mockResponse(200, TEXT_FOUND_RESULTS);
    case "many":
      return mockResponse(200, MANY_RESULTS);
    case "empty":
      return mockResponse(200, EMPTY_RESULTS);
    case "QUERY_EMPTY":
      return queryError("QUERY_EMPTY");
    case "QUERY_TOO_SHORT":
      return queryError("QUERY_TOO_SHORT");
    case "QUERY_TOO_LONG":
      return queryError("QUERY_TOO_LONG");
    case "QUERY_NOT_ALLOWED":
      return queryError("QUERY_NOT_ALLOWED");
    case "SEARCH_UNAVAILABLE":
      return mockResponse(503, COMMON_ERRORS.SEARCH_UNAVAILABLE);
    case "SERVER_BUSY":
      return mockResponse(503, COMMON_ERRORS.SERVER_BUSY);
    case "NGINX_502":
      return mockResponse(502, NGINX_BAD_GATEWAY_HTML, { "Content-Type": "text/html" });
    case "RATE_LIMITED":
      return mockResponse(429, COMMON_ERRORS.RATE_LIMITED, { "Retry-After": String(RATE_LIMIT_RETRY_AFTER_SECONDS) });
    case "INTERNAL_ERROR":
      return mockResponse(500, COMMON_ERRORS.INTERNAL_ERROR);
    case "NETWORK_ERROR":
      throw new TransportError("network");
    case "TIMEOUT":
      throw new TransportError("timeout");
  }
};
