import { invoke } from "@withease/factories";
import { allSettled, fork } from "effector";
import { describe, expect, it } from "vitest";

import { createSessionFactory } from "@/entities/session/model/session";

import { ApiError, transportFx } from "@/shared/api";
import { createMockTransport, NO_MOCK_DELAYS } from "@/shared/api/mocks";
import { appStarted } from "@/shared/config/init";

import { createTestMockStorage, executeFx } from "../../session-scope";

const credentials = { login: "movie_fan_42", password: "Kino#2026" };

const setup = () => {
  const $$session = invoke(createSessionFactory);
  const transport = createMockTransport({ storage: createTestMockStorage(), delays: NO_MOCK_DELAYS });
  const scope = fork({ handlers: [[transportFx, transport]] });

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
    await allSettled($$session.inputs.signedIn, { scope, params: credentials });

    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
    expect(scope.getState($$session.outputs.$isAuthenticated)).toBe(true);
    expect(scope.getState($$session.outputs.$user)?.username).toBe("movie_fan_42");
  });

  it("signedOut returns to guest", async () => {
    const { $$session, scope } = setup();

    await allSettled($$session.inputs.signedIn, { scope, params: credentials });
    await allSettled($$session.inputs.signedOut, { scope });

    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState($$session.outputs.$user)).toBeNull();
  });

  it("session check after sign in keeps the user authenticated", async () => {
    const { $$session, scope } = setup();

    await allSettled($$session.inputs.signedIn, { scope, params: credentials });
    await allSettled($$session.inputs.sessionCheckRequested, { scope });

    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
  });

  it("API rejects with typed SESSION_REQUIRED error and model becomes guest", async () => {
    const { $$session, scope } = setup();

    await allSettled($$session.inputs.sessionCheckRequested, { scope });

    const error = scope.getState($$session.__.sessionQuery.$error);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, code: "SESSION_REQUIRED", field: null });
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
  });

  it.each([
    new ApiError({ status: 401, code: "SESSION_EXPIRED", message: "Сессия истекла. Войдите снова", field: null }),
    new ApiError({ status: 500, code: "INTERNAL_ERROR", message: "Произошла ошибка. Попробуйте позже", field: null }),
    new Error("network"),
  ])("session check failure %s resolves to guest", async (failure) => {
    const $$session = invoke(createSessionFactory);
    const scope = fork({
      handlers: [
        [
          executeFx($$session.__.sessionQuery),
          () => {
            throw failure;
          },
        ],
      ],
    });

    await allSettled($$session.inputs.sessionCheckRequested, { scope });

    expect(scope.getState($$session.outputs.$status)).toBe("guest");
  });
});
