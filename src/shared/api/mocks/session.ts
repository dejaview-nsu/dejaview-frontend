import { COMMON_ERRORS, createSessionInfo } from "./fixtures";
import { MOCK_STORAGE_KEYS, type MockStorage } from "./storage";
import { type MockHandler, mockResponse, wait } from "./utils";

const AUTHENTICATED = "authenticated";

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
