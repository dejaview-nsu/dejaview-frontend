import { allSettled, fork } from "effector";
import { describe, expect, it, vi } from "vitest";

import "@/pages/login/model";
import "@/pages/profile/model";

import { $$session } from "@/entities/session";

import { appStarted } from "@/shared/config/init";
import { router } from "@/shared/routes";

import { executeFx, sessionRequiredError } from "../../session-scope";

const startAt = async (url: string) => {
  window.history.replaceState(null, "", url);

  const getSession = vi.fn(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));

    throw sessionRequiredError();
  });

  const scope = fork({ handlers: [[executeFx($$session.__.sessionQuery), getSession]] });

  await allSettled(appStarted, { scope });

  return { scope, getSession };
};

describe("app start", () => {
  it("requests session once when started on /profile", async () => {
    const { scope, getSession } = await startAt("/profile");

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState(router.$path)).toBe("/login");
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile" });
  });

  it("requests session once when started on /login", async () => {
    const { scope, getSession } = await startAt("/login");

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState(router.$path)).toBe("/login");
  });
});
