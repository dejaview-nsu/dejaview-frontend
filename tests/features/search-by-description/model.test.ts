import { invoke } from "@withease/factories";
import { allSettled, createEvent, createStore, fork, sample, scopeBind } from "effector";
import { describe, expect, it } from "vitest";

import { createSearchByDescriptionFactory, queryErrorMessages } from "@/features/search-by-description";

import { transportFx } from "@/shared/api";
import { TransportError } from "@/shared/api/transport/errors";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";

const movie = (id: number) => ({ movie_id: id, title: `Фильм ${id}`, year: null, poster_url: null, overview: null });

const movies = [movie(1), movie(2)];

const setup = (allowed = true, ignoreAbort = false) => {
  const allowedChanged = createEvent<boolean>();
  const $allowed = createStore(allowed);

  sample({ clock: allowedChanged, target: $allowed });

  const model = invoke(createSearchByDescriptionFactory, { $allowed });
  const controlled = createControlledTransport({ ignoreAbort });
  const scope = fork({ handlers: [[transportFx, controlled.transport]] });

  const type = (text: string) => allSettled(model.inputs.queryChanged, { scope, params: { text } });
  const paste = (text: string) => allSettled(model.inputs.queryChanged, { scope, params: { text, pasted: true } });

  const start = async (calls = controlled.calls.length + 1) => {
    scopeBind(model.inputs.searchPressed, { scope })();
    await controlled.waitForCalls(calls);
    return controlled.current();
  };

  const searchWith = async (body: unknown, status = 200) => {
    const call = await start();
    call.resolve(jsonResponse(status, body));
    await allSettled(scope);
  };

  return { model, scope, controlled, allowedChanged, type, paste, start, searchWith };
};

describe("search by description", () => {
  it.each([
    ["", "QUERY_EMPTY"],
    ["   ", "QUERY_EMPTY"],
    [" 　\n\t", "QUERY_EMPTY"],
    ["аб", "QUERY_TOO_SHORT"],
    ["  аб  ", "QUERY_TOO_SHORT"],
    ["😀😀", "QUERY_TOO_SHORT"],
    ["а".repeat(251), "QUERY_TOO_LONG"],
  ] as const)("rejects %j on the client without a request", async (query, code) => {
    const { model, scope, controlled, paste } = setup();
    await paste(query);
    await allSettled(model.inputs.searchPressed, { scope });
    expect(controlled.calls).toHaveLength(0);
    expect(scope.getState(model.outputs.$fieldError)).toBe(code);
    expect(scope.getState(model.outputs.$query)).toBe(query);
  });

  it("uses the texts from the requirements for every query error", () => {
    expect(queryErrorMessages).toEqual({
      QUERY_EMPTY: "Опиши, что помнишь о фильме — минимум 3 символа",
      QUERY_TOO_SHORT: "Запрос слишком короткий — нужно минимум 3 символа",
      QUERY_TOO_LONG: "Запрос длиннее 250 символов — сократи описание",
      QUERY_NOT_ALLOWED: "Не получилось выполнить поиск по этому запросу. Измени формулировку и попробуй снова",
    });
  });

  it.each([
    ["абв", "абв"],
    ["  абв  ", "абв"],
    ["　абв ", "абв"],
    ["😀".repeat(250), "😀".repeat(250)],
    [` ${"я".repeat(250)}\n`, "я".repeat(250)],
  ])("sends the trimmed query %j", async (query, sent) => {
    const { model, scope, controlled, paste, start } = setup();
    await paste(query);
    const call = await start();
    expect(controlled.calls).toHaveLength(1);
    expect(call.request).toMatchObject({ method: "POST", path: "/search/text", body: { query: sent } });
    expect(scope.getState(model.outputs.$fieldError)).toBeNull();
    expect(scope.getState(model.outputs.$submittedQuery)).toBe(sent);
  });

  it("counts every character of the draft, including edge spaces, by code points", async () => {
    const { model, scope, type } = setup();
    await type("  😀 а  ");
    expect(scope.getState(model.outputs.$length)).toBe(7);
    expect(scope.getState(model.outputs.$isOverLimit)).toBe(false);
  });

  it("blocks typing past 250 characters, accepts a long paste and lets the user shorten it", async () => {
    const { model, scope, type, paste } = setup();
    await type(` ${"а".repeat(249)}`);
    await type(` ${"а".repeat(250)}`);
    expect(scope.getState(model.outputs.$length)).toBe(250);
    await paste("а".repeat(263));
    expect(scope.getState(model.outputs.$length)).toBe(263);
    expect(scope.getState(model.outputs.$isOverLimit)).toBe(true);
    await type("а".repeat(264));
    expect(scope.getState(model.outputs.$length)).toBe(263);
    await type("а".repeat(262));
    expect(scope.getState(model.outputs.$length)).toBe(262);
  });

  it("keeps a long pasted query and shows the too long error until the text changes", async () => {
    const { model, scope, controlled, paste, type } = setup();
    await paste("а".repeat(263));
    await allSettled(model.inputs.searchPressed, { scope });
    expect(controlled.calls).toHaveLength(0);
    expect(scope.getState(model.outputs.$fieldError)).toBe("QUERY_TOO_LONG");
    expect(scope.getState(model.outputs.$query)).toBe("а".repeat(263));
    await type("а".repeat(250));
    expect(scope.getState(model.outputs.$fieldError)).toBeNull();
  });

  it("keeps at most 10 results in server order and keeps the draft after success", async () => {
    const { model, scope, type, searchWith } = setup();
    const found = Array.from({ length: 12 }, (_, index) => movie(100 - index));
    await type("Солдат в окопе");
    await searchWith({ results: found });
    expect(scope.getState(model.outputs.$results)).toEqual(found.slice(0, 10));
    expect(scope.getState(model.outputs.$query)).toBe("Солдат в окопе");
    expect(scope.getState(model.outputs.$isEmpty)).toBe(false);
  });

  it("keeps results and the submitted query when the draft changes after a search", async () => {
    const { model, scope, type, searchWith } = setup();
    await type("  Солдат в окопе ");
    await searchWith({ results: movies });
    await type("Другое описание");
    expect(scope.getState(model.outputs.$submittedQuery)).toBe("Солдат в окопе");
    expect(scope.getState(model.outputs.$results)).toEqual(movies);
  });

  it("reports an empty result without an error", async () => {
    const { model, scope, type, searchWith } = setup();
    await type("Солдат в окопе");
    await searchWith({ results: [] });
    expect(scope.getState(model.outputs.$isEmpty)).toBe(true);
    expect(scope.getState(model.outputs.$error)).toBeNull();
  });

  it("hides old results on a client query error", async () => {
    const { model, scope, type, searchWith } = setup();
    await type("Солдат в окопе");
    await searchWith({ results: movies });
    await type("аб");
    await allSettled(model.inputs.searchPressed, { scope });
    expect(scope.getState(model.outputs.$results)).toBeNull();
    expect(scope.getState(model.outputs.$fieldError)).toBe("QUERY_TOO_SHORT");
  });

  it.each([
    [400, "QUERY_EMPTY", "QUERY_EMPTY"],
    [422, "QUERY_TOO_SHORT", "QUERY_TOO_SHORT"],
    [422, "QUERY_TOO_LONG", "QUERY_TOO_LONG"],
    [422, "QUERY_NOT_ALLOWED", "QUERY_NOT_ALLOWED"],
    [422, "VALIDATION_ERROR", "QUERY_NOT_ALLOWED"],
    [400, "BAD_REQUEST", "QUERY_NOT_ALLOWED"],
  ] as const)("maps server %i %s to the %s field error", async (status, code, expected) => {
    const { model, scope, type, searchWith } = setup();
    await type("Солдат в окопе");
    await searchWith({ results: movies });
    await searchWith({ code, message: "Техническое сообщение", field: "query" }, status);
    expect(scope.getState(model.outputs.$fieldError)).toBe(expected);
    expect(scope.getState(model.outputs.$isUnavailable)).toBe(false);
    expect(scope.getState(model.outputs.$results)).toBeNull();
    expect(scope.getState(model.outputs.$query)).toBe("Солдат в окопе");
    await type("Солдат в окопе.");
    expect(scope.getState(model.outputs.$fieldError)).toBeNull();
  });

  it.each([
    ["503 SEARCH_UNAVAILABLE", jsonResponse(503, { code: "SEARCH_UNAVAILABLE", message: "x", field: null })],
    ["503 SERVER_BUSY", jsonResponse(503, { code: "SERVER_BUSY", message: "x", field: null })],
    ["502 html", jsonResponse(502, "<html>Bad Gateway</html>")],
    ["504 empty", jsonResponse(504, "")],
    ["429", jsonResponse(429, { code: "RATE_LIMITED", message: "x", field: null }, { "Retry-After": "60" })],
    ["500", jsonResponse(500, { code: "INTERNAL_ERROR", message: "x", field: null })],
    ["invalid body", jsonResponse(200, { results: [{ title: 1 }] })],
  ])("shows unavailable search for %s and hides old results", async (_, response) => {
    const { model, scope, type, searchWith, start } = setup();
    await type("Солдат в окопе");
    await searchWith({ results: movies });
    const call = await start();
    call.resolve(response);
    await allSettled(scope);
    expect(scope.getState(model.outputs.$isUnavailable)).toBe(true);
    expect(scope.getState(model.outputs.$fieldError)).toBeNull();
    expect(scope.getState(model.outputs.$results)).toBeNull();
    expect(scope.getState(model.outputs.$query)).toBe("Солдат в окопе");
  });

  it.each(["network", "timeout"] as const)("shows unavailable search on a %s failure", async (kind) => {
    const { model, scope, type, start } = setup();
    await type("Солдат в окопе");
    const call = await start();
    call.reject(new TransportError(kind));
    await allSettled(scope);
    expect(scope.getState(model.outputs.$isUnavailable)).toBe(true);
    await type("Солдат в окопе!");
    expect(scope.getState(model.outputs.$isUnavailable)).toBe(true);
  });

  it("retries after unavailability and clears the notice on a new request", async () => {
    const { model, scope, type, start } = setup();
    await type("Солдат в окопе");
    (await start()).resolve(jsonResponse(503, { code: "SEARCH_UNAVAILABLE", message: "x", field: null }));
    await allSettled(scope);
    const retry = await start();
    expect(scope.getState(model.outputs.$isUnavailable)).toBe(false);
    expect(scope.getState(model.outputs.$pending)).toBe(true);
    retry.resolve(jsonResponse(200, { results: movies }));
    await allSettled(scope);
    expect(scope.getState(model.outputs.$results)).toEqual(movies);
  });

  it("ignores repeated presses while a search is running", async () => {
    const { model, scope, controlled, type, start } = setup();
    await type("Солдат в окопе");
    const call = await start();
    scopeBind(model.inputs.searchPressed, { scope })();
    expect(controlled.calls).toHaveLength(1);
    call.resolve(jsonResponse(200, { results: movies }));
    await allSettled(scope);
    expect(controlled.calls).toHaveLength(1);
  });

  it("does not search when the page is closed", async () => {
    const { model, scope, controlled, type } = setup(false);
    await type("Описание фильма");
    await allSettled(model.inputs.searchPressed, { scope });
    expect(controlled.calls).toHaveLength(0);
  });

  it("does not require a session and keeps the guest on 401", async () => {
    const { model, scope, type, start } = setup();
    await type("Описание фильма");
    const call = await start();
    expect(call.request.path).toBe("/search/text");
    call.resolve(jsonResponse(401, { code: "SESSION_REQUIRED", message: "x", field: null }));
    await allSettled(scope);
    expect(scope.getState(model.outputs.$isUnavailable)).toBe(true);
  });

  it.each(["cancel", "leave"] as const)("%s aborts search and ignores a late response", async (action) => {
    const { model, scope, allowedChanged, type, start } = setup(true, true);
    await type("Описание фильма");
    const call = await start();
    if (action === "cancel") scopeBind(model.inputs.cancelled, { scope })();
    if (action === "leave") scopeBind(allowedChanged, { scope })(false);
    expect(call.request.signal?.aborted).toBe(true);
    call.resolve(jsonResponse(200, { results: movies }));
    await allSettled(scope);
    expect(scope.getState(model.outputs.$results)).toBeNull();
    expect(scope.getState(model.outputs.$error)).toBeNull();
    expect(scope.getState(model.outputs.$pending)).toBe(false);
    expect(scope.getState(model.outputs.$query)).toBe("Описание фильма");
  });

  it("ignores a late response of an aborted search after a new one starts", async () => {
    const { model, scope, type, start } = setup();
    await type("Первое описание");
    const first = await start();
    scopeBind(model.inputs.cancelled, { scope })();
    await type("Второе описание");
    const second = await start();
    first.resolve(jsonResponse(503, { code: "SEARCH_UNAVAILABLE", message: "x", field: null }));
    second.resolve(jsonResponse(200, { results: movies }));
    await allSettled(scope);
    expect(scope.getState(model.outputs.$isUnavailable)).toBe(false);
    expect(scope.getState(model.outputs.$results)).toEqual(movies);
    expect(scope.getState(model.outputs.$submittedQuery)).toBe("Второе описание");
  });
});
