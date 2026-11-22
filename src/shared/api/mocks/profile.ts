import type { UserProfile } from "../generated";
import { TransportError } from "../transport/errors";
import { COMMON_ERRORS } from "./fixtures";
import { readMockLists } from "./lists";
import { clearMockSession, getMockUsername, hasMockSession } from "./session";
import { MOCK_STORAGE_KEYS, type MockStorage } from "./storage";
import { type MockHandler, mockResponse, wait } from "./utils";

export const PROFILE_SCENARIOS = [
  "found",
  "rated",
  "error",
  "RATE_LIMITED",
  "INVALID_RESPONSE",
  "NETWORK_ERROR",
  "TIMEOUT",
  "SESSION_EXPIRED",
] as const;

type ProfileScenario = (typeof PROFILE_SCENARIOS)[number];

const resolveScenario = (storage: MockStorage): ProfileScenario => {
  const value = storage.get(MOCK_STORAGE_KEYS.profileScenario);

  if (value === null) return "found";
  if ((PROFILE_SCENARIOS as readonly string[]).includes(value)) return value as ProfileScenario;

  console.warn(`Заглушки: неизвестный сценарий профиля «${value}», используется «found»`);

  return "found";
};

export const userProfile: MockHandler = async ({ request, storage, delays }) => {
  await wait(delays.jsonMs, request.signal);

  if (!hasMockSession(storage)) return mockResponse(401, COMMON_ERRORS.SESSION_REQUIRED);

  const scenario = resolveScenario(storage);

  if (scenario === "SESSION_EXPIRED") {
    clearMockSession(storage);

    return mockResponse(401, COMMON_ERRORS.SESSION_EXPIRED);
  }
  if (scenario === "error") return mockResponse(500, COMMON_ERRORS.INTERNAL_ERROR);
  if (scenario === "RATE_LIMITED") return mockResponse(429, COMMON_ERRORS.RATE_LIMITED);
  if (scenario === "INVALID_RESPONSE") return mockResponse(200, { username: getMockUsername(storage) });
  if (scenario === "NETWORK_ERROR" || scenario === "TIMEOUT")
    throw new TransportError(scenario === "TIMEOUT" ? "timeout" : "network");

  const rated = scenario === "rated";
  const profile: UserProfile = {
    username: getMockUsername(storage),
    birth_year: 2001,
    registered_at: "2026-09-14T09:00:00Z",
    stats: {
      watched_count: readMockLists(storage).watched.length,
      ratings_count: rated ? 38 : 0,
      average_rating: rated ? 7.8 : 0,
      reviews_count: rated ? 12 : 0,
    },
  };

  return mockResponse(200, profile, { "Cache-Control": "no-store" });
};
