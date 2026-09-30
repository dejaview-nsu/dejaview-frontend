import { allSettled } from "effector";
import { describe, expect, it } from "vitest";

import "@/pages/profile/model";

import { $$session } from "@/entities/session";

import { router, routes } from "@/shared/routes";

import { setupSessionScope } from "../../session-scope";

describe("sign out", () => {
  it.each(["/about", "/profile", "/profile?tab=lists"])("from %s goes home as guest", async (initialEntry) => {
    const { scope } = await setupSessionScope({ initialEntry, authenticated: true });

    await allSettled($$session.inputs.signedOut, { scope });

    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState(router.$query)).toEqual({});
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState(routes.home.$isOpened)).toBe(true);
  });
});
