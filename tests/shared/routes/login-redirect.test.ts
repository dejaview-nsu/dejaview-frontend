import { allSettled } from "effector";
import { describe, expect, it } from "vitest";

import { $$login } from "@/pages/login/model";
import { $$profile } from "@/pages/profile/model";

import { $$session } from "@/entities/session";

import { router, routes } from "@/shared/routes";

import { setupSessionScope } from "../../session-scope";

describe("login redirect query", () => {
  it("stub login leaves /login without redirect", async () => {
    const { scope, history } = await setupSessionScope({ initialEntry: "/login?redirect=/profile" });

    await allSettled($$login.inputs.stubLoginPressed, { scope });

    expect(scope.getState(router.$path)).toBe("/profile");
    expect(scope.getState(router.$query)).toEqual({});
    expect(history.index).toBe(0);
  });

  it("regular navigation from /login drops redirect and keeps login entry in history", async () => {
    const { scope, history } = await setupSessionScope({ initialEntry: "/login?redirect=/profile" });

    await allSettled(routes.about.open, { scope, params: undefined });

    expect(scope.getState(router.$path)).toBe("/about");
    expect(scope.getState(router.$query)).toEqual({});
    expect(history.index).toBe(1);

    await allSettled(router.back, { scope });

    expect(scope.getState(router.$path)).toBe("/login");
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile" });
  });

  it("keeps other query params when leaving /login", async () => {
    const { scope } = await setupSessionScope({ initialEntry: "/login?redirect=/profile&utm=mail" });

    await allSettled(routes.about.open, { scope, params: undefined });

    expect(scope.getState(router.$query)).toEqual({ utm: "mail" });
  });

  it("sign out from profile after guard redirect leaves no redirect", async () => {
    const { scope } = await setupSessionScope();

    await allSettled(routes.profile.open, { scope, params: undefined });
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile" });

    await allSettled($$login.inputs.stubLoginPressed, { scope });

    expect(scope.getState($$profile.outputs.readyRoute.$isOpened)).toBe(true);
    expect(scope.getState(router.$query)).toEqual({});

    await allSettled($$session.inputs.signedOut, { scope });

    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState(router.$query)).toEqual({});
  });
});
