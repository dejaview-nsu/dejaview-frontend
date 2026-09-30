import { allSettled, createWatch } from "effector";
import { describe, expect, it } from "vitest";

import { $$login, $$loginRoute } from "@/pages/login/model";
import { $$register } from "@/pages/register/model";

import { router, routes } from "@/shared/routes";

import { setupSessionScope } from "../../session-scope";

describe("guest-only routes", () => {
  it.each([
    ["login", routes.login],
    ["register", routes.register],
  ])("authenticated user opening /%s goes home with replace", async (_name, route) => {
    const { scope, history } = await setupSessionScope({ initialEntry: "/about", authenticated: true });

    await allSettled(route.open, { scope, params: undefined });

    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState($$loginRoute.outputs.readyRoute.$isOpened)).toBe(false);
    expect(scope.getState($$register.outputs.readyRoute.$isOpened)).toBe(false);
    expect(history.index).toBe(1);

    await allSettled(router.back, { scope });

    expect(scope.getState(router.$path)).toBe("/about");
  });

  it("waits for unknown session status before redirecting from /login", async () => {
    const { scope } = await setupSessionScope({ initialEntry: "/login", authenticated: true });

    expect(scope.getState(router.$path)).toBe("/");
  });

  it("opens /login and /register for guest", async () => {
    const { scope } = await setupSessionScope();

    await allSettled(routes.register.open, { scope, params: undefined });
    expect(scope.getState($$register.outputs.readyRoute.$isOpened)).toBe(true);

    await allSettled(routes.login.open, { scope, params: undefined });
    expect(scope.getState($$loginRoute.outputs.readyRoute.$isOpened)).toBe(true);
  });

  it("stub login on /login navigates once to redirect path", async () => {
    const { scope } = await setupSessionScope({ initialEntry: "/login?redirect=/profile" });
    const locations: string[] = [];

    const unwatch = createWatch({
      unit: router.updated,
      scope,
      fn: ({ path, query }) => {
        locations.push(`${path}${JSON.stringify(query)}`);
      },
    });

    await allSettled($$login.inputs.stubLoginPressed, { scope });
    unwatch();

    expect(locations).toEqual(["/profile{}"]);
  });
});
