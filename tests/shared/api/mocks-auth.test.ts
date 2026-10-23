import { afterEach, describe, expect, it, vi } from "vitest";

import { type HttpMethod, type TransportRequest } from "@/shared/api";
import {
  AUTH_SCENARIOS,
  createMockStorage,
  createMockTransport,
  MOCK_STORAGE_KEYS,
  type MockStorage,
  NO_MOCK_DELAYS,
  withScenarioEnv,
} from "@/shared/api/mocks";

const memoryStorage = () => createMockStorage(() => null);

const sessionInfo = {
  user: { username: "movie_fan_42", avatar_url: null, has_password: true },
  expires_at: "2026-09-28T12:00:00Z",
};

const call = async (storage: MockStorage, method: HttpMethod, path: string, body?: unknown) => {
  const transport = createMockTransport({ storage, delays: NO_MOCK_DELAYS });
  const request: TransportRequest = { method, path, body, timeouts: { response: 1000 } };
  const response = await transport(request);

  return {
    status: response.status,
    body: response.bodyText ? JSON.parse(response.bodyText) : undefined,
    retryAfter: response.getHeader("Retry-After"),
  };
};

const withScenario = (scenario: string) => {
  const storage = memoryStorage();

  storage.set(MOCK_STORAGE_KEYS.authScenario, scenario);

  return storage;
};

const err = (code: string, message: string, field: string | null = null) => ({ code, message, field });

const loginErr = (code: string, message: string, field: string | null, captcha: boolean) => ({
  ...err(code, message, field),
  captcha_required: captcha,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("auth scenario selection", () => {
  it("uses the environment variable when localStorage has no value", () => {
    const storage = withScenarioEnv(memoryStorage(), { auth: "register_email_taken" });

    expect(storage.get(MOCK_STORAGE_KEYS.authScenario)).toBe("register_email_taken");
  });

  it("uses localStorage when only it is set", () => {
    const base = memoryStorage();

    base.set(MOCK_STORAGE_KEYS.authScenario, "confirm_expired");

    expect(withScenarioEnv(base, {}).get(MOCK_STORAGE_KEYS.authScenario)).toBe("confirm_expired");
  });

  it("localStorage wins over the environment variable", () => {
    const base = memoryStorage();

    base.set(MOCK_STORAGE_KEYS.authScenario, "confirm_expired");

    expect(withScenarioEnv(base, { auth: "confirm_ok" }).get(MOCK_STORAGE_KEYS.authScenario)).toBe("confirm_expired");
  });

  it("falls back to the variable when localStorage throws", async () => {
    const broken = createMockStorage(() => {
      throw new Error("blocked");
    });
    const storage = withScenarioEnv(broken, { auth: "register_username_taken" });

    expect(() => storage.set(MOCK_STORAGE_KEYS.session, "authenticated")).not.toThrow();
    expect(storage.get(MOCK_STORAGE_KEYS.authScenario)).toBe("register_username_taken");
    expect((await call(storage, "POST", "/auth/register")).status).toBe(409);
  });

  it("each endpoint answers with its ok scenario when nothing is set", async () => {
    const storage = memoryStorage();

    expect(await call(storage, "POST", "/auth/register")).toMatchObject({ status: 201, body: { resend_after: 60 } });
    expect(await call(storage, "POST", "/auth/resend-confirmation", { login: "a@b.ru" })).toMatchObject({
      status: 202,
      body: { resend_after: 60 },
    });
    expect(await call(storage, "GET", "/auth/oidc/pending")).toMatchObject({
      status: 200,
      body: { kind: "registration" },
    });
    expect(await call(storage, "POST", "/auth/oidc/complete")).toMatchObject({ status: 201, body: sessionInfo });
    expect(await call(memoryStorage(), "POST", "/auth/confirm-email", { token: "abc" })).toMatchObject({
      status: 200,
      body: sessionInfo,
    });
  });

  it("session, login and logout keep the stored session by default", async () => {
    const storage = memoryStorage();

    expect((await call(storage, "GET", "/auth/session")).status).toBe(401);
    expect((await call(storage, "POST", "/auth/login", { login: "movie_fan_42", password: "x" })).status).toBe(200);
    expect((await call(storage, "GET", "/auth/session")).status).toBe(200);
    expect((await call(storage, "POST", "/auth/logout")).status).toBe(204);
    expect((await call(storage, "GET", "/auth/session")).status).toBe(401);
  });

  it("several scenarios can be combined with commas", async () => {
    const storage = withScenario("confirm_expired, resend_too_early");

    expect((await call(storage, "POST", "/auth/confirm-email", { token: "abc" })).status).toBe(410);
    expect((await call(storage, "POST", "/auth/resend-confirmation", { token: "abc" })).body).toEqual({
      resend_after: 42,
    });
    expect((await call(storage, "POST", "/auth/register")).status).toBe(201);
  });

  it("an unknown scenario of an endpoint answers 404 MOCK_NOT_FOUND without throwing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await call(withScenario("register_typo"), "POST", "/auth/register");

    expect(response).toEqual({
      status: 404,
      body: err("MOCK_NOT_FOUND", "Для запроса POST /auth/register нет заглушки"),
      retryAfter: null,
    });
    expect(warn).toHaveBeenCalledOnce();
  });

  it("an unknown endpoint still answers 404 MOCK_NOT_FOUND", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect((await call(memoryStorage(), "POST", "/auth/password-reset/request")).status).toBe(404);
  });

  it("lists every scenario", () => {
    expect(AUTH_SCENARIOS).toHaveLength(32);
  });
});

describe("auth scenarios", () => {
  it.each([
    ["register_ok", "POST", "/auth/register", 201, { resend_after: 60 }],
    [
      "register_username_taken",
      "POST",
      "/auth/register",
      409,
      err("AUTH_USERNAME_TAKEN", "Это имя пользователя уже занято", "username"),
    ],
    [
      "register_email_taken",
      "POST",
      "/auth/register",
      409,
      err("AUTH_EMAIL_TAKEN", "Пользователь с таким email уже существует", "email"),
    ],
    [
      "register_birth_year_invalid",
      "POST",
      "/auth/register",
      400,
      err("AUTH_BIRTH_YEAR_INVALID", "Введите корректный год рождения", "birth_year"),
    ],
    [
      "register_validation_error",
      "POST",
      "/auth/register",
      400,
      err("AUTH_VALIDATION_ERROR", "Введите корректный email", "email"),
    ],
    [
      "register_rate_limited",
      "POST",
      "/auth/register",
      429,
      err("RATE_LIMITED", "Слишком много запросов. Попробуйте позже"),
    ],
    [
      "register_server_error",
      "POST",
      "/auth/register",
      500,
      err("INTERNAL_ERROR", "Произошла ошибка. Попробуйте позже"),
    ],
    ["resend_ok", "POST", "/auth/resend-confirmation", 202, { resend_after: 60 }],
    ["resend_too_early", "POST", "/auth/resend-confirmation", 202, { resend_after: 42 }],
    [
      "resend_validation_error",
      "POST",
      "/auth/resend-confirmation",
      400,
      err("AUTH_VALIDATION_ERROR", "Введите корректные имя пользователя или email", "login"),
    ],
    ["confirm_ok", "POST", "/auth/confirm-email", 200, sessionInfo],
    [
      "confirm_expired",
      "POST",
      "/auth/confirm-email",
      410,
      err("AUTH_CONFIRMATION_LINK_EXPIRED", "Срок действия ссылки истёк"),
    ],
    ["session_guest", "GET", "/auth/session", 401, err("SESSION_REQUIRED", "Войдите, чтобы продолжить")],
    ["session_user", "GET", "/auth/session", 200, sessionInfo],
    ["login_ok", "POST", "/auth/login", 200, sessionInfo],
    [
      "login_invalid_email",
      "POST",
      "/auth/login",
      400,
      loginErr("AUTH_INVALID_CREDENTIALS", "Неверные email или пароль", null, false),
    ],
    [
      "login_captcha_required",
      "POST",
      "/auth/login",
      403,
      loginErr("AUTH_CAPTCHA_REQUIRED", "Подтвердите, что вы не робот", "captcha_token", true),
    ],
    [
      "login_captcha_invalid",
      "POST",
      "/auth/login",
      403,
      loginErr("AUTH_CAPTCHA_INVALID", "Проверка не пройдена. Попробуйте ещё раз", "captcha_token", true),
    ],
    [
      "login_email_not_confirmed",
      "POST",
      "/auth/login",
      403,
      loginErr(
        "AUTH_EMAIL_NOT_CONFIRMED",
        "Email не подтверждён. Проверьте почту или запросите новую ссылку",
        null,
        false,
      ),
    ],
    [
      "login_blocked",
      "POST",
      "/auth/login",
      403,
      loginErr("AUTH_ACCOUNT_BLOCKED", "Ваша учётная запись заблокирована. Обратитесь в службу поддержки", null, false),
    ],
    [
      "login_locked",
      "POST",
      "/auth/login",
      429,
      err("AUTH_LOGIN_LOCKED", "Слишком много попыток входа. Повторите через 14 минут"),
    ],
    ["login_rate_limited", "POST", "/auth/login", 429, err("RATE_LIMITED", "Слишком много запросов. Попробуйте позже")],
    ["logout_ok", "POST", "/auth/logout", 204, undefined],
    [
      "oidc_pending_registration",
      "GET",
      "/auth/oidc/pending",
      200,
      { kind: "registration", provider: "google", email: "ivan@gmail.com", suggested_username: "ivan_petrov" },
    ],
    [
      "oidc_pending_link",
      "GET",
      "/auth/oidc/pending",
      200,
      { kind: "link", provider: "vk", email: "ivan@example.com", suggested_username: null },
    ],
    [
      "oidc_pending_expired",
      "GET",
      "/auth/oidc/pending",
      410,
      err(
        "AUTH_OIDC_EXPIRED",
        "Не удалось выполнить вход через Google. Попробуйте снова или используйте другой способ",
      ),
    ],
    [
      "oidc_pending_server_error",
      "GET",
      "/auth/oidc/pending",
      500,
      err("INTERNAL_ERROR", "Произошла ошибка. Попробуйте позже"),
    ],
    ["oidc_complete_ok", "POST", "/auth/oidc/complete", 201, sessionInfo],
    [
      "oidc_complete_username_taken",
      "POST",
      "/auth/oidc/complete",
      409,
      err("AUTH_USERNAME_TAKEN", "Это имя пользователя уже занято", "username"),
    ],
    [
      "oidc_complete_email_taken",
      "POST",
      "/auth/oidc/complete",
      409,
      err("AUTH_EMAIL_TAKEN", "Пользователь с таким email уже существует"),
    ],
    [
      "oidc_complete_validation_error",
      "POST",
      "/auth/oidc/complete",
      400,
      err(
        "AUTH_VALIDATION_ERROR",
        "Имя пользователя может содержать только латинские буквы, цифры и нижнее подчёркивание",
        "username",
      ),
    ],
    [
      "oidc_complete_expired",
      "POST",
      "/auth/oidc/complete",
      410,
      err(
        "AUTH_OIDC_EXPIRED",
        "Не удалось выполнить вход через Google. Попробуйте снова или используйте другой способ",
      ),
    ],
  ] as const)("%s → %s %s answers %i", async (scenario, method, path, status, body) => {
    const response = await call(withScenario(scenario), method, path, { login: "anna@mail.ru", token: "abc" });

    expect(response.status).toBe(status);
    expect(response.body).toEqual(body);
  });

  it("login_invalid_email words the message by the login kind", async () => {
    const storage = withScenario("login_invalid_email");

    expect((await call(storage, "POST", "/auth/login", { login: "movie_fan_42", password: "x" })).body.message).toBe(
      "Неверные имя пользователя или пароль",
    );
  });

  it("login_locked sends Retry-After 781", async () => {
    expect((await call(withScenario("login_locked"), "POST", "/auth/login", { login: "a" })).retryAfter).toBe("781");
  });

  it.each(["confirm_ok", "login_ok", "oidc_complete_ok"])("%s creates the mock session", async (scenario) => {
    const storage = withScenario(scenario);
    const [method, path] =
      scenario === "confirm_ok"
        ? (["POST", "/auth/confirm-email"] as const)
        : scenario === "login_ok"
          ? (["POST", "/auth/login"] as const)
          : (["POST", "/auth/oidc/complete"] as const);

    await call(storage, method, path, { token: "abc", login: "a", password: "b" });

    expect(storage.get(MOCK_STORAGE_KEYS.session)).toBe("authenticated");
  });

  it("logout_ok ends the mock session", async () => {
    const storage = withScenario("logout_ok");

    storage.set(MOCK_STORAGE_KEYS.session, "authenticated");
    await call(storage, "POST", "/auth/logout");

    expect(storage.get(MOCK_STORAGE_KEYS.session)).toBeNull();
  });
});
