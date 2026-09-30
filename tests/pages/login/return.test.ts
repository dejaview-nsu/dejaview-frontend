import { allSettled } from "effector";
import { describe, expect, it } from "vitest";

import { $$login } from "@/pages/login/model";
import { $$profile } from "@/pages/profile/model";

import { router } from "@/shared/routes";

import { setupSessionScope } from "../../session-scope";

const signInFrom = async (initialEntry: string) => {
  const { scope, history } = await setupSessionScope({ initialEntry });

  await allSettled($$login.inputs.stubLoginPressed, { scope });

  return { scope, history };
};

describe("return after login", () => {
  it("returns to redirect path with replace", async () => {
    const { scope, history } = await signInFrom("/login?redirect=/profile");

    expect(scope.getState(router.$path)).toBe("/profile");
    expect(scope.getState(router.$query)).toEqual({});
    expect(scope.getState($$profile.outputs.readyRoute.$isOpened)).toBe(true);
    expect(history.index).toBe(0);
  });

  it("keeps query of redirect path", async () => {
    const { scope } = await signInFrom("/login?redirect=%2Fprofile%3Ftab%3Dlists");

    expect(scope.getState(router.$path)).toBe("/profile");
    expect(scope.getState(router.$query)).toEqual({ tab: "lists" });
  });

  it("opens home without redirect", async () => {
    const { scope } = await signInFrom("/login");

    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState(router.$query)).toEqual({});
  });

  it.each(["//evil.com", "https://evil.com", "javascript:alert(1)", "/\\evil.com", "profile"])(
    "ignores unsafe redirect %s",
    async (value) => {
      const { scope } = await signInFrom(`/login?redirect=${encodeURIComponent(value)}`);

      expect(scope.getState(router.$path)).toBe("/");
      expect(scope.getState(router.$query)).toEqual({});
    },
  );
});
