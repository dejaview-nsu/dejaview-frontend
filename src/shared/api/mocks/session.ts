import {
  COMMON_ERRORS,
  createSessionInfo,
  LOGIN_ERRORS,
  LOGIN_LOCKED_RETRY_AFTER_SECONDS,
  SESSION_USER,
} from "./fixtures";
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

export const getMockUsername = (storage: MockStorage) =>
  storage.get(MOCK_STORAGE_KEYS.sessionUser) ?? SESSION_USER.username;

export const startMockSession = (storage: MockStorage, username: string = SESSION_USER.username) => {
  storage.set(MOCK_STORAGE_KEYS.sessionUser, username);
  storage.set(MOCK_STORAGE_KEYS.session, AUTHENTICATED);
};

export const clearMockSession = (storage: MockStorage) => {
  storage.remove(MOCK_STORAGE_KEYS.session);
  storage.remove(MOCK_STORAGE_KEYS.sessionUser);
};

export const hasMockPassword = (storage: MockStorage) => storage.get(MOCK_STORAGE_KEYS.sessionPasswordless) !== "true";

const sessionInfo = (storage: MockStorage) => {
  const session = createSessionInfo();

  return {
    ...session,
    user: {
      ...session.user,
      username: getMockUsername(storage),
      avatar_url: storage.get(MOCK_STORAGE_KEYS.sessionAvatar),
      has_password: hasMockPassword(storage),
    },
  };
};

export const getSession: MockHandler = async ({ request, storage, delays }) => {
  await wait(delays.jsonMs, request.signal);

  return hasMockSession(storage)
    ? mockResponse(200, sessionInfo(storage))
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

  const body = request.body as { login?: unknown } | undefined;
  const username = typeof body?.login === "string" ? body.login.trim() : SESSION_USER.username;

  startMockSession(storage, username || SESSION_USER.username);

  return mockResponse(200, sessionInfo(storage));
};

export const changePassword: MockHandler = async ({ request, storage, delays }) => {
  await wait(delays.jsonMs, request.signal);

  if (!hasMockSession(storage)) return mockResponse(401, COMMON_ERRORS.SESSION_REQUIRED);

  const body = request.body as { current_password?: unknown } | undefined;

  if (hasMockPassword(storage) && (typeof body?.current_password !== "string" || body.current_password === ""))
    return mockResponse(400, {
      code: "AUTH_VALIDATION_ERROR",
      message: "Введите текущий пароль",
      field: "current_password",
    });

  storage.remove(MOCK_STORAGE_KEYS.sessionPasswordless);

  return mockResponse(204);
};

export const logout: MockHandler = async ({ request, storage, delays }) => {
  await wait(delays.jsonMs, request.signal);

  if (!hasMockSession(storage)) {
    return mockResponse(401, COMMON_ERRORS.SESSION_REQUIRED);
  }

  clearMockSession(storage);

  return mockResponse(204);
};
