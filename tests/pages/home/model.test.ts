import { createRoute, createRouter, historyAdapter, type Route } from "@effector/router";
import { invoke } from "@withease/factories";
import { allSettled, fork, type Scope } from "effector";
import { createMemoryHistory } from "history";
import { describe, expect, it, vi } from "vitest";

import { createHomePageFactory } from "@/pages/home/model/home";

const post = { userId: 1, id: 1, title: "Заголовок", body: "Текст" };

/** Мок executeFx: farfetched-запросы мокаются на уровне внутреннего эффекта. */
const executeQueryFx = (query: unknown) => (query as { __: { executeFx: never } }).__.executeFx;

const setup = async (handler: () => typeof post) => {
  const route = createRoute({ path: "/" });
  const otherRoute = createRoute({ path: "/other" });
  const router = createRouter({ routes: [route, otherRoute] });

  const $$home = invoke(createHomePageFactory, { route });

  const scope: Scope = fork({
    handlers: [[executeQueryFx($$home.__.postQuery), handler]],
  });

  // Нейтральная стартовая запись: history с "/" совпал бы с route и открыл его
  // ещё до явного route.open в тесте (лишний запуск запроса).
  const history = historyAdapter(createMemoryHistory({ initialEntries: ["/other"] }));

  await allSettled(router.setHistory, { scope, params: history });

  return { route, otherRoute, scope, $$home };
};

// route.open принимает опциональный payload, поэтому allSettled требует явный params
const openRoute = async (route: Route, scope: Scope) => {
  await allSettled(route.open, { scope, params: undefined });
};

describe("home page model", () => {
  it("loads post and opens chained route on success", async () => {
    const { route, scope, $$home } = await setup(() => post);

    await openRoute(route, scope);

    expect(scope.getState($$home.outputs.readyRoute.$isOpened)).toBe(true);
    expect(scope.getState($$home.outputs.$post)).toEqual(post);
    expect(scope.getState($$home.outputs.$error)).toBeNull();
  });

  it("opens chained route with error state on failure", async () => {
    const { route, scope, $$home } = await setup(() => {
      throw new Error("network");
    });

    await openRoute(route, scope);

    expect(scope.getState($$home.outputs.readyRoute.$isOpened)).toBe(true);
    expect(scope.getState($$home.outputs.$error)).not.toBeNull();
  });

  it("refreshRequested restarts query", async () => {
    const handler = vi.fn(() => post);
    const { route, scope, $$home } = await setup(handler);

    await openRoute(route, scope);
    await allSettled($$home.inputs.refreshRequested, { scope });

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("leaving the route resets query data", async () => {
    const { route, otherRoute, scope, $$home } = await setup(() => post);

    await openRoute(route, scope);
    expect(scope.getState($$home.outputs.$post)).toEqual(post);

    await openRoute(otherRoute, scope);

    expect(scope.getState($$home.outputs.$post)).toBeNull();
  });
});
