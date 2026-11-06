import type { Transport } from "../transport/types";
import { AUTH_ROUTES } from "./auth";
import { movieCard, movieReviews } from "./movies";
import { createSearchHandler } from "./search";
import type { MockStorage } from "./storage";
import { textSearch } from "./text-search";
import { type MockDelays, type MockHandler, mockNotFound } from "./utils";

const ROUTES: Record<string, MockHandler> = {
  ...AUTH_ROUTES,
  "POST /search/audio": createSearchHandler("audio"),
  "POST /search/image": createSearchHandler("image"),
  "POST /search/video": createSearchHandler("video"),
  "POST /search/text": textSearch,
};

export const createMockTransport =
  ({ storage, delays }: { storage: MockStorage; delays: MockDelays }): Transport =>
  async (request) => {
    const route = `${request.method} ${request.path}`;
    let handler = ROUTES[route];

    if (request.method === "GET" && /^\/movies\/[^/?]+$/.test(request.path)) handler = movieCard;
    if (request.method === "GET" && /^\/movies\/[^/?]+\/reviews(?:\?|$)/.test(request.path)) handler = movieReviews;

    if (!handler) {
      console.warn(`Заглушки: нет заглушки для ${route}`);

      return mockNotFound(route);
    }

    return handler({ request, storage, delays });
  };
