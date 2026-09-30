import { allSettled } from "effector";
import { describe, expect, it } from "vitest";

import { $$profile } from "@/pages/profile/model";

import { $$session } from "@/entities/session";

import { router, routes } from "@/shared/routes";

import { setupSessionScope } from "../../session-scope";

describe("profile route guard", () => {
  it("redirects guest to login with return path and replaces history entry", async () => {
    const { scope, history } = await setupSessionScope();

    await allSettled(routes.profile.open, { scope, params: undefined });

    expect(scope.getState(router.$path)).toBe("/login");
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile" });
    expect(scope.getState($$profile.outputs.readyRoute.$isOpened)).toBe(false);
    expect(history.index).toBe(1);

    await allSettled(router.back, { scope });

    expect(scope.getState(router.$path)).toBe("/");
  });

  it("keeps query of protected page in redirect", async () => {
    const { scope } = await setupSessionScope();

    await allSettled(routes.profile.open, { scope, params: { query: { tab: "lists" } } });

    expect(scope.getState(router.$path)).toBe("/login");
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile?tab=lists" });
  });

  it("opens profile for authenticated user", async () => {
    const { scope } = await setupSessionScope({ authenticated: true });

    await allSettled(routes.profile.open, { scope, params: undefined });

    expect(scope.getState(router.$path)).toBe("/profile");
    expect(scope.getState($$profile.outputs.readyRoute.$isOpened)).toBe(true);
  });

  it("sends user to home after sign out on profile", async () => {
    const { scope } = await setupSessionScope({ authenticated: true });

    await allSettled(routes.profile.open, { scope, params: undefined });
    await allSettled($$session.inputs.signedOut, { scope });

    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState($$profile.outputs.readyRoute.$isOpened)).toBe(false);
  });
});
