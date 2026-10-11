import { createMockStorage, MOCK_STORAGE_KEYS } from "./storage";
import { createMockTransport } from "./transport";
import { DEFAULT_MOCK_DELAYS } from "./utils";

export { SEARCH_SCENARIOS, type SearchScenario } from "./search";
export { TEXT_SEARCH_SCENARIOS } from "./text-search";
export { LOGIN_SCENARIOS, type LoginScenario } from "./session";
export { createMockStorage, MOCK_STORAGE_KEYS, type MockStorage } from "./storage";
export { createMockTransport } from "./transport";
export { DEFAULT_MOCK_DELAYS, type MockDelays, NO_MOCK_DELAYS } from "./utils";

const storage = createMockStorage(() => globalThis.localStorage);

export const mockTransport = createMockTransport({
  storage: {
    ...storage,
    get: (key) =>
      key === MOCK_STORAGE_KEYS.searchScenario && import.meta.env.VITE_MOCK_SEARCH_SCENARIO
        ? import.meta.env.VITE_MOCK_SEARCH_SCENARIO
        : storage.get(key),
  },
  delays: DEFAULT_MOCK_DELAYS,
});
