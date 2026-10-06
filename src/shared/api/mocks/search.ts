import type { FileSearchMode } from "../search/modes";
import { TransportError } from "../transport/errors";
import type { TransportResponse } from "../transport/types";
import {
  COMMON_ERRORS,
  EMPTY_RESULTS,
  FILE_ERRORS,
  FOUND_RESULTS,
  NGINX_BAD_GATEWAY_HTML,
  RATE_LIMIT_RETRY_AFTER_SECONDS,
} from "./fixtures";
import { clearMockSession, hasMockSession } from "./session";
import { MOCK_STORAGE_KEYS, type MockStorage } from "./storage";
import { type MockContext, type MockDelays, type MockHandler, mockResponse, wait } from "./utils";

export const SEARCH_SCENARIOS = [
  "found",
  "empty",
  "FILE_REQUIRED",
  "TOO_MANY_FILES",
  "UNSUPPORTED_FORMAT",
  "FILE_TOO_LARGE",
  "VIDEO_TOO_LONG",
  "FILE_CORRUPTED",
  "SEARCH_UNAVAILABLE",
  "SERVER_BUSY",
  "NGINX_502",
  "SESSION_EXPIRED",
  "SESSION_REQUIRED",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "NETWORK_ERROR",
  "TIMEOUT",
] as const;

export type SearchScenario = (typeof SEARCH_SCENARIOS)[number];

const DEFAULT_SCENARIO: SearchScenario = "found";

const isSearchScenario = (value: string): value is SearchScenario =>
  (SEARCH_SCENARIOS as readonly string[]).includes(value);

const resolveScenario = (storage: MockStorage, mode: FileSearchMode): SearchScenario => {
  const value = storage.get(MOCK_STORAGE_KEYS.searchScenario);

  if (value === null) {
    return DEFAULT_SCENARIO;
  }

  if (!isSearchScenario(value) || (value === "VIDEO_TOO_LONG" && mode !== "video")) {
    console.warn(
      `Заглушки: неизвестный сценарий поиска «${value}» для режима ${mode}, используется «${DEFAULT_SCENARIO}»`,
    );

    return DEFAULT_SCENARIO;
  }

  return value;
};

const fileSize = (body: unknown): number => {
  const file = body instanceof FormData ? body.get("file") : null;

  return file instanceof Blob ? file.size : 0;
};

const simulateUpload = async ({ request, delays }: MockContext) => {
  const duration = Math.max(delays.minUploadMs, (fileSize(request.body) / delays.uploadBytesPerSecond) * 1000);
  const steps = delays.uploadTickMs > 0 ? Math.max(1, Math.ceil(duration / delays.uploadTickMs)) : 4;

  for (let step = 1; step <= steps; step += 1) {
    await wait(duration / steps, request.signal);
    request.onUploadProgress?.(step / steps);
  }

  request.onUploadComplete?.();
};

const respond = (scenario: SearchScenario, mode: FileSearchMode, storage: MockStorage): TransportResponse => {
  switch (scenario) {
    case "found": {
      return mockResponse(200, FOUND_RESULTS[mode]);
    }
    case "empty": {
      return mockResponse(200, EMPTY_RESULTS);
    }
    case "FILE_REQUIRED":
    case "TOO_MANY_FILES": {
      return mockResponse(400, FILE_ERRORS[mode][scenario]);
    }
    case "UNSUPPORTED_FORMAT": {
      return mockResponse(415, FILE_ERRORS[mode][scenario]);
    }
    case "FILE_TOO_LARGE": {
      return mockResponse(413, FILE_ERRORS[mode][scenario]);
    }
    case "VIDEO_TOO_LONG": {
      return mockResponse(422, FILE_ERRORS.video.VIDEO_TOO_LONG);
    }
    case "FILE_CORRUPTED": {
      return mockResponse(422, FILE_ERRORS[mode][scenario]);
    }
    case "SEARCH_UNAVAILABLE":
    case "SERVER_BUSY": {
      return mockResponse(503, COMMON_ERRORS[scenario]);
    }
    case "NGINX_502": {
      return mockResponse(502, NGINX_BAD_GATEWAY_HTML, { "Content-Type": "text/html" });
    }
    case "SESSION_EXPIRED": {
      clearMockSession(storage);

      return mockResponse(401, COMMON_ERRORS.SESSION_EXPIRED);
    }
    case "SESSION_REQUIRED": {
      return mockResponse(401, COMMON_ERRORS.SESSION_REQUIRED);
    }
    case "RATE_LIMITED": {
      return mockResponse(429, COMMON_ERRORS.RATE_LIMITED, { "Retry-After": String(RATE_LIMIT_RETRY_AFTER_SECONDS) });
    }
    case "INTERNAL_ERROR": {
      return mockResponse(500, COMMON_ERRORS.INTERNAL_ERROR);
    }
    case "NETWORK_ERROR": {
      throw new TransportError("network");
    }
    case "TIMEOUT": {
      throw new TransportError("timeout");
    }
  }
};

const processingDelay = (delays: MockDelays, mode: FileSearchMode) => delays.processingMs[mode];

export const createSearchHandler =
  (mode: FileSearchMode): MockHandler =>
  async (context) => {
    const { request, storage, delays } = context;

    if (!hasMockSession(storage)) {
      return mockResponse(401, COMMON_ERRORS.SESSION_REQUIRED);
    }

    const scenario = resolveScenario(storage, mode);

    await simulateUpload(context);
    await wait(processingDelay(delays, mode), request.signal);

    return respond(scenario, mode, storage);
  };
