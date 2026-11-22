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

    transport.current().resolve(jsonResponse(200, page([])));
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
});
