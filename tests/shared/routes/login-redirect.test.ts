import { historyAdapter } from "@effector/router";
import { allSettled, fork } from "effector";
import { createMemoryHistory } from "history";
import { describe, expect, it } from "vitest";

import { $$login } from "@/pages/login/model";
import { $$profile } from "@/pages/profile/model";

import { $$session } from "@/entities/session";

import { router, routes } from "@/shared/routes";

const sessionInfo = {
  user: { username: "movie_fan_42", avatar_url: null, has_password: true },
  expires_at: "2026-09-28T12:00:00Z",
};

const executeQueryFx = (query: unknown) => (query as { __: { executeFx: never } }).__.executeFx;

const setup = async (initialEntry: string) => {
  let hasSession = false;

  const scope = fork({
    handlers: [
      [
        executeQueryFx($$session.__.sessionQuery),
        () => {
          if (!hasSession) {
            throw new Error("401 SESSION_REQUIRED");
          }

          return sessionInfo;
        },
      ],
      [
        executeQueryFx($$session.__.signInMutation),
        () => {
          hasSession = true;
        },
      ],
    ],
  });

  const history = createMemoryHistory({ initialEntries: [initialEntry] });

  await allSettled(router.setHistory, { scope, params: historyAdapter(history) });

  return { scope, history };
};

describe("login redirect query", () => {
  it("stub login leaves /login without redirect", async () => {
    const { scope, history } = await setup("/login?redirect=/profile");

    await allSettled($$login.inputs.stubLoginPressed, { scope });

    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState(router.$query)).toEqual({});
    expect(history.index).toBe(0);
  });

  it("regular navigation from /login drops redirect and keeps login entry in history", async () => {
    const { scope, history } = await setup("/login?redirect=/profile");

    await allSettled(routes.about.open, { scope, params: undefined });

    expect(scope.getState(router.$path)).toBe("/about");
    expect(scope.getState(router.$query)).toEqual({});
    expect(history.index).toBe(1);

    await allSettled(router.back, { scope });

    expect(scope.getState(router.$path)).toBe("/login");
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile" });
  });

  it("keeps other query params when leaving /login", async () => {
    const { scope } = await setup("/login?redirect=/profile&utm=mail");

    await allSettled(routes.about.open, { scope, params: undefined });

    expect(scope.getState(router.$query)).toEqual({ utm: "mail" });
  });

  it("sign out from profile after guard redirect leaves no redirect", async () => {
    const { scope } = await setup("/");

    await allSettled(routes.profile.open, { scope, params: undefined });
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile" });

    await allSettled($$login.inputs.stubLoginPressed, { scope });
    await allSettled(routes.profile.open, { scope, params: undefined });

    expect(scope.getState($$profile.outputs.readyRoute.$isOpened)).toBe(true);
    expect(scope.getState(router.$query)).toEqual({});

    await allSettled($$session.inputs.signedOut, { scope });

    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState(router.$query)).toEqual({});
  });
});
