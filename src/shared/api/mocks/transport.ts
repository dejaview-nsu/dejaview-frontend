import type { Transport } from "../transport/types";
import { createSearchHandler } from "./search";
import { getSession, login, logout } from "./session";
import type { MockStorage } from "./storage";
import { textSearch } from "./text-search";
import { type MockDelays, type MockHandler, mockResponse } from "./utils";

const ROUTES: Record<string, MockHandler> = {
  "GET /auth/session": getSession,
  "POST /auth/login": login,
  "POST /auth/logout": logout,
  "POST /search/image": createSearchHandler("image"),
  "POST /search/video": createSearchHandler("video"),
  "POST /search/text": textSearch,
};

export const createMockTransport =
  ({ storage, delays }: { storage: MockStorage; delays: MockDelays }): Transport =>
  async (request) => {
    const route = `${request.method} ${request.path}`;
    const handler = ROUTES[route];

    if (!handler) {
      console.warn(`Заглушки: нет заглушки для ${route}`);

      return mockResponse(404, {
        code: "MOCK_NOT_FOUND",
        message: `Для запроса ${route} нет заглушки`,
        field: null,
      });
    }

    return handler({ request, storage, delays });
  };
