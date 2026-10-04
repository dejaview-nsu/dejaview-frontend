import { historyAdapter } from "@effector/router";
import { allSettled, createWatch, fork, scopeBind } from "effector";
import { createMemoryHistory } from "history";
import { describe, expect, it, vi } from "vitest";

import { $$login } from "@/pages/login/model";

import { $$session, getLoginErrorDetails } from "@/entities/session";

import {
  ApiError,
  isLoginLockedError,
  isRateLimitError,
  sessionRequired,
  type Transport,
  transportFx,
  type TransportRequest,
  type TransportResponse,
} from "@/shared/api";
import { TransportError } from "@/shared/api/transport/errors";
import { router, routes } from "@/shared/routes";

import { jsonResponse } from "../../controlled-transport";
import { sessionInfo } from "../../session-scope";

const credentials = { login: "movie_fan_42", password: "Kino#2026" };

const sessionExpired = () =>
  jsonResponse(401, { code: "SESSION_EXPIRED", message: "Сессия истекла. Войдите снова", field: null });

const route = (handlers: Record<string, Transport>): Transport => {
  return async (request: TransportRequest) => {
    const handler = handlers[`${request.method} ${request.path}`];

    if (!handler) {
      throw new Error(`Unexpected request ${request.method} ${request.path}`);
    }

    return handler(request);
  };
};

const start = async (initialEntry: string, transport: Transport) => {
  const spy = vi.fn(transport);
  const scope = fork({ handlers: [[transportFx, spy]] });
  const required = vi.fn();

  createWatch({ unit: sessionRequired, scope, fn: required });

  await allSettled(router.setHistory, {
    scope,
    params: historyAdapter(createMemoryHistory({ initialEntries: [initialEntry] })),
  });
  await allSettled($$session.inputs.sessionCheckRequested, { scope });

  return { scope, required, transport: spy };
};

describe("session requests with onUnauthorized guest", () => {
  it("401 on GET /auth/session makes a guest without opening login", async () => {
    const { scope, required, transport } = await start(
      "/about",
      route({ "GET /auth/session": async () => sessionExpired() }),
    );

    expect(transport).toHaveBeenCalledWith(expect.objectContaining({ method: "GET", path: "/auth/session" }));
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(required).not.toHaveBeenCalled();
    expect(scope.getState(router.$path)).toBe("/about");
  });

  it("401 on POST /auth/logout makes a guest and goes home, not to login", async () => {
    const { scope, required } = await start(
      "/about",
      route({
        "GET /auth/session": async () => jsonResponse(200, sessionInfo),
        "POST /auth/logout": async () => sessionExpired(),
      }),
    );

    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");

    await allSettled($$session.inputs.signedOut, { scope });

    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState($$session.outputs.$user)).toBeNull();
    expect(required).not.toHaveBeenCalled();
    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState(router.$query)).toEqual({});
  });
});

describe("login errors", () => {
  it.each([
    [
      "network",
      async () => {
        throw new TransportError("network");
      },
      "NETWORK_ERROR",
    ],
    [
      "timeout",
      async () => {
        throw new TransportError("timeout");
      },
      "TIMEOUT",
    ],
    [
      "500",
      async () => jsonResponse(500, { code: "INTERNAL_ERROR", message: "Произошла ошибка. Попробуйте позже" }),
      "INTERNAL_ERROR",
    ],
    [
      "429",
      async () =>
        jsonResponse(
          429,
          { code: "RATE_LIMITED", message: "Слишком много запросов. Попробуйте позже" },
          { "Retry-After": "60" },
        ),
      "RATE_LIMITED",
    ],
  ] as const)("%s keeps the user a guest on /login with $loginError", async (_name, loginHandler, code) => {
    const { scope, required } = await start(
      "/login?redirect=/profile",
      route({
        "GET /auth/session": async () => sessionExpired(),
        "POST /auth/login": loginHandler,
      }),
    );

    await allSettled($$login.inputs.stubLoginPressed, { scope });

    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState(router.$path)).toBe("/login");
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile" });
    expect(scope.getState($$session.outputs.$loginError)).toBeInstanceOf(ApiError);
    expect(scope.getState($$session.outputs.$loginError)).toMatchObject({ code });
    expect(required).not.toHaveBeenCalled();
  });

  it("sends test credentials from the contract example", async () => {
    const { scope, transport } = await start(
      "/login",
      route({
        "GET /auth/session": async () => sessionExpired(),
        "POST /auth/login": async () => jsonResponse(200, sessionInfo),
      }),
    );

    await allSettled($$login.inputs.stubLoginPressed, { scope });

    expect(transport).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        path: "/auth/login",
        body: { login: "movie_fan_42", password: "Kino#2026" },
      }),
    );
  });

  it("new attempt resets $loginError", async () => {
    let isServerUp = false;
    const { scope } = await start(
      "/login",
      route({
        "GET /auth/session": async () => (isServerUp ? jsonResponse(200, sessionInfo) : sessionExpired()),
        "POST /auth/login": async () =>
          isServerUp
            ? jsonResponse(200, sessionInfo)
            : jsonResponse(500, { code: "INTERNAL_ERROR", message: "Произошла ошибка. Попробуйте позже" }),
      }),
    );

    await allSettled($$login.inputs.stubLoginPressed, { scope });
    expect(scope.getState($$session.outputs.$loginError)).toMatchObject({ code: "INTERNAL_ERROR" });

    isServerUp = true;
    await allSettled($$login.inputs.stubLoginPressed, { scope });

    expect(scope.getState($$session.outputs.$loginError)).toBeNull();
    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
    expect(scope.getState(router.$path)).toBe("/");
  });

  it.each([
    [
      "400 AUTH_INVALID_CREDENTIALS",
      jsonResponse(400, {
        code: "AUTH_INVALID_CREDENTIALS",
        message: "Неверные email или пароль",
        field: null,
        captcha_required: true,
      }),
      { status: 400, code: "AUTH_INVALID_CREDENTIALS", message: "Неверные email или пароль", retryAfter: null },
      true,
    ],
    [
      "403 AUTH_CAPTCHA_REQUIRED",
      jsonResponse(403, {
        code: "AUTH_CAPTCHA_REQUIRED",
        message: "Подтвердите, что вы не робот",
        field: "captcha_token",
        captcha_required: true,
      }),
      { status: 403, code: "AUTH_CAPTCHA_REQUIRED", field: "captcha_token" },
      true,
    ],
    [
      "403 AUTH_EMAIL_NOT_CONFIRMED",
      jsonResponse(403, {
        code: "AUTH_EMAIL_NOT_CONFIRMED",
        message: "Email не подтверждён. Проверьте почту или запросите новую ссылку",
        field: null,
        captcha_required: false,
      }),
      { status: 403, code: "AUTH_EMAIL_NOT_CONFIRMED" },
      false,
    ],
    [
      "429 AUTH_LOGIN_LOCKED",
      jsonResponse(
        429,
        {
          code: "AUTH_LOGIN_LOCKED",
          message: "Слишком много попыток входа. Повторите через 14 минут",
          field: null,
        },
        { "Retry-After": "840" },
      ),
      { status: 429, code: "AUTH_LOGIN_LOCKED", retryAfter: 840 },
      null,
    ],
  ] as const)("contract error %s is in $loginError", async (_name, loginResponse, expected, captchaRequired) => {
    const { scope, required } = await start(
      "/login",
      route({
        "GET /auth/session": async () => sessionExpired(),
        "POST /auth/login": async () => loginResponse,
      }),
    );

    await allSettled($$login.inputs.stubLoginPressed, { scope });

    const error = scope.getState($$session.outputs.$loginError);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject(expected);
    expect(error && getLoginErrorDetails(error)?.captcha_required).toBe(captchaRequired ?? undefined);
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState(router.$path)).toBe("/login");
    expect(required).not.toHaveBeenCalled();
  });

  it("AUTH_LOGIN_LOCKED is not a general rate limit", async () => {
    const { scope } = await start(
      "/login",
      route({
        "GET /auth/session": async () => sessionExpired(),
        "POST /auth/login": async () =>
          jsonResponse(
            429,
            { code: "AUTH_LOGIN_LOCKED", message: "Слишком много попыток входа. Повторите через 14 минут" },
            { "Retry-After": "840" },
          ),
      }),
    );

    await allSettled($$login.inputs.stubLoginPressed, { scope });

    const error = scope.getState($$session.outputs.$loginError);

    expect(isLoginLockedError(error)).toBe(true);
    expect(isRateLimitError(error)).toBe(false);
  });

  it("second signedIn while signing in is ignored", async () => {
    let isSignedIn = false;
    let finishLogin: (response: TransportResponse) => void = () => {};
    const { scope, transport } = await start(
      "/login",
      route({
        "GET /auth/session": async () => (isSignedIn ? jsonResponse(200, sessionInfo) : sessionExpired()),
        "POST /auth/login": () =>
          new Promise<TransportResponse>((resolve) => {
            finishLogin = (response) => {
              isSignedIn = true;
              resolve(response);
            };
          }),
      }),
    );
    const signIn = scopeBind($$session.inputs.signedIn, { scope });
    const loginCalls = () => transport.mock.calls.filter(([request]) => request.path === "/auth/login");

    expect(scope.getState($$session.outputs.$isSigningIn)).toBe(false);

    signIn(credentials);
    await vi.waitFor(() => expect(loginCalls()).toHaveLength(1));

    expect(scope.getState($$session.outputs.$isSigningIn)).toBe(true);

    signIn(credentials);
    signIn(credentials);

    finishLogin(jsonResponse(200, sessionInfo));
    await allSettled(scope);

    expect(loginCalls()).toHaveLength(1);
    expect(scope.getState($$session.outputs.$isSigningIn)).toBe(false);
    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
  });

  it.each([
    [
      "network",
      async () => {
        throw new TransportError("network");
      },
      "NETWORK_ERROR",
    ],
    [
      "500",
      async () => jsonResponse(500, { code: "INTERNAL_ERROR", message: "Произошла ошибка. Попробуйте позже" }),
      "INTERNAL_ERROR",
    ],
    ["401", async () => sessionExpired(), "SESSION_EXPIRED"],
  ] as const)("%s on session check after successful login is in $loginError", async (_name, check, code) => {
    let isLoginDone = false;
    const { scope, required } = await start(
      "/login?redirect=/profile",
      route({
        "GET /auth/session": async () => (isLoginDone ? check() : sessionExpired()),
        "POST /auth/login": async () => {
          isLoginDone = true;

          return jsonResponse(200, sessionInfo);
        },
      }),
    );

    expect(scope.getState($$session.outputs.$loginError)).toBeNull();

    await allSettled($$login.inputs.stubLoginPressed, { scope });

    expect(scope.getState($$session.outputs.$loginError)).toMatchObject({ code });
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState(router.$path)).toBe("/login");
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile" });
    expect(required).not.toHaveBeenCalled();
  });

  it("failed session check on app start does not set $loginError", async () => {
    const { scope } = await start("/login", route({ "GET /auth/session": async () => sessionExpired() }));

    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState($$session.outputs.$loginError)).toBeNull();
  });

  it("leaving /login resets $loginError", async () => {
    const { scope } = await start(
      "/login",
      route({
        "GET /auth/session": async () => sessionExpired(),
        "POST /auth/login": async () =>
          jsonResponse(400, {
            code: "AUTH_INVALID_CREDENTIALS",
            message: "Неверные имя пользователя или пароль",
            field: null,
            captcha_required: false,
          }),
      }),
    );

    await allSettled($$login.inputs.stubLoginPressed, { scope });
    expect(scope.getState($$session.outputs.$loginError)).toMatchObject({ code: "AUTH_INVALID_CREDENTIALS" });

    await allSettled(routes.home.open, { scope, params: undefined });

    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState($$session.outputs.$loginError)).toBeNull();
  });
});
