import { invoke } from "@withease/factories";
import { allSettled, fork } from "effector";
import { describe, expect, it } from "vitest";

import { createMoviePageFactory } from "@/pages/movie/model/movie";

import { transportFx } from "@/shared/api";
import { MOVIE_FIXTURE, REVIEW_FIXTURES } from "@/shared/api/mocks/movies";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";

const setup = () => {
  const $$model = invoke(createMoviePageFactory);
  const transport = createControlledTransport({ ignoreAbort: true });
  const scope = fork({ handlers: [[transportFx, transport.transport]] });

  return { $$model, transport, scope };
};

const load = async ({ $$model, scope, transport }: ReturnType<typeof setup>) => {
  const loading = allSettled($$model.inputs.opened, { scope, params: "157336" });

  await transport.waitForCalls(1);
  transport.calls[0].resolve(jsonResponse(200, MOVIE_FIXTURE));
  await transport.waitForCalls(2);
  transport.calls[1].resolve(jsonResponse(200, { reviews: REVIEW_FIXTURES.slice(0, 10), has_more: true }));
  await loading;
};

describe("movie page requests", () => {
  it("loads the public card before requesting the first ten best reviews", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;

    await load(context);

    expect(transport.calls.map(({ request }) => request.path)).toEqual([
      "/movies/157336",
      "/movies/157336/reviews?sort=best&page=1",
    ]);
    expect(scope.getState($$model.outputs.$movie)).toEqual(MOVIE_FIXTURE);
    expect(scope.getState($$model.outputs.$status)).toBe("ready");
    expect(scope.getState($$model.$$reviews.outputs.$reviews)).toHaveLength(10);
  });

  it.each(["0", "-1", "abc", "1.5", "1e3", "9007199254740992"])(
    "rejects invalid id %s without a request",
    async (movieId) => {
      const { $$model, scope, transport } = setup();

      await allSettled($$model.inputs.opened, { scope, params: movieId });

      expect(scope.getState($$model.outputs.$status)).toBe("not-found");
      expect(transport.calls).toHaveLength(0);
    },
  );

  it("shows 404 without fetching reviews", async () => {
    const { $$model, scope, transport } = setup();
    const loading = allSettled($$model.inputs.opened, { scope, params: "123" });

    await transport.waitForCalls(1);
    transport
      .current()
      .resolve(jsonResponse(404, { code: "MOVIE_NOT_FOUND", message: "Фильм не найден", field: null }));
    await loading;

    expect(scope.getState($$model.outputs.$status)).toBe("not-found");
    expect(transport.calls).toHaveLength(1);
  });

  it("retries an unavailable movie and ignores repeated retry while loading", async () => {
    const { $$model, scope, transport } = setup();
    const loading = allSettled($$model.inputs.opened, { scope, params: "157336" });

    await transport.waitForCalls(1);
    transport.current().resolve(jsonResponse(503, { code: "MOVIE_UNAVAILABLE", message: "x", field: null }));
    await loading;
    expect(scope.getState($$model.outputs.$status)).toBe("failed");

    const retry = allSettled($$model.inputs.retryPressed, { scope });
    const repeated = allSettled($$model.inputs.retryPressed, { scope });
    await transport.waitForCalls(2);
    transport.current().resolve(jsonResponse(200, MOVIE_FIXTURE));
    await transport.waitForCalls(3);
    transport.current().resolve(jsonResponse(200, { reviews: [], has_more: false }));
    await Promise.all([retry, repeated]);

    expect(scope.getState($$model.outputs.$status)).toBe("ready");
  });

  it("aborts on navigation and ignores a late card from the same movie after reopening", async () => {
    const { $$model, scope, transport } = setup();
    const first = allSettled($$model.inputs.opened, { scope, params: "157336" });
    await transport.waitForCalls(1);
    const closing = allSettled($$model.inputs.closed, { scope });
    const second = allSettled($$model.inputs.opened, { scope, params: "157336" });
    await transport.waitForCalls(2);
    expect(transport.calls[0].request.signal?.aborted).toBe(true);

    transport.calls[1].resolve(jsonResponse(200, { ...MOVIE_FIXTURE, title: "Актуальный фильм" }));
    await transport.waitForCalls(3);
    transport.calls[2].resolve(jsonResponse(200, { reviews: [], has_more: false }));
    transport.calls[0].resolve(jsonResponse(200, MOVIE_FIXTURE));
    await Promise.all([first, closing, second]);

    expect(scope.getState($$model.outputs.$movie)?.title).toBe("Актуальный фильм");
    expect(transport.calls).toHaveLength(3);
  });

  it("aborts a card when the next route id is invalid and ignores its late failure", async () => {
    const { $$model, scope, transport } = setup();
    const loading = allSettled($$model.inputs.opened, { scope, params: "157336" });
    await transport.waitForCalls(1);
    const invalid = allSettled($$model.inputs.opened, { scope, params: "invalid" });
    expect(transport.current().request.signal?.aborted).toBe(true);
    transport.current().resolve(jsonResponse(503, { code: "MOVIE_UNAVAILABLE", message: "x", field: null }));
    await Promise.all([loading, invalid]);

    expect(scope.getState($$model.outputs.$status)).toBe("not-found");
    expect(scope.getState($$model.outputs.$movie)).toBeNull();
  });
});

describe("movie reviews", () => {
  it("appends pages, removes duplicates and stops at has_more=false", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;
    const $$reviews = $$model.$$reviews;
    await load(context);

    const more = allSettled($$reviews.inputs.morePressed, { scope });
    const repeated = allSettled($$reviews.inputs.morePressed, { scope });
    await transport.waitForCalls(3);
    expect(transport.current().request.path).toBe("/movies/157336/reviews?sort=best&page=2");
    transport.current().resolve(jsonResponse(200, { reviews: REVIEW_FIXTURES.slice(9, 12), has_more: false }));
    await Promise.all([more, repeated]);
    await allSettled($$reviews.inputs.morePressed, { scope });

    expect(scope.getState($$reviews.outputs.$reviews)).toHaveLength(12);
    expect(scope.getState($$reviews.outputs.$hasMore)).toBe(false);
    expect(transport.calls).toHaveLength(3);
  });

  it.each(["worst", "newest", "oldest"] as const)(
    "changes to %s from page one and drops a late response of the previous sort",
    async (sort) => {
      const context = setup();
      const { $$model, scope, transport } = context;
      const $$reviews = $$model.$$reviews;
      await load(context);

      const more = allSettled($$reviews.inputs.morePressed, { scope });
      await transport.waitForCalls(3);
      const changing = allSettled($$reviews.inputs.sortChanged, { scope, params: sort });
      await transport.waitForCalls(4);
      expect(transport.calls[2].request.signal?.aborted).toBe(true);
      expect(scope.getState($$reviews.outputs.$reviews)).toEqual([]);
      expect(transport.calls[3].request.path).toBe(`/movies/157336/reviews?sort=${sort}&page=1`);
      transport.calls[3].resolve(jsonResponse(200, { reviews: [REVIEW_FIXTURES[22]], has_more: false }));
      transport.calls[2].resolve(jsonResponse(200, { reviews: REVIEW_FIXTURES.slice(10, 20), has_more: true }));
      await Promise.all([more, changing]);

      expect(scope.getState($$reviews.outputs.$reviews).map(({ review_id }) => review_id)).toEqual([23]);
      expect(scope.getState($$reviews.outputs.$sort)).toBe(sort);
    },
  );

  it("preserves loaded reviews on failure and retries the failed page", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;
    const $$reviews = $$model.$$reviews;
    await load(context);

    const more = allSettled($$reviews.inputs.morePressed, { scope });
    await transport.waitForCalls(3);
    transport.current().resolve(jsonResponse(502, "<html>Bad gateway</html>"));
    await more;
    expect(scope.getState($$reviews.outputs.$reviews)).toHaveLength(10);
    expect(scope.getState($$reviews.outputs.$error)).toBe(true);
    expect(scope.getState($$model.outputs.$status)).toBe("ready");

    const retry = allSettled($$reviews.inputs.retryPressed, { scope });
    await transport.waitForCalls(4);
    expect(transport.current().request.path).toBe("/movies/157336/reviews?sort=best&page=2");
    transport.current().resolve(jsonResponse(200, { reviews: REVIEW_FIXTURES.slice(10, 20), has_more: true }));
    await retry;

    expect(scope.getState($$reviews.outputs.$error)).toBe(false);
    expect(scope.getState($$reviews.outputs.$reviews)).toHaveLength(20);
  });

  it("clears and aborts reviews on leave, ignores a late failure, and starts a fresh page on return", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;
    const $$reviews = $$model.$$reviews;
    await load(context);

    const more = allSettled($$reviews.inputs.morePressed, { scope });
    await transport.waitForCalls(3);
    const closing = allSettled($$model.inputs.closed, { scope });
    expect(transport.current().request.signal?.aborted).toBe(true);
    transport.current().resolve(jsonResponse(500, { code: "INTERNAL_ERROR", message: "x", field: null }));
    await Promise.all([more, closing]);

    expect(scope.getState($$reviews.outputs.$reviews)).toEqual([]);
    expect(scope.getState($$reviews.outputs.$error)).toBe(false);
    expect(scope.getState($$reviews.outputs.$pending)).toBe(false);

    const reopening = allSettled($$model.inputs.opened, { scope, params: "603" });
    await transport.waitForCalls(4);
    transport.current().resolve(jsonResponse(200, { ...MOVIE_FIXTURE, movie_id: 603 }));
    await transport.waitForCalls(5);
    expect(transport.current().request.path).toBe("/movies/603/reviews?sort=best&page=1");
    transport.current().resolve(jsonResponse(200, { reviews: [], has_more: false }));
    await reopening;
  });

  it("refreshes the list after the viewer changes without reloading the card", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;
    await load(context);

    const refreshing = allSettled($$model.$$reviews.inputs.refreshed, { scope });
    await transport.waitForCalls(3);
    expect(scope.getState($$model.$$reviews.outputs.$reviews)).toEqual([]);
    expect(scope.getState($$model.outputs.$movie)).toEqual(MOVIE_FIXTURE);
    transport.current().resolve(jsonResponse(200, { reviews: [], has_more: false }));
    await refreshing;
  });
});
