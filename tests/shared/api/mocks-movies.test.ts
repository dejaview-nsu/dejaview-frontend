import { describe, expect, it } from "vitest";

import { zMovieCard, zMovieReviewsPage } from "@/shared/api";
import { createMockStorage, createMockTransport, MOCK_STORAGE_KEYS, NO_MOCK_DELAYS } from "@/shared/api/mocks";

const setup = () => {
  const storage = createMockStorage(() => null);
  const transport = createMockTransport({ storage, delays: NO_MOCK_DELAYS });
  const request = async (path: string) => {
    const response = await transport({ method: "GET", path, timeouts: { response: 1000 } });

    return { status: response.status, body: JSON.parse(response.bodyText) };
  };

  return { storage, request };
};

describe("movie mock contract", () => {
  it.each([157336, 603, 27205, 530915, 900000, 900011, 1000001])(
    "serves valid details for search movie %i",
    async (movieId) => {
      const { request } = setup();
      const { status, body } = await request(`/movies/${movieId}`);

      expect(status).toBe(200);
      expect(zMovieCard.parse(body).movie_id).toBe(movieId);
    },
  );

  it.each(["best", "worst", "newest", "oldest"])(
    "sorts by %s and returns all pages of ten without duplicates",
    async (sort) => {
      const { request } = setup();
      const pages = await Promise.all(
        [1, 2, 3].map(async (page) =>
          zMovieReviewsPage.parse((await request(`/movies/157336/reviews?sort=${sort}&page=${page}`)).body),
        ),
      );
      const reviews = pages.flatMap(({ reviews }) => reviews);

      expect(pages.map(({ reviews }) => reviews.length)).toEqual([10, 10, 3]);
      expect(pages.map(({ has_more }) => has_more)).toEqual([true, true, false]);
      expect(new Set(reviews.map(({ review_id }) => review_id)).size).toBe(23);

      for (let index = 1; index < reviews.length; index++) {
        const previous = reviews[index - 1];
        const current = reviews[index];

        if (sort === "oldest") expect(previous.created_at <= current.created_at).toBe(true);
        else if (sort === "newest") expect(previous.created_at >= current.created_at).toBe(true);
        else {
          const field = sort === "best" ? "likes" : "dislikes";

          expect(previous[field]).toBeGreaterThanOrEqual(current[field]);
          if (previous[field] === current[field]) expect(previous.created_at >= current.created_at).toBe(true);
        }
      }
    },
  );

  it.each(["MOVIE_NOT_FOUND", "MOVIE_UNAVAILABLE"])("returns %s from the contract", async (scenario) => {
    const { request, storage } = setup();
    storage.set(MOCK_STORAGE_KEYS.movieScenario, scenario);
    const { status, body } = await request("/movies/157336");

    expect(status).toBe(scenario === "MOVIE_NOT_FOUND" ? 404 : 503);
    expect(body.code).toBe(scenario);
  });

  it("supports empty reviews and a recoverable failure", async () => {
    const { request, storage } = setup();
    storage.set(MOCK_STORAGE_KEYS.reviewScenario, "error");
    expect((await request("/movies/157336/reviews?sort=best&page=2")).status).toBe(500);
    storage.set(MOCK_STORAGE_KEYS.reviewScenario, "empty");
    expect((await request("/movies/157336/reviews?sort=best&page=1")).body).toEqual({ reviews: [], has_more: false });
  });
});
