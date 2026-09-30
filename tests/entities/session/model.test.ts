import { invoke } from "@withease/factories";
import { allSettled, fork } from "effector";
import { describe, expect, it } from "vitest";

import { createSessionFactory } from "@/entities/session/model/session";

import { appStarted } from "@/shared/config/init";

const setup = () => {
  const $$session = invoke(createSessionFactory);
  const scope = fork();

  return { $$session, scope };
};

describe("session model", () => {
  it("status is unknown before the session check", () => {
    const { $$session, scope } = setup();

    expect(scope.getState($$session.outputs.$status)).toBe("unknown");
  });

  it("app start without session resolves to guest", async () => {
    const { $$session, scope } = setup();

    await allSettled(appStarted, { scope });

    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState($$session.outputs.$isAuthenticated)).toBe(false);
    expect(scope.getState($$session.outputs.$user)).toBeNull();
  });

  it("signedIn makes the user authenticated", async () => {
    const { $$session, scope } = setup();

    await allSettled(appStarted, { scope });
    await allSettled($$session.inputs.signedIn, { scope });

    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
    expect(scope.getState($$session.outputs.$isAuthenticated)).toBe(true);
    expect(scope.getState($$session.outputs.$user)?.username).toBe("demo_user");
  });

  it("signedOut returns to guest", async () => {
    const { $$session, scope } = setup();

    await allSettled($$session.inputs.signedIn, { scope });
    await allSettled($$session.inputs.signedOut, { scope });

    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState($$session.outputs.$user)).toBeNull();
  });

  it("session check after sign in keeps the user authenticated", async () => {
    const { $$session, scope } = setup();

    await allSettled($$session.inputs.signedIn, { scope });
    await allSettled($$session.inputs.sessionCheckRequested, { scope });

    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
  });
});
