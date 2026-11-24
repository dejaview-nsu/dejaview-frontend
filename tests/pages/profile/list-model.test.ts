import { invoke } from "@withease/factories";
import { allSettled, fork } from "effector";
import { describe, expect, it, vi } from "vitest";

import type { ListQuery } from "@/pages/profile/api/request";
import { createProfileListFactory } from "@/pages/profile/model/list";

import { transportFx, type UserListMovie } from "@/shared/api";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";

const query = (list: ListQuery["list"]): ListQuery => ({ list, sort: "newest", q: "", page: 1 });

const movie = (movieId: number): UserListMovie => ({
  movie_id: movieId,
  title: `Фильм ${movieId}`,
  poster_url: null,
  average_rating: null,
  user_rating: null,
});

const page = (ids: number[], total = ids.length) => ({ movies: ids.map(movie), total });

const serverError = { code: "INTERNAL_ERROR", message: "Произошла ошибка. Попробуйте позже", field: null };

const setup = () => {
  const $$model = invoke(createProfileListFactory);
  const transport = createControlledTransport({ ignoreAbort: true });
  const scope = fork({ handlers: [[transportFx, transport.transport]] });

  return { $$model, scope, transport };
};

const open = async (
  { $$model, scope, transport }: ReturnType<typeof setup>,
  list: ListQuery["list"],
  body: unknown,
) => {
  const count = transport.calls.length;
  const opening = allSettled($$model.inputs.opened, { scope, params: query(list) });
  await transport.waitForCalls(count + 1);
  transport.current().resolve(jsonResponse(200, body));
  await opening;
};

const ids = (context: ReturnType<typeof setup>) =>
  context.scope.getState(context.$$model.outputs.$movies).map(({ movie_id }) => movie_id);

describe("profile list model", () => {
  it("requests the first page sorted by the most recently added", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;

    const opening = allSettled($$model.inputs.opened, { scope, params: query("want_to_watch") });
    await transport.waitForCalls(1);

    expect(transport.current().request).toMatchObject({
      method: "GET",
      path: "/users/me/lists/want_to_watch?sort=newest&page=1",
    });
    expect(scope.getState($$model.outputs.$status)).toBe("loading");

    transport.current().resolve(jsonResponse(200, page([603, 423], 2)));
    await opening;

    expect(scope.getState($$model.outputs.$status)).toBe("ready");
    expect(ids(context)).toEqual([603, 423]);
    expect(scope.getState($$model.outputs.$total)).toBe(2);
  });

  it("passes search, sort and page to the request", async () => {
    const { $$model, scope, transport } = setup();

    const opening = allSettled($$model.inputs.opened, {
      scope,
      params: { list: "watched", sort: "title_asc", q: "матр", page: 2 },
    });
    await transport.waitForCalls(1);

    expect(transport.current().request.path).toBe(
      `/users/me/lists/watched?sort=title_asc&page=2&q=${encodeURIComponent("матр")}`,
    );

    transport.current().resolve(jsonResponse(200, page([603], 25)));
    await opening;
  });

  it("does not reload the same query", async () => {
    const context = setup();
    await open(context, "watched", page([603]));

    await allSettled(context.$$model.inputs.opened, { scope: context.scope, params: query("watched") });

    expect(context.transport.calls).toHaveLength(1);
  });

  it("switches lists, aborts the previous request and ignores its late response", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;

    const first = allSettled($$model.inputs.opened, { scope, params: query("want_to_watch") });
    await transport.waitForCalls(1);
    const second = allSettled($$model.inputs.opened, { scope, params: query("watched") });
    await transport.waitForCalls(2);

    expect(transport.calls[0].request.signal?.aborted).toBe(true);

    transport.calls[1].resolve(jsonResponse(200, page([423])));
    transport.calls[0].resolve(jsonResponse(200, page([603, 27205])));
    await Promise.all([first, second]);

    expect(scope.getState($$model.outputs.$query)?.list).toBe("watched");
    expect(ids(context)).toEqual([423]);
  });

  it("shows a failure and repeats the same request on retry", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;

    const opening = allSettled($$model.inputs.opened, { scope, params: query("watched") });
    await transport.waitForCalls(1);
    transport.current().resolve(jsonResponse(500, serverError));
    await opening;

    expect(scope.getState($$model.outputs.$status)).toBe("failed");

    const retrying = allSettled($$model.inputs.retryPressed, { scope });
    await transport.waitForCalls(2);

    expect(transport.current().request.path).toBe(transport.calls[0].request.path);

    transport.current().resolve(jsonResponse(200, page([603])));
    await retrying;

    expect(scope.getState($$model.outputs.$status)).toBe("ready");
    expect(ids(context)).toEqual([603]);
  });

  it("removes a movie of the open list without a request when the page holds the whole list", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;
    await open(context, "watched", page([603, 423]));

    await allSettled($$model.inputs.movieRemoved, { scope, params: { list: "watched", movieId: 603 } });

    expect(ids(context)).toEqual([423]);
    expect(scope.getState($$model.outputs.$total)).toBe(1);
    expect(transport.calls).toHaveLength(1);
  });

  it("ignores a removal from another list", async () => {
    const context = setup();
    await open(context, "watched", page([603, 423]));

    await allSettled(context.$$model.inputs.movieRemoved, {
      scope: context.scope,
      params: { list: "want_to_watch", movieId: 603 },
    });

    expect(ids(context)).toEqual([603, 423]);
    expect(context.scope.getState(context.$$model.outputs.$total)).toBe(2);
  });

  it("reloads the page in the background to fill the gap left by a removal", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;
    const firstPage = Array.from({ length: 24 }, (_, index) => index + 1);
    await open(context, "want_to_watch", page(firstPage, 25));

    const removing = allSettled($$model.inputs.movieRemoved, {
      scope,
      params: { list: "want_to_watch", movieId: 1 },
    });
    await transport.waitForCalls(2);

    expect(ids(context)).toHaveLength(23);
    expect(scope.getState($$model.outputs.$status)).toBe("ready");

    transport.current().resolve(jsonResponse(200, page([...firstPage.slice(1), 25], 24)));
    await removing;

    expect(ids(context)).toHaveLength(24);
    expect(ids(context).at(-1)).toBe(25);
  });

  it("drops a background reload that started before a later removal", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;
    const firstPage = Array.from({ length: 24 }, (_, index) => index + 1);
    await open(context, "want_to_watch", page(firstPage, 26));

    const first = allSettled($$model.inputs.movieRemoved, { scope, params: { list: "want_to_watch", movieId: 1 } });
    await transport.waitForCalls(2);
    const second = allSettled($$model.inputs.movieRemoved, { scope, params: { list: "want_to_watch", movieId: 2 } });
    await transport.waitForCalls(3);

    transport.calls[2].resolve(jsonResponse(200, page([...firstPage.slice(2), 25, 26], 24)));
    transport.calls[1].resolve(jsonResponse(200, page([...firstPage.slice(1), 25], 25)));
    await Promise.all([first, second]);

    expect(ids(context)).not.toContain(2);
    expect(ids(context)).toHaveLength(24);
  });

  it("restarts a pending refresh when an otherwise complete page loses a movie", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;
    await open(context, "watched", page([1, 2]));

    const first = allSettled($$model.inputs.movieRemoved, { scope, params: { list: "watched", movieId: 3 } });
    await transport.waitForCalls(2);
    const second = allSettled($$model.inputs.movieRemoved, { scope, params: { list: "watched", movieId: 2 } });
    await transport.waitForCalls(3);

    expect(transport.calls[1].request.signal?.aborted).toBe(true);
    transport.calls[2].resolve(jsonResponse(200, page([1])));
    transport.calls[1].resolve(jsonResponse(200, page([1, 2])));
    await Promise.all([first, second]);

    expect(ids(context)).toEqual([1]);
    expect(scope.getState($$model.outputs.$total)).toBe(1);
  });

  it("keeps the remaining movies on refresh failure and clears them when the query changes", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;
    const firstPage = Array.from({ length: 24 }, (_, index) => index + 1);
    await open(context, "watched", page(firstPage, 25));

    const removing = allSettled($$model.inputs.movieRemoved, { scope, params: { list: "watched", movieId: 1 } });
    await transport.waitForCalls(2);
    transport.current().resolve(jsonResponse(500, serverError));
    await removing;
    expect(scope.getState($$model.outputs.$status)).toBe("ready");
    expect(scope.getState($$model.outputs.$refreshFailed)).toBe(true);
    expect(ids(context)).toEqual(firstPage.slice(1));

    await allSettled($$model.inputs.draftChanged, { scope, params: "match" });
    const retrying = allSettled($$model.inputs.retryPressed, { scope });
    await transport.waitForCalls(3);
    expect(transport.current().request.path).toBe(transport.calls[1].request.path);
    expect(ids(context)).toEqual(firstPage.slice(1));

    const searching = allSettled($$model.inputs.searchSubmitted, { scope });
    await transport.waitForCalls(4);
    expect(transport.current().request.path).toContain("q=match");
    expect(transport.calls[2].request.signal?.aborted).toBe(true);
    expect(ids(context)).toEqual([]);
    expect(scope.getState($$model.outputs.$refreshFailed)).toBe(false);

    transport.calls[3].resolve(jsonResponse(200, page([25])));
    transport.calls[2].resolve(jsonResponse(200, page(firstPage, 25)));
    await Promise.all([retrying, searching]);
    expect(ids(context)).toEqual([25]);
  });

  it("aborts the request on close and ignores the late response", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;

    const opening = allSettled($$model.inputs.opened, { scope, params: query("watched") });
    await transport.waitForCalls(1);
    const closing = allSettled($$model.inputs.closed, { scope });
    await vi.waitFor(() => expect(transport.calls[0].request.signal?.aborted).toBe(true));

    transport.calls[0].resolve(jsonResponse(200, page([603])));
    await Promise.all([opening, closing]);

    expect(scope.getState($$model.outputs.$status)).toBe("idle");
    expect(ids(context)).toEqual([]);
    expect(scope.getState($$model.outputs.$query)).toBeNull();
  });

  it.each([
    [0, 0],
    [1, 1],
    [23, 1],
    [24, 1],
    [25, 2],
    [48, 2],
    [49, 3],
  ])("derives the number of pages for %i movies", async (total, expected) => {
    const context = setup();
    await open(
      context,
      "watched",
      page(
        Array.from({ length: Math.min(total, 24) }, (_, index) => index + 1),
        total,
      ),
    );
    expect(context.scope.getState(context.$$model.outputs.$pageCount)).toBe(expected);
  });

  it("bounds page changes and ignores older pages while a newer one is loading", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;
    await open(context, "watched", page([1], 49));

    for (const invalid of [0, 4, 1.5, Infinity]) {
      await allSettled($$model.inputs.pageSelected, { scope, params: invalid });
    }
    expect(transport.calls).toHaveLength(1);

    const second = allSettled($$model.inputs.pageSelected, { scope, params: 2 });
    await transport.waitForCalls(2);
    const third = allSettled($$model.inputs.pageSelected, { scope, params: 3 });
    await transport.waitForCalls(3);

    expect(transport.calls[1].request.signal?.aborted).toBe(true);
    transport.calls[2].resolve(jsonResponse(200, page([49], 49)));
    transport.calls[1].resolve(jsonResponse(200, page([25], 49)));
    await Promise.all([second, third]);

    expect(ids(context)).toEqual([49]);
    expect(scope.getState($$model.outputs.$query)?.page).toBe(3);
  });

  it("returns to the last available page after removing its only movie, preserving search and sorting", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;
    const pending = allSettled($$model.inputs.opened, {
      scope,
      params: { list: "watched", sort: "best", q: "title", page: 2 },
    });
    await transport.waitForCalls(1);
    transport.current().resolve(jsonResponse(200, page([25], 25)));
    await pending;

    const removing = allSettled($$model.inputs.movieRemoved, { scope, params: { list: "watched", movieId: 25 } });
    await transport.waitForCalls(2);
    transport.current().resolve(jsonResponse(200, page([], 24)));
    await transport.waitForCalls(3);
    expect(transport.current().request.path).toBe("/users/me/lists/watched?sort=best&page=1&q=title");
    transport.current().resolve(jsonResponse(200, page([1], 24)));
    await removing;

    expect(ids(context)).toEqual([1]);
    expect(scope.getState($$model.outputs.$pageCount)).toBe(1);
    expect(scope.getState($$model.outputs.$query)?.page).toBe(1);
  });

  it("recovers when the server reports fewer pages than previously loaded", async () => {
    const context = setup();
    const { $$model, scope, transport } = context;
    await open(context, "watched", page([1], 49));

    const selecting = allSettled($$model.inputs.pageSelected, { scope, params: 3 });
    await transport.waitForCalls(2);
    transport.current().resolve(jsonResponse(200, page([], 25)));
    await transport.waitForCalls(3);
    expect(transport.current().request.path).toBe("/users/me/lists/watched?sort=newest&page=2");
    transport.current().resolve(jsonResponse(200, page([25], 25)));
    await selecting;

    expect(ids(context)).toEqual([25]);
    expect(scope.getState($$model.outputs.$pageCount)).toBe(2);
    expect(scope.getState($$model.outputs.$query)?.page).toBe(2);
  });

  it.each([0, 2])(
    "checks the full list only when its count is unknown and search returns no matches (%i)",
    async (total) => {
      const { $$model, scope, transport } = setup();
      const pending = allSettled($$model.inputs.opened, {
        scope,
        params: { list: "watched", sort: "newest", q: "absent", page: 1 },
      });
      await transport.waitForCalls(1);
      transport.current().resolve(jsonResponse(200, page([])));
      await transport.waitForCalls(2);
      expect(transport.current().request.path).toBe("/users/me/lists/watched?sort=newest&page=1");
      transport.current().resolve(jsonResponse(200, page(total ? [1, 2] : [])));
      await pending;

      expect(scope.getState($$model.outputs.$fullTotal)).toBe(total);
      expect(scope.getState($$model.outputs.$movies)).toEqual([]);

      await allSettled($$model.inputs.draftChanged, { scope, params: "still absent" });
      const next = allSettled($$model.inputs.searchSubmitted, { scope });
      await transport.waitForCalls(3);
      transport.current().resolve(jsonResponse(200, page([])));
      await next;
      expect(transport.calls).toHaveLength(3);
    },
  );
});
