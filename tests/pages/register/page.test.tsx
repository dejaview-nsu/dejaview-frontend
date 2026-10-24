import { RouterProvider } from "@effector/router-react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { allSettled } from "effector";
import { Provider } from "effector-react";
import { describe, expect, it, vi } from "vitest";

import { $$registerForm, RegisterPage } from "@/pages/register";

import type { Transport } from "@/shared/api";
import { router, routes } from "@/shared/routes";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";
import { setupSessionScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const filled = {
  username: "anna_k",
  email: "anna@mail.ru",
  birthYear: "2003",
  password: "Kino#2026",
};

const registerRequests = (transport: ReturnType<typeof vi.fn<Transport>>) =>
  transport.mock.calls.map(([request]) => request).filter(({ path }) => path === "/auth/register");

const setup = async (transport: Transport = async () => jsonResponse(201, { resend_after: 60 })) => {
  const spy = vi.fn<Transport>(transport);
  const { scope } = await setupSessionScope({ initialEntry: "/register", transport: spy });

  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <RegisterPage />
      </RouterProvider>
    </Provider>,
  );

  const user = userEventSetup();
  const input = (label: string) => screen.getByLabelText(label, { selector: "input" });

  const fill = async (values: Partial<typeof filled & { confirmation: string }> = {}) => {
    const data = { ...filled, confirmation: values.password ?? filled.password, ...values };

    await user.type(input("Имя пользователя"), data.username);
    await user.type(input("Email"), data.email);
    await user.type(input("Год рождения"), data.birthYear);
    await user.type(input("Пароль"), data.password);
    await user.type(input("Подтверждение пароля"), data.confirmation);
  };

  const submit = () => user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));

  return { scope, transport: spy, user, input, fill, submit };
};

const serverError = (status: number, code: string, message: string, field: string | null) => async () =>
  jsonResponse(status, { code, message, field });

describe("register page", () => {
  it("shows the five fields in the mockup order with mobile-friendly inputs", async () => {
    const { input } = await setup();
    const form = screen.getByRole("form", { name: "Создать аккаунт" });

    expect(
      within(form)
        .getAllByRole("textbox")
        .map((element) => element.getAttribute("name")),
    ).toEqual(["username", "email", "birthYear"]);
    expect([...form.querySelectorAll("input")].map((element) => element.name)).toEqual([
      "username",
      "email",
      "birthYear",
      "password",
      "passwordConfirmation",
    ]);
    expect(input("Год рождения")).toHaveAttribute("inputmode", "numeric");
    expect(input("Пароль")).toHaveAttribute("maxlength", "128");
    expect(input("Пароль")).toHaveAttribute("type", "password");
  });

  it("validates a field when it loses focus without contacting the server", async () => {
    const { transport, user, input } = await setup();

    await user.type(input("Имя пользователя"), "an");
    await user.tab();

    expect(screen.getByText("Введите не менее 3 символов")).toBeInTheDocument();
    expect(input("Имя пользователя")).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByText("Введите email")).not.toBeInTheDocument();

    await user.tab();

    expect(screen.getByText("Введите email")).toBeInTheDocument();

    await user.type(input("Имя пользователя"), "n");

    expect(screen.queryByText("Введите не менее 3 символов")).not.toBeInTheDocument();
    expect(registerRequests(transport)).toHaveLength(0);
  });

  it("empty submit shows every message and focuses the first invalid field", async () => {
    const { transport, input, submit } = await setup();

    await submit();

    expect(screen.getByText("Введите имя пользователя")).toBeInTheDocument();
    expect(screen.getByText("Введите email")).toBeInTheDocument();
    expect(screen.getByText("Укажите год рождения")).toBeInTheDocument();
    expect(screen.getByText("Введите пароль")).toBeInTheDocument();
    expect(input("Имя пользователя")).toHaveFocus();
    expect(registerRequests(transport)).toHaveLength(0);
  });

  it("focuses the first invalid field in form order", async () => {
    const { transport, input, fill, submit } = await setup();

    await fill({ birthYear: "1899", confirmation: "Kino#2025" });
    await submit();

    expect(screen.getByText("Введите корректный год рождения")).toBeInTheDocument();
    expect(screen.getByText("Пароли не совпадают")).toBeInTheDocument();
    expect(input("Год рождения")).toHaveFocus();
    expect(registerRequests(transport)).toHaveLength(0);
  });

  it.each([
    ["username", "Имя пользователя", "", "Введите имя пользователя"],
    ["username", "Имя пользователя", "an", "Введите не менее 3 символов"],
    ["username", "Имя пользователя", "a".repeat(31), "Имя пользователя должно содержать не более 30 символов"],
    [
      "username",
      "Имя пользователя",
      "анна",
      "Имя пользователя может содержать только латинские буквы, цифры и нижнее подчёркивание",
    ],
    ["email", "Email", "", "Введите email"],
    ["email", "Email", "ann@mail", "Введите корректный email"],
    ["birth year", "Год рождения", "", "Укажите год рождения"],
    ["birth year", "Год рождения", "203", "Введите год рождения в формате YYYY"],
    ["birth year", "Год рождения", "1899", "Введите корректный год рождения"],
    [
      "birth year",
      "Год рождения",
      String(new Date().getFullYear() + 1),
      "Год рождения не может быть больше текущего года",
    ],
    ["password", "Пароль", "", "Введите пароль"],
  ])("%s %j shows «%s» under the field on blur", async (_name, label, value, text) => {
    const { transport, user, input } = await setup();

    await user.click(input(label));
    if (value) await user.type(input(label), value);
    await user.tab();

    const field = input(label);
    const error = screen.getByText(text);

    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field.getAttribute("aria-describedby")).toContain(error.id);
    expect(registerRequests(transport)).toHaveLength(0);
  });

  it("password confirmation mismatch shows «Пароли не совпадают»", async () => {
    const { user, input } = await setup();

    await user.type(input("Пароль"), "Kino#2026");
    await user.type(input("Подтверждение пароля"), "Kino#2025");
    await user.tab();

    expect(screen.getByText("Пароли не совпадают")).toBeInTheDocument();
    expect(input("Подтверждение пароля")).toHaveAttribute("aria-invalid", "true");
  });

  it("password checklist is neutral while empty and updates on every keystroke", async () => {
    const { user, input } = await setup();
    const states = () =>
      within(screen.getByRole("list", { name: "Требования к паролю" }))
        .getAllByRole("listitem")
        .map((item) => item.dataset.state);

    expect(states()).toEqual(["neutral", "neutral", "neutral", "neutral", "neutral"]);

    await user.type(input("Пароль"), "k");

    expect(states()).toEqual(["failed", "failed", "passed", "failed", "failed"]);

    await user.type(input("Пароль"), "ino");
    await user.type(input("Пароль"), "#");

    expect(states()).toEqual(["failed", "failed", "passed", "failed", "passed"]);

    await user.type(input("Пароль"), "K");

    expect(states()).toEqual(["failed", "passed", "passed", "failed", "passed"]);

    await user.type(input("Пароль"), "20");

    expect(states()).toEqual(["passed", "passed", "passed", "passed", "passed"]);

    await user.type(input("Пароль"), "{Backspace}{Backspace}{Backspace}");

    expect(states()).toEqual(["failed", "failed", "passed", "failed", "passed"]);

    await user.clear(input("Пароль"));

    expect(states()).toEqual(["neutral", "neutral", "neutral", "neutral", "neutral"]);
  });

  it.each([
    ["uppercase", "kino#2026", "Заглавная латинская буква", ["A", "M", "Z"], ["Ж", "Я"]],
    ["lowercase", "KINO#2026", "Строчная латинская буква", ["a", "m", "z"], ["ж", "я"]],
    ["digit", "Kino#kino", "Хотя бы одна цифра", ["0", "5", "9"], ["٣"]],
    ["special", "Kino2026", "Хотя бы один спецсимвол: ! @ # $ % и др.", ["!", "#", "_"], []],
  ])(
    "%s rule: the cross clears after a matching character and returns after deleting it",
    async (_rule, base, label, matching, ignored) => {
      const { user, input, fill, submit } = await setup();
      const item = () => within(screen.getByRole("list", { name: "Требования к паролю" })).getByText(label);

      await fill({ password: base });
      await submit();

      expect(item()).toHaveTextContent("— не выполнено");
      expect(input("Пароль")).toHaveAttribute("aria-invalid", "true");

      for (const character of ignored) {
        await user.type(input("Пароль"), character);

        expect(item()).toHaveTextContent("— не выполнено");

        await user.type(input("Пароль"), "{Backspace}");
      }

      for (const character of matching) {
        await user.type(input("Пароль"), character);

        expect(item()).toHaveTextContent("— выполнено");
        expect(item()).not.toHaveTextContent("не выполнено");

        await user.type(input("Пароль"), "{Backspace}");

        expect(item()).toHaveTextContent("— не выполнено");
      }
    },
  );

  it("an invalid password shows no text under the field and is not sent", async () => {
    const { transport, input, fill, submit } = await setup();

    await fill({ password: "kino" });
    await submit();

    expect(input("Пароль")).toHaveAttribute("aria-invalid", "true");
    expect(input("Пароль")).toHaveFocus();
    expect(screen.queryByText(/Пароль должен содержать/)).not.toBeInTheDocument();
    expect(screen.queryByText("Введите пароль")).not.toBeInTheDocument();
    expect(registerRequests(transport)).toHaveLength(0);
  });

  it("201 sends the contract body and shows the check-email screen on /register", async () => {
    const { scope, transport, fill, submit } = await setup();

    await fill();
    await submit();

    expect(await screen.findByRole("heading", { name: "Проверь почту" })).toHaveFocus();
    expect(screen.getByText("anna@mail.ru")).toBeInTheDocument();
    expect(registerRequests(transport)).toEqual([
      expect.objectContaining({
        method: "POST",
        path: "/auth/register",
        body: { username: "anna_k", email: "anna@mail.ru", birth_year: 2003, password: "Kino#2026" },
      }),
    ]);
    expect(scope.getState(router.$path)).toBe("/register");
    expect(scope.getState($$registerForm.outputs.$confirmation)).toEqual({ email: "anna@mail.ru", resendAfter: 60 });
  });

  it.each([
    [
      400,
      "AUTH_VALIDATION_ERROR",
      "Имя пользователя должно содержать не менее 3 символов",
      "username",
      "Имя пользователя",
    ],
    [
      400,
      "AUTH_VALIDATION_ERROR",
      "Пароль должен содержать хотя бы одну заглавную букву, одну строчную букву и одну цифру",
      "password",
      "Пароль",
    ],
    [400, "AUTH_BIRTH_YEAR_INVALID", "Введите корректный год рождения", "birth_year", "Год рождения"],
    [409, "AUTH_EMAIL_TAKEN", "Пользователь с таким email уже существует", "email", "Email"],
    [409, "AUTH_USERNAME_TAKEN", "Это имя пользователя уже занято", "username", "Имя пользователя"],
  ])("%i %s shows the message above the form and highlights the field", async (status, code, text, field, label) => {
    const { input, fill, submit } = await setup(serverError(status, code, text, field));

    await fill();
    await submit();

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent(text);
    expect(screen.getAllByText(text)).toHaveLength(1);
    expect(input(label)).toHaveAttribute("aria-invalid", "true");
    expect(input(label)).toHaveFocus();
    expect(screen.getAllByRole("textbox").filter((element) => element.getAttribute("aria-invalid") === "true")).toEqual(
      label.startsWith("Пароль") ? [] : [input(label)],
    );
    expect(input("Имя пользователя")).toHaveValue("anna_k");
    expect(input("Email")).toHaveValue("anna@mail.ru");
    expect(input("Год рождения")).toHaveValue("2003");
    expect(input("Пароль")).toHaveValue("Kino#2026");
    expect(input("Подтверждение пароля")).toHaveValue("Kino#2026");
    expect(screen.queryByRole("heading", { name: "Проверь почту" })).not.toBeInTheDocument();
  });

  it.each([
    [429, "RATE_LIMITED", "Слишком много запросов. Попробуйте позже"],
    [500, "INTERNAL_ERROR", "Произошла ошибка. Попробуйте позже"],
  ])("%i %s shows the server message above the form and keeps the data", async (status, code, text) => {
    const { input, fill, submit } = await setup(serverError(status, code, text, null));

    await fill();
    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(document.querySelectorAll('[aria-invalid="true"]')).toHaveLength(0);
    expect(input("Email")).toHaveValue("anna@mail.ru");
    expect(input("Пароль")).toHaveValue("Kino#2026");
  });

  it.each([
    [409, "AUTH_EMAIL_TAKEN", "email", "Email", "Пользователь с таким email уже существует"],
    [409, "AUTH_USERNAME_TAKEN", "username", "Имя пользователя", "Это имя пользователя уже занято"],
    [500, "INTERNAL_ERROR", null, null, "Произошла ошибка. Попробуйте позже"],
  ])("%i %s shows the table text regardless of the server wording", async (status, code, field, label, text) => {
    const { input, fill, submit } = await setup(serverError(status, code, "Другая формулировка сервера", field));

    await fill();
    await submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(screen.queryByText("Другая формулировка сервера")).not.toBeInTheDocument();
    if (label) expect(input(label)).toHaveAttribute("aria-invalid", "true");
  });

  it("a new attempt replaces the previous server message", async () => {
    const responses = [
      serverError(409, "AUTH_EMAIL_TAKEN", "Пользователь с таким email уже существует", "email"),
      serverError(500, "INTERNAL_ERROR", "Произошла ошибка. Попробуйте позже", null),
    ];
    const { fill, submit } = await setup(() => responses.shift()!());

    await fill();
    await submit();
    await screen.findByText("Пользователь с таким email уже существует");
    await submit();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Произошла ошибка. Попробуйте позже"));
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByText("Пользователь с таким email уже существует")).not.toBeInTheDocument();
  });

  it("blocks the button while the request runs and sends only one request", async () => {
    const held = createControlledTransport();
    const { fill, user } = await setup(held.transport);

    await fill();

    const button = screen.getByRole("button", { name: "Зарегистрироваться" });

    await user.click(button);
    await held.waitForCalls(1);

    expect(screen.getByRole("button", { name: "Регистрируем…" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Регистрируем…" }));
    await user.keyboard("{Enter}");

    expect(held.calls).toHaveLength(1);

    held.current().resolve(jsonResponse(201, { resend_after: 60 }));

    expect(await screen.findByRole("heading", { name: "Проверь почту" })).toBeInTheDocument();
    expect(held.calls).toHaveLength(1);
  });

  it("both login links lead to the existing login route", async () => {
    await setup();

    expect(screen.getByRole("link", { name: "Войти" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Забыли пароль?" })).toHaveAttribute("href", "/login");
  });

  it("opening /register again shows an empty form", async () => {
    const { scope, fill, submit, input } = await setup();

    await fill();
    await submit();
    await screen.findByRole("heading", { name: "Проверь почту" });

    await allSettled(routes.about.open, { scope, params: undefined });
    await allSettled(routes.register.open, { scope, params: undefined });

    expect(await screen.findByRole("form", { name: "Создать аккаунт" })).toBeInTheDocument();
    expect(input("Имя пользователя")).toHaveValue("");
    expect(input("Пароль")).toHaveValue("");
  });
});
