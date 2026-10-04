import { COMMON_ERRORS, createSessionInfo, LOGIN_ERRORS, LOGIN_LOCKED_RETRY_AFTER_SECONDS } from "./fixtures";
import { MOCK_STORAGE_KEYS, type MockStorage } from "./storage";
import { type MockHandler, mockResponse, wait } from "./utils";

const AUTHENTICATED = "authenticated";

export const LOGIN_SCENARIOS = [
  "INVALID_CREDENTIALS",
  "CAPTCHA_REQUIRED",
  "EMAIL_NOT_CONFIRMED",
  "LOGIN_LOCKED",
] as const;

export type LoginScenario = (typeof LOGIN_SCENARIOS)[number];

const isLoginScenario = (value: string): value is LoginScenario =>
  (LOGIN_SCENARIOS as readonly string[]).includes(value);

const resolveLoginScenario = (storage: MockStorage): LoginScenario | null => {
  const value = storage.get(MOCK_STORAGE_KEYS.loginScenario);

  if (value === null) {
    return null;
  }

  if (!isLoginScenario(value)) {
    console.warn(`Заглушки: неизвестный сценарий входа «${value}», вход выполняется успешно`);

    return null;
  }

  return value;
};

export const hasMockSession = (storage: MockStorage) => storage.get(MOCK_STORAGE_KEYS.session) === AUTHENTICATED;

export const clearMockSession = (storage: MockStorage) => storage.remove(MOCK_STORAGE_KEYS.session);

export const getSession: MockHandler = async ({ request, storage, delays }) => {
  await wait(delays.jsonMs, request.signal);

  return hasMockSession(storage)
    ? mockResponse(200, createSessionInfo())
    : mockResponse(401, COMMON_ERRORS.SESSION_REQUIRED);
};

export const login: MockHandler = async ({ request, storage, delays }) => {
  await wait(delays.jsonMs, request.signal);

  const scenario = resolveLoginScenario(storage);

  if (scenario !== null) {
    const { status, body } = LOGIN_ERRORS[scenario];
    const headers: Record<string, string> =
      scenario === "LOGIN_LOCKED" ? { "Retry-After": String(LOGIN_LOCKED_RETRY_AFTER_SECONDS) } : {};

    return mockResponse(status, body, headers);
  }

  storage.set(MOCK_STORAGE_KEYS.session, AUTHENTICATED);

  return mockResponse(200, createSessionInfo());
};

export const logout: MockHandler = async ({ request, storage, delays }) => {
  await wait(delays.jsonMs, request.signal);

  if (!hasMockSession(storage)) {
    return mockResponse(401, COMMON_ERRORS.SESSION_REQUIRED);
  }

  clearMockSession(storage);

  return mockResponse(204);
};
