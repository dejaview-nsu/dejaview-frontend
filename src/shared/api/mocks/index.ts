import { createMockStorage } from "./storage";
import { createMockTransport } from "./transport";
import { DEFAULT_MOCK_DELAYS } from "./utils";

export { SEARCH_SCENARIOS, type SearchScenario } from "./search";
export { LOGIN_SCENARIOS, type LoginScenario } from "./session";
export { createMockStorage, MOCK_STORAGE_KEYS, type MockStorage } from "./storage";
export { createMockTransport } from "./transport";
export { DEFAULT_MOCK_DELAYS, type MockDelays, NO_MOCK_DELAYS } from "./utils";

export const mockTransport = createMockTransport({
  storage: createMockStorage(() => globalThis.localStorage),
  delays: DEFAULT_MOCK_DELAYS,
});
