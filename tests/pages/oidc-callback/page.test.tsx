import { historyAdapter } from "@effector/router";
import { RouterProvider } from "@effector/router-react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { allSettled, fork } from "effector";
import { Provider } from "effector-react";
import { createMemoryHistory } from "history";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OidcCallbackPage } from "@/pages/oidc-callback";

import { BaseLayout } from "@/layouts/base";

import { saveOidcReturnPath } from "@/features/oidc-sign-in";

import { $$session } from "@/entities/session";

import { type Transport, transportFx, type TransportRequest, type TransportResponse } from "@/shared/api";
import { router } from "@/shared/routes";

import { jsonResponse } from "../../controlled-transport";
import { sessionInfo } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const guest = () => jsonResponse(401, { code: "SESSION_REQUIRED", message: "Войдите, чтобы продолжить", field: null });

const oidcExpired = () =>
  jsonResponse(410, {
    code: "AUTH_OIDC_EXPIRED",
    message: "Не удалось выполнить вход через Google. Попробуйте снова или используйте другой способ",
    field: null,
  });

const registrationPending = {
  kind: "registration",
  provider: "google",
  email: "anna@gmail.com",
  suggested_username: "anna_k_4821",
};

const linkPending = { kind: "link", provider: "google", email: "anna@mail.ru", suggested_username: null };

const loginError = (
  status: number,
  code: string,
  message: string,
  { captcha = false, headers = {} }: { captcha?: boolean; headers?: Record<string, string> } = {},
) => jsonResponse(status, { code, message, field: null, captcha_required: captcha }, headers);

type Handlers = Partial<Record<string, (request: TransportRequest) => TransportResponse>>;

const setup = async (path: string, handlers: Handlers = {}) => {
  let signedIn = false;
  const defaults: Handlers = {
    "GET /auth/session": () => (signedIn ? jsonResponse(200, sessionInfo) : guest()),
  };
  const transport = vi.fn<Transport>(async (request) => {
    const route = `${request.method} ${request.path}`;
    const handler = handlers[route] ?? defaults[route];

    if (!handler) throw new Error(`Unexpected request ${route}`);

    const response = handler(request);

    if (response.status < 300 && (route === "POST /auth/login" || route === "POST /auth/oidc/complete")) {
      signedIn = true;
    }

    return response;
  });
  const scope = fork({ handlers: [[transportFx, transport]] });

  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <BaseLayout>
          <OidcCallbackPage />
        </BaseLayout>
      </RouterProvider>
    </Provider>,
  );

  await act(async () => {
    await allSettled(router.setHistory, {
      scope,
      params: historyAdapter(createMemoryHistory({ initialEntries: [path] })),
    });
    await allSettled($$session.inputs.sessionCheckRequested, { scope });
  });

  const requests = (route: string) =>
    transport.mock.calls.map(([request]) => request).filter((request) => `${request.method} ${request.path}` === route);
  const input = (label: string) => screen.getByLabelText(label, { selector: "input" });

  return { scope, transport, requests, input, user: userEventSetup() };
};

const failedText = "Не удалось выполнить вход через Google. Попробуйте снова или используйте другой способ";

afterEach(() => {
  sessionStorage.clear();
});

describe("OIDC result page", () => {
  describe("success", () => {
    it("refreshes the session and returns to the saved page", async () => {
      saveOidcReturnPath("/movies/603");

      const { scope } = await setup("/auth/oidc?provider=google&result=success", {
        "GET /auth/session": () => jsonResponse(200, sessionInfo),
      });

      await waitFor(() => expect(scope.getState(router.$path)).toBe("/movies/603"));
      expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
      expect(sessionStorage.getItem("dejaview:oidc-return-path")).toBeNull();
    });

    it("returns home without a saved page", async () => {
      const { scope } = await setup("/auth/oidc?provider=vk&result=success", {
        "GET /auth/session": () => jsonResponse(200, sessionInfo),
      });

      await waitFor(() => expect(scope.getState(router.$path)).toBe("/"));
      expect(screen.getByRole("button", { name: "Меню пользователя movie_fan_42" })).toBeInTheDocument();
    });

    it("ignores unsafe saved pages", async () => {
      saveOidcReturnPath("//evil.example/");

      const { scope } = await setup("/auth/oidc?provider=google&result=success", {
        "GET /auth/session": () => jsonResponse(200, sessionInfo),
      });

      await waitFor(() => expect(scope.getState(router.$path)).toBe("/"));
    });
  });

  it.each([
    ["error", "google", failedText],
    ["unknown_value", "google", failedText],
    ["error", "yandex", "Не удалось выполнить вход через Яндекс. Попробуйте снова или используйте другой способ"],
    ["error", "vk", "Не удалось выполнить вход через VK. Попробуйте снова или используйте другой способ"],
  ])("result=%s for %s returns to /register with the provider message", async (result, provider, text) => {
    const { scope, transport } = await setup(`/auth/oidc?provider=${provider}&result=${result}`);

    expect(scope.getState(router.$path)).toBe("/register");
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(transport.mock.calls.every(([request]) => request.path === "/auth/session")).toBe(true);
  });

  it("missing result behaves as an error", async () => {
    const { scope } = await setup("/auth/oidc?provider=google");

    expect(scope.getState(router.$path)).toBe("/register");
    expect(screen.getByText(failedText)).toBeInTheDocument();
  });

  it("account_blocked shows the message without login buttons", async () => {
    const { scope } = await setup("/auth/oidc?provider=google&result=account_blocked");

    expect(scope.getState(router.$path)).toBe("/auth/oidc");
    expect(
      screen.getByRole("heading", { name: "Ваша учётная запись заблокирована. Обратитесь в службу поддержки" }),
    ).toBeInTheDocument();
    expect(within(screen.getByRole("main")).queryByRole("button")).toBeNull();
    expect(within(screen.getByRole("main")).queryByRole("textbox")).toBeNull();
  });

  describe("registration_required", () => {
    const registration = (handlers: Handlers = {}) =>
      setup("/auth/oidc?provider=google&result=registration_required", {
        "GET /auth/oidc/pending": () => jsonResponse(200, registrationPending),
        ...handlers,
      });

    it("prefills the suggested username and leaves the birth year empty", async () => {
      const { input } = await registration();

      expect(screen.getByRole("heading", { name: "Завершение регистрации" })).toBeInTheDocument();
      expect(input("Имя пользователя")).toHaveValue("anna_k_4821");
      expect(input("Год рождения")).toHaveValue("");
      expect(input("Год рождения")).toHaveAttribute("inputmode", "numeric");
    });

    it("requires the birth year and validates fields like the registration form", async () => {
      const { requests, user, input } = await registration();

      await user.click(screen.getByRole("button", { name: "Продолжить" }));

      expect(screen.getByText("Укажите год рождения")).toBeInTheDocument();
      expect(input("Год рождения")).toHaveFocus();

      await user.clear(input("Имя пользователя"));
      await user.type(input("Имя пользователя"), "an");
      await user.type(input("Год рождения"), "203");
      await user.click(screen.getByRole("button", { name: "Продолжить" }));

      expect(screen.getByText("Введите не менее 3 символов")).toBeInTheDocument();
      expect(screen.getByText("Введите год рождения в формате YYYY")).toBeInTheDocument();
      expect(input("Имя пользователя")).toHaveFocus();
      expect(requests("POST /auth/oidc/complete")).toHaveLength(0);
    });

    it("201 completes the registration and opens the home page", async () => {
      const { scope, requests, user, input } = await registration({
        "POST /auth/oidc/complete": () => jsonResponse(201, sessionInfo),
      });

      await user.clear(input("Имя пользователя"));
      await user.type(input("Имя пользователя"), "anna_k");
      await user.type(input("Год рождения"), "2003");
      await user.click(screen.getByRole("button", { name: "Продолжить" }));

      await waitFor(() => expect(scope.getState(router.$path)).toBe("/"));
      expect(requests("POST /auth/oidc/complete")).toEqual([
        expect.objectContaining({ body: { username: "anna_k", birth_year: 2003 } }),
      ]);
      expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
    });

    it.each([
      [409, "AUTH_USERNAME_TAKEN", "Другой текст", "username", "Это имя пользователя уже занято", "Имя пользователя"],
      [409, "AUTH_EMAIL_TAKEN", "Другой текст", null, "Пользователь с таким email уже существует", null],
      [400, "AUTH_BIRTH_YEAR_INVALID", "Введите корректный год рождения", "birth_year", null, "Год рождения"],
      [
        400,
        "AUTH_VALIDATION_ERROR",
        "Имя пользователя может содержать только латинские буквы, цифры и нижнее подчёркивание",
        "username",
        null,
        "Имя пользователя",
      ],
      [429, "RATE_LIMITED", "Слишком много запросов. Попробуйте позже", null, null, null],
      [500, "INTERNAL_ERROR", "Другой текст", null, "Произошла ошибка. Попробуйте позже", null],
    ])("%i %s shows the message above the form", async (status, code, message, field, text, label) => {
      const { scope, user, input } = await registration({
        "POST /auth/oidc/complete": () => jsonResponse(status, { code, message, field }),
      });

      await user.type(input("Год рождения"), "2003");
      await user.click(screen.getByRole("button", { name: "Продолжить" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(text ?? message);
      if (label) expect(input(label)).toHaveAttribute("aria-invalid", "true");
      expect(input("Имя пользователя")).toHaveValue("anna_k_4821");
      expect(input("Год рождения")).toHaveValue("2003");
      expect(scope.getState(router.$path)).toBe("/auth/oidc");
    });

    it("410 returns to /register with the provider message", async () => {
      const { scope, user, input } = await registration({ "POST /auth/oidc/complete": oidcExpired });

      await user.type(input("Год рождения"), "2003");
      await user.click(screen.getByRole("button", { name: "Продолжить" }));

      await waitFor(() => expect(scope.getState(router.$path)).toBe("/register"));
      expect(screen.getByText(failedText)).toBeInTheDocument();
    });

    it("an expired pending request returns to /register", async () => {
      const { scope } = await setup("/auth/oidc?provider=google&result=registration_required", {
        "GET /auth/oidc/pending": oidcExpired,
      });

      expect(scope.getState(router.$path)).toBe("/register");
      expect(screen.getByText(failedText)).toBeInTheDocument();
    });
  });

  describe("link_required", () => {
    const link = (handlers: Handlers = {}) =>
      setup("/auth/oidc?provider=google&result=link_required", {
        "GET /auth/oidc/pending": () => jsonResponse(200, linkPending),
        ...handlers,
      });

    const signIn = async (
      { user, input }: { user: ReturnType<typeof userEventSetup>; input: (label: string) => HTMLElement },
      password = "Kino#2026",
    ) => {
      await user.type(input("Пароль"), password);
      await user.click(screen.getByRole("button", { name: "Войти" }));
    };

    it("shows the read-only email and the link message", async () => {
      const { input } = await link();

      expect(
        screen.getByText(
          "Учётная запись с email anna@mail.ru уже существует. Войдите с паролем, чтобы привязать Google",
        ),
      ).toBeInTheDocument();
      expect(input("Email")).toHaveValue("anna@mail.ru");
      expect(input("Email")).toHaveAttribute("readonly");
      expect(input("Пароль")).toHaveValue("");
    });

    it("empty password is not sent", async () => {
      const { requests, user, input } = await link();

      await user.click(screen.getByRole("button", { name: "Войти" }));

      expect(screen.getByText("Введите пароль")).toBeInTheDocument();
      expect(input("Пароль")).toHaveFocus();
      expect(requests("POST /auth/login")).toHaveLength(0);
    });

    it("200 signs in with the email and opens the home page", async () => {
      const page = await link({ "POST /auth/login": () => jsonResponse(200, sessionInfo) });

      await signIn(page);

      await waitFor(() => expect(page.scope.getState(router.$path)).toBe("/"));
      expect(page.requests("POST /auth/login")).toEqual([
        expect.objectContaining({ body: { login: "anna@mail.ru", password: "Kino#2026" } }),
      ]);
      expect(page.scope.getState($$session.outputs.$status)).toBe("authenticated");
    });

    it.each([
      [
        "400 AUTH_INVALID_CREDENTIALS",
        () => loginError(400, "AUTH_INVALID_CREDENTIALS", "Неверные email или пароль"),
        ["Неверные email или пароль"],
      ],
      [
        "400 AUTH_INVALID_CREDENTIALS with captcha_required",
        () => loginError(400, "AUTH_INVALID_CREDENTIALS", "Неверные email или пароль", { captcha: true }),
        ["Неверные email или пароль", "Подтвердите, что вы не робот"],
      ],
      [
        "403 AUTH_ACCOUNT_BLOCKED",
        () => loginError(403, "AUTH_ACCOUNT_BLOCKED", "x"),
        ["Ваша учётная запись заблокирована. Обратитесь в службу поддержки"],
      ],
      [
        "403 AUTH_CAPTCHA_REQUIRED",
        () => loginError(403, "AUTH_CAPTCHA_REQUIRED", "x", { captcha: true }),
        ["Подтвердите, что вы не робот"],
      ],
      [
        "403 AUTH_CAPTCHA_INVALID",
        () => loginError(403, "AUTH_CAPTCHA_INVALID", "x", { captcha: true }),
        ["Проверка не пройдена. Попробуйте ещё раз"],
      ],
      [
        "429 AUTH_LOGIN_LOCKED",
        () => jsonResponse(429, { code: "AUTH_LOGIN_LOCKED", message: "x", field: null }, { "Retry-After": "781" }),
        ["Слишком много попыток входа. Повторите через 14 минут"],
      ],
      [
        "429 RATE_LIMITED",
        () =>
          jsonResponse(429, { code: "RATE_LIMITED", message: "Слишком много запросов. Попробуйте позже", field: null }),
        ["Слишком много запросов. Попробуйте позже"],
      ],
      [
        "500 INTERNAL_ERROR",
        () => jsonResponse(500, { code: "INTERNAL_ERROR", message: "x", field: null }),
        ["Произошла ошибка. Попробуйте позже"],
      ],
    ])("%s shows the table text and clears only the password", async (_name, response, texts) => {
      const page = await link({ "POST /auth/login": response });

      await signIn(page);

      const alert = await screen.findByRole("alert");

      expect([...alert.querySelectorAll("p")].map((line) => line.textContent)).toEqual(texts);
      expect(page.input("Пароль")).toHaveValue("");
      expect(page.input("Email")).toHaveValue("anna@mail.ru");
      expect(page.scope.getState(router.$path)).toBe("/auth/oidc");
      expect(screen.queryByRole("button", { name: "Отправить новую ссылку" })).toBeNull();
    });

    it("403 AUTH_EMAIL_NOT_CONFIRMED offers a new link for the same email", async () => {
      const page = await link({
        "POST /auth/login": () =>
          loginError(
            403,
            "AUTH_EMAIL_NOT_CONFIRMED",
            "Email не подтверждён. Проверьте почту или запросите новую ссылку",
          ),
        "POST /auth/resend-confirmation": () => jsonResponse(202, { resend_after: 60 }),
      });

      await signIn(page);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Email не подтверждён. Проверьте почту или запросите новую ссылку",
      );

      await page.user.click(screen.getByRole("button", { name: "Отправить новую ссылку" }));

      expect(await screen.findByText(/Можно отправить ещё раз через/)).toBeInTheDocument();
      expect(page.requests("POST /auth/resend-confirmation")).toEqual([
        expect.objectContaining({ body: { login: "anna@mail.ru" } }),
      ]);
    });

    it("410 returns to /register with the provider message", async () => {
      const page = await link({ "POST /auth/login": oidcExpired });

      await signIn(page);

      await waitFor(() => expect(page.scope.getState(router.$path)).toBe("/register"));
      expect(screen.getByText(failedText)).toBeInTheDocument();
    });

    it("«Забыли пароль?» leads to the login route", async () => {
      await link();

      expect(screen.getByRole("link", { name: "Забыли пароль?" })).toHaveAttribute("href", "/login");
    });

    it("an error clears only the password", async () => {
      const page = await link({
        "POST /auth/login": () => loginError(400, "AUTH_INVALID_CREDENTIALS", "Неверные email или пароль"),
      });

      await signIn(page);
      await screen.findByRole("alert");

      expect(page.input("Пароль")).toHaveValue("");
      expect(page.input("Email")).toHaveValue("anna@mail.ru");

      await signIn(page, "Kino#2027");

      expect(page.requests("POST /auth/login").map(({ body }) => body)).toEqual([
        { login: "anna@mail.ru", password: "Kino#2026" },
        { login: "anna@mail.ru", password: "Kino#2027" },
      ]);
    });
  });

  describe("texts outside the tables", () => {
    const removed = [
      "Последний шаг",
      "Вы вошли через Google.",
      "Предложено по имени в Google — можно изменить.",
      "Проверьте имя пользователя и укажите год рождения",
      "Привязка Google",
      "Отмена — вернуться к регистрации",
      "Выполняем вход…",
      "Вернуться к регистрации",
    ];

    const expectNoRemovedTexts = () => {
      for (const text of removed) expect(screen.queryByText(text, { exact: false })).toBeNull();
    };

    it.each([
      ["registration_required", registrationPending],
      ["link_required", linkPending],
    ])("%s shows none of them", async (result, pending) => {
      await setup(`/auth/oidc?provider=google&result=${result}`, {
        "GET /auth/oidc/pending": () => jsonResponse(200, pending),
      });

      expectNoRemovedTexts();
    });

    it("the waiting state has no text", async () => {
      await setup("/auth/oidc?provider=google&result=success", {
        "GET /auth/session": () => jsonResponse(200, sessionInfo),
      });

      expectNoRemovedTexts();
    });
  });

  it.each([
    [429, "RATE_LIMITED", "Слишком много запросов. Попробуйте позже", "Слишком много запросов. Попробуйте позже"],
    [500, "INTERNAL_ERROR", "Другой текст", "Произошла ошибка. Попробуйте позже"],
  ])("pending %i %s shows only the table text", async (status, code, message, text) => {
    const { scope } = await setup("/auth/oidc?provider=google&result=registration_required", {
      "GET /auth/oidc/pending": () => jsonResponse(status, { code, message, field: null }),
    });

    expect(screen.getByRole("alert")).toHaveTextContent(text);
    expect(screen.queryByText("Другой текст")).toBeNull();
    expect(screen.queryByRole("link", { name: "Вернуться к регистрации" })).toBeNull();
    expect(scope.getState(router.$path)).toBe("/auth/oidc");
  });

  it("an unknown provider returns to /register without an invented message", async () => {
    const { scope } = await setup("/auth/oidc?provider=github&result=error");

    expect(scope.getState(router.$path)).toBe("/register");
    expect(screen.queryByText(/Не удалось выполнить вход/)).toBeNull();
  });
});
