import { historyAdapter } from "@effector/router";
import { allSettled, fork } from "effector";
import { createMemoryHistory } from "history";
import { describe, expect, it } from "vitest";

import { $$profile } from "@/pages/profile/model";

import { $$session } from "@/entities/session";

import { router, routes } from "@/shared/routes";

const sessionInfo = {
  user: { username: "movie_fan_42", avatar_url: null, has_password: true },
  expires_at: "2026-09-28T12:00:00Z",
};

const executeQueryFx = (query: unknown) => (query as { __: { executeFx: never } }).__.executeFx;

const setup = async (getSession: () => typeof sessionInfo) => {
  const scope = fork({
    handlers: [[executeQueryFx($$session.__.sessionQuery), getSession]],
  });

  const history = createMemoryHistory({ initialEntries: ["/"] });

  await allSettled(router.setHistory, { scope, params: historyAdapter(history) });

  return { scope, history };
};

const guest = () => {
  throw new Error("401 SESSION_REQUIRED");
};

describe("profile route guard", () => {
  it("redirects guest to login with return path and replaces history entry", async () => {
    const { scope, history } = await setup(guest);

    await allSettled(routes.profile.open, { scope, params: undefined });

    expect(scope.getState(router.$path)).toBe("/login");
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile" });
    expect(scope.getState($$profile.outputs.readyRoute.$isOpened)).toBe(false);
    expect(history.index).toBe(1);

    await allSettled(router.back, { scope });

    expect(scope.getState(router.$path)).toBe("/");
  });

  it("opens profile for authenticated user", async () => {
    const { scope } = await setup(() => sessionInfo);

    await allSettled(routes.profile.open, { scope, params: undefined });

    expect(scope.getState(router.$path)).toBe("/profile");
    expect(scope.getState($$profile.outputs.readyRoute.$isOpened)).toBe(true);
  });

  it("sends user to home after sign out on profile", async () => {
    const { scope } = await setup(() => sessionInfo);

    await allSettled(routes.profile.open, { scope, params: undefined });
    await allSettled($$session.inputs.signedOut, { scope });

    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState($$profile.outputs.readyRoute.$isOpened)).toBe(false);
  });
});
