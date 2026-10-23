import { createMockStorage, withScenarioEnv } from "./storage";
import { createMockTransport } from "./transport";
import { DEFAULT_MOCK_DELAYS } from "./utils";

export { AUTH_SCENARIOS, type AuthScenario } from "./auth";
export { SEARCH_SCENARIOS, type SearchScenario } from "./search";
export { TEXT_SEARCH_SCENARIOS } from "./text-search";
export { LOGIN_SCENARIOS, type LoginScenario } from "./session";
export { createMockStorage, MOCK_STORAGE_KEYS, type MockStorage, withScenarioEnv } from "./storage";
export { createMockTransport } from "./transport";
export { DEFAULT_MOCK_DELAYS, type MockDelays, NO_MOCK_DELAYS } from "./utils";

export const mockTransport = createMockTransport({
  storage: withScenarioEnv(
    createMockStorage(() => globalThis.localStorage),
    { search: import.meta.env.VITE_MOCK_SEARCH_SCENARIO, auth: import.meta.env.VITE_MOCK_AUTH_SCENARIO },
  ),
  delays: DEFAULT_MOCK_DELAYS,
});
