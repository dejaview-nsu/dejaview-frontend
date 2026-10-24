import type {
  AuthConfirmationSent,
  AuthLoginError,
  AuthOidcPending,
  Error as ErrorBody,
  SessionInfo,
} from "../generated";
import { COMMON_ERRORS } from "./fixtures";
import { getSession, login, logout } from "./session";
import { MOCK_STORAGE_KEYS, type MockStorage } from "./storage";
import { type MockContext, type MockHandler, mockNotFound, mockResponse, wait } from "./utils";

const AUTHENTICATED = "authenticated";

export const MOCK_SESSION_INFO = {
  user: { username: "movie_fan_42", avatar_url: null, has_password: true },
  expires_at: "2026-09-28T12:00:00Z",
} as const satisfies SessionInfo;

export const LOGIN_LOCKED_RETRY_AFTER = 781;

const OIDC_FAILED = "Не удалось выполнить вход через Google. Попробуйте снова или используйте другой способ";

const error = (code: string, message: string, field: string | null = null): ErrorBody => ({ code, message, field });

const loginError = (code: string, message: string, field: string | null, captchaRequired: boolean): AuthLoginError => ({
  code,
  message,
  field,
  captcha_required: captchaRequired,
});

type MockReply = {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
  signIn?: boolean;
  signOut?: boolean;
};

type ScenarioReplies = Record<string, (context: MockContext) => MockReply>;

const sent = (resendAfter: number): AuthConfirmationSent => ({ resend_after: resendAfter });

const requestLogin = ({ request }: MockContext) => {
  const body = request.body as { login?: unknown } | undefined;

  return typeof body?.login === "string" ? body.login : "";
};

const ENDPOINTS = {
  register: {
    route: "POST /auth/register",
    fallback: "register_ok",
    replies: {
      register_ok: () => ({ status: 201, body: sent(60) }),
      register_username_taken: () => ({
        status: 409,
        body: error("AUTH_USERNAME_TAKEN", "Это имя пользователя уже занято", "username"),
      }),
      register_email_taken: () => ({
        status: 409,
        body: error("AUTH_EMAIL_TAKEN", "Пользователь с таким email уже существует", "email"),
      }),
      register_birth_year_invalid: () => ({
        status: 400,
        body: error("AUTH_BIRTH_YEAR_INVALID", "Введите корректный год рождения", "birth_year"),
      }),
      register_validation_error: () => ({
        status: 400,
        body: error("AUTH_VALIDATION_ERROR", "Введите корректный email", "email"),
      }),
      register_rate_limited: () => ({ status: 429, body: COMMON_ERRORS.RATE_LIMITED }),
      register_server_error: () => ({ status: 500, body: COMMON_ERRORS.INTERNAL_ERROR }),
    },
  },
  resend: {
    route: "POST /auth/resend-confirmation",
    fallback: "resend_ok",
    replies: {
      resend_ok: () => ({ status: 202, body: sent(60) }),
      resend_too_early: () => ({ status: 202, body: sent(42) }),
      resend_validation_error: () => ({
        status: 400,
        body: error("AUTH_VALIDATION_ERROR", "Введите корректные имя пользователя или email", "login"),
      }),
    },
  },
  confirm: {
    route: "POST /auth/confirm-email",
    fallback: "confirm_ok",
    replies: {
      confirm_ok: () => ({ status: 200, body: MOCK_SESSION_INFO, signIn: true }),
      confirm_expired: () => ({
        status: 410,
        body: error("AUTH_CONFIRMATION_LINK_EXPIRED", "Срок действия ссылки истёк"),
      }),
    },
  },
  session: {
    route: "GET /auth/session",
    fallback: null,
    replies: {
      session_guest: () => ({ status: 401, body: COMMON_ERRORS.SESSION_REQUIRED }),
      session_user: () => ({ status: 200, body: MOCK_SESSION_INFO }),
    },
  },
  login: {
    route: "POST /auth/login",
    fallback: null,
    replies: {
      login_ok: () => ({ status: 200, body: MOCK_SESSION_INFO, signIn: true }),
      login_invalid_email: (context) => ({
        status: 400,
        body: loginError(
          "AUTH_INVALID_CREDENTIALS",
          requestLogin(context).includes("@") ? "Неверные email или пароль" : "Неверные имя пользователя или пароль",
          null,
          false,
        ),
      }),
      login_captcha_required: () => ({
        status: 403,
        body: loginError("AUTH_CAPTCHA_REQUIRED", "Подтвердите, что вы не робот", "captcha_token", true),
      }),
      login_captcha_invalid: () => ({
        status: 403,
        body: loginError("AUTH_CAPTCHA_INVALID", "Проверка не пройдена. Попробуйте ещё раз", "captcha_token", true),
      }),
      login_email_not_confirmed: () => ({
        status: 403,
        body: loginError(
          "AUTH_EMAIL_NOT_CONFIRMED",
          "Email не подтверждён. Проверьте почту или запросите новую ссылку",
          null,
          false,
        ),
      }),
      login_blocked: () => ({
        status: 403,
        body: loginError(
          "AUTH_ACCOUNT_BLOCKED",
          "Ваша учётная запись заблокирована. Обратитесь в службу поддержки",
          null,
          false,
        ),
      }),
      login_locked: () => ({
        status: 429,
        body: error("AUTH_LOGIN_LOCKED", "Слишком много попыток входа. Повторите через 14 минут"),
        headers: { "Retry-After": String(LOGIN_LOCKED_RETRY_AFTER) },
      }),
      login_rate_limited: () => ({ status: 429, body: COMMON_ERRORS.RATE_LIMITED }),
    },
  },
  logout: {
    route: "POST /auth/logout",
    fallback: null,
    replies: {
      logout_ok: () => ({ status: 204, signOut: true }),
    },
  },
  oidcPending: {
    route: "GET /auth/oidc/pending",
    fallback: "oidc_pending_registration",
    replies: {
      oidc_pending_registration: () => ({
        status: 200,
        body: {
          kind: "registration",
          provider: "google",
          email: "ivan@gmail.com",
          suggested_username: "ivan_petrov",
        } satisfies AuthOidcPending,
      }),
      oidc_pending_link: () => ({
        status: 200,
        body: {
          kind: "link",
          provider: "vk",
          email: "ivan@example.com",
          suggested_username: null,
        } satisfies AuthOidcPending,
      }),
      oidc_pending_expired: () => ({ status: 410, body: error("AUTH_OIDC_EXPIRED", OIDC_FAILED) }),
      oidc_pending_server_error: () => ({ status: 500, body: COMMON_ERRORS.INTERNAL_ERROR }),
    },
  },
  oidcComplete: {
    route: "POST /auth/oidc/complete",
    fallback: "oidc_complete_ok",
    replies: {
      oidc_complete_ok: () => ({ status: 201, body: MOCK_SESSION_INFO, signIn: true }),
      oidc_complete_username_taken: () => ({
        status: 409,
        body: error("AUTH_USERNAME_TAKEN", "Это имя пользователя уже занято", "username"),
      }),
      oidc_complete_email_taken: () => ({
        status: 409,
        body: error("AUTH_EMAIL_TAKEN", "Пользователь с таким email уже существует"),
      }),
      oidc_complete_validation_error: () => ({
        status: 400,
        body: error(
          "AUTH_VALIDATION_ERROR",
          "Имя пользователя может содержать только латинские буквы, цифры и нижнее подчёркивание",
          "username",
        ),
      }),
      oidc_complete_expired: () => ({ status: 410, body: error("AUTH_OIDC_EXPIRED", OIDC_FAILED) }),
    },
  },
} satisfies Record<string, { route: string; fallback: string | null; replies: ScenarioReplies }>;

type Endpoint = keyof typeof ENDPOINTS;

export type AuthScenario = {
  [Key in Endpoint]: keyof (typeof ENDPOINTS)[Key]["replies"];
}[Endpoint];

export const AUTH_SCENARIOS = Object.values(ENDPOINTS).flatMap(({ replies }) => Object.keys(replies)) as AuthScenario[];

const PREFIXES: Record<Endpoint, string> = {
  register: "register_",
  resend: "resend_",
  confirm: "confirm_",
  session: "session_",
  login: "login_",
  logout: "logout_",
  oidcPending: "oidc_pending_",
  oidcComplete: "oidc_complete_",
};

export const readAuthScenarios = (storage: MockStorage) =>
  (storage.get(MOCK_STORAGE_KEYS.authScenario) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

export const resolveAuthScenario = (
  storage: MockStorage,
  endpoint: Endpoint,
): { kind: "scenario"; name: string } | { kind: "default" } | { kind: "unknown"; name: string } => {
  const name = readAuthScenarios(storage).find((value) => value.startsWith(PREFIXES[endpoint]));

  if (name === undefined) return { kind: "default" };

  return name in ENDPOINTS[endpoint].replies ? { kind: "scenario", name } : { kind: "unknown", name };
};

const STATEFUL_DEFAULTS: Partial<Record<Endpoint, MockHandler>> = { session: getSession, login, logout };

const createAuthHandler =
  (endpoint: Endpoint): MockHandler =>
  async (context) => {
    const { route, fallback, replies } = ENDPOINTS[endpoint];
    const resolved = resolveAuthScenario(context.storage, endpoint);

    if (resolved.kind === "unknown") {
      console.warn(`Заглушки: неизвестный сценарий «${resolved.name}» для ${route}`);

      return mockNotFound(route);
    }

    const stateful = STATEFUL_DEFAULTS[endpoint];

    if (resolved.kind === "default" && stateful) return stateful(context);

    await wait(context.delays.jsonMs, context.request.signal);

    const name = resolved.kind === "scenario" ? resolved.name : (fallback as string);
    const reply = (replies as ScenarioReplies)[name](context);

    if (reply.signIn) context.storage.set(MOCK_STORAGE_KEYS.session, AUTHENTICATED);

    if (reply.signOut) context.storage.remove(MOCK_STORAGE_KEYS.session);

    return mockResponse(reply.status, reply.body, reply.headers);
  };

export const AUTH_ROUTES: Record<string, MockHandler> = Object.fromEntries(
  (Object.keys(ENDPOINTS) as Endpoint[]).map((endpoint) => [ENDPOINTS[endpoint].route, createAuthHandler(endpoint)]),
);
