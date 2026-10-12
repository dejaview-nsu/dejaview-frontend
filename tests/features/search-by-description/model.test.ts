import { invoke } from "@withease/factories";
import { allSettled, createEvent, createStore, fork, sample, scopeBind } from "effector";
import { describe, expect, it } from "vitest";

import { createSearchByDescriptionFactory } from "@/features/search-by-description";

import { transportFx } from "@/shared/api";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";

const movies = [
  { movie_id: 1, title: "Первый фильм", year: null, poster_url: null, overview: null },
  { movie_id: 2, title: "Второй фильм", year: null, poster_url: null, overview: null },
];

const setup = (allowed = true, ignoreAbort = false) => {
  const allowedChanged = createEvent<boolean>();
  const $allowed = createStore(allowed);

  sample({ clock: allowedChanged, target: $allowed });

  const model = invoke(createSearchByDescriptionFactory, { $allowed });
  const controlled = createControlledTransport({ ignoreAbort });
  const scope = fork({ handlers: [[transportFx, controlled.transport]] });
  return { model, scope, controlled, allowedChanged };
};

describe("search by description", () => {
  it.each([
    ["", "Введите описание"],
    ["   ", "Введите описание"],
    ["аб", "не менее 3"],
    ["😀😀", "не менее 3"],
    ["а".repeat(251), "не более 250"],
  ])("rejects invalid query %j before sending a request", async (query, message) => {
    const { model, scope, controlled } = setup();
    await allSettled(model.inputs.queryChanged, { scope, params: query });
    await allSettled(model.inputs.searchPressed, { scope });
    expect(controlled.calls).toHaveLength(0);
    expect(scope.getState(model.outputs.$error)).toContain(message);
  });

  it("trims whitespace, counts Unicode characters, prevents duplicates and keeps all results", async () => {
    const { model, scope, controlled } = setup();
    const query = `  ${"😀".repeat(250)}  `;
    await allSettled(model.inputs.queryChanged, { scope, params: query });
    scopeBind(model.inputs.searchPressed, { scope })();
    await controlled.waitForCalls(1);
    expect(controlled.current().request).toMatchObject({
      method: "POST",
      path: "/search/text",
      body: { query: query.trim() },
    });
    scopeBind(model.inputs.searchPressed, { scope })();
    expect(controlled.calls).toHaveLength(1);
    controlled.current().resolve(jsonResponse(200, { results: movies }));
    await allSettled(scope);
    expect(scope.getState(model.outputs.$results)).toEqual(movies);
    expect(scope.getState(model.outputs.$query)).toBe(query);
    expect(scope.getState(model.outputs.$submittedQuery)).toBe(query.trim());
    await allSettled(model.inputs.queryChanged, { scope, params: "Другое описание" });
    expect(scope.getState(model.outputs.$submittedQuery)).toBe(query.trim());
    expect(scope.getState(model.outputs.$results)).toBeNull();
    expect(scope.getState(model.outputs.$pending)).toBe(false);
  });

  it("does not search when the page is closed", async () => {
    const { model, scope, controlled } = setup(false);
    await allSettled(model.inputs.queryChanged, { scope, params: "Описание фильма" });
    await allSettled(model.inputs.searchPressed, { scope });
    expect(controlled.calls).toHaveLength(0);
  });

  it.each(["cancel", "leave", "edit"] as const)("%s aborts search and ignores a late response", async (action) => {
    const { model, scope, controlled, allowedChanged } = setup(true, true);
    await allSettled(model.inputs.queryChanged, { scope, params: "Описание фильма" });
    scopeBind(model.inputs.searchPressed, { scope })();
    await controlled.waitForCalls(1);
    const call = controlled.current();
    if (action === "cancel") scopeBind(model.inputs.cancelled, { scope })();
    if (action === "leave") scopeBind(allowedChanged, { scope })(false);
    if (action === "edit") scopeBind(model.inputs.queryChanged, { scope })("Другое описание");
    expect(call.request.signal?.aborted).toBe(true);
    call.resolve(jsonResponse(200, { results: movies }));
    await allSettled(scope);
    expect(scope.getState(model.outputs.$results)).toBeNull();
    expect(scope.getState(model.outputs.$error)).toBeNull();
    expect(scope.getState(model.outputs.$pending)).toBe(false);
    expect(scope.getState(model.outputs.$query)).toBe(action === "edit" ? "Другое описание" : "Описание фильма");
  });
});
