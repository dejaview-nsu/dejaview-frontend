import { RouterProvider } from "@effector/router-react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "effector-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Routing } from "@/pages";

import { $$session } from "@/entities/session";

import { MOCK_STORAGE_KEYS, type MockStorage } from "@/shared/api/mocks";
import { router } from "@/shared/routes";

import { createTestMockStorage, setupMockApiScope } from "../session-scope";

const open = async (path: string, { scenario, signedIn = false }: { scenario?: string; signedIn?: boolean } = {}) => {
  const storage: MockStorage = createTestMockStorage();

  if (scenario) storage.set(MOCK_STORAGE_KEYS.authScenario, scenario);

  if (signedIn) storage.set(MOCK_STORAGE_KEYS.session, "authenticated");

  const { scope } = await act(() => setupMockApiScope({ initialEntry: path, storage }));

  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <Routing />
      </RouterProvider>
    </Provider>,
  );

  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const input = (label: string) => screen.getByLabelText(label, { selector: "input" });
  const header = () => screen.getByRole("navigation", { name: "Главная навигация" });

  return { scope, storage, user, input, header };
};

type Page = Awaited<ReturnType<typeof open>>;

const fillRegistration = async ({ user, input }: Page, birthYear = "2003") => {
  await user.type(input("Имя пользователя"), "anna_k");
  await user.type(input("Email"), "anna@mail.ru");
  await user.type(input("Год рождения"), birthYear);
  await user.type(input("Пароль"), "Kino#2026");
  await user.type(input("Подтверждение пароля"), "Kino#2026");
  await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("registration acceptance on mocks", () => {
  it("1. successful registration shows the email, a 60 s timer and resends the letter", async () => {
    const page = await open("/register", { scenario: "register_ok" });

    await fillRegistration(page);

    const region = await screen.findByRole("region", { name: "Проверь почту" });
    const resend = () => within(region).getByRole("button", { name: "Отправить повторно" });

    expect(within(region).getByText("anna@mail.ru")).toBeInTheDocument();
    expect(page.scope.getState(router.$path)).toBe("/register");
    expect(resend()).toBeDisabled();
    expect(within(region).getByText(/Можно отправить ещё раз через (1:00|0:59)/)).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(61_000));

    expect(resend()).toBeEnabled();

    await page.user.click(resend());

    expect(await within(region).findByText(/Можно отправить ещё раз через (1:00|0:59)/)).toBeInTheDocument();
    expect(resend()).toBeDisabled();
  });

  it.each([
    ["register_username_taken", "Это имя пользователя уже занято", "Имя пользователя"],
    ["register_email_taken", "Пользователь с таким email уже существует", "Email"],
  ])("2. %s shows the error above the form, highlights the field and keeps the data", async (scenario, text, label) => {
    const page = await open("/register", { scenario });

    await fillRegistration(page);

    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(page.input(label)).toHaveAttribute("aria-invalid", "true");
    expect(page.input("Имя пользователя")).toHaveValue("anna_k");
    expect(page.input("Email")).toHaveValue("anna@mail.ru");
    expect(page.input("Пароль")).toHaveValue("Kino#2026");
    expect(page.input("Подтверждение пароля")).toHaveValue("Kino#2026");
  });

  it("3. register_birth_year_invalid marks the birth year", async () => {
    const page = await open("/register", { scenario: "register_birth_year_invalid" });

    await fillRegistration(page);

    expect(await screen.findByRole("alert")).toHaveTextContent("Введите корректный год рождения");
    expect(page.input("Год рождения")).toHaveAttribute("aria-invalid", "true");
    expect(page.input("Год рождения")).toHaveFocus();
  });

  it("4. confirm_ok opens the home page with the notification and the account in the header", async () => {
    const page = await open("/confirm-email?token=abc", { scenario: "confirm_ok" });

    expect(page.scope.getState(router.$path)).toBe("/");
    expect(screen.getByText("Email подтверждён. Добро пожаловать в DejaView!")).toBeInTheDocument();
    expect(within(page.header()).getByRole("button", { name: "Меню пользователя movie_fan_42" })).toBeInTheDocument();
  });

  it("5. confirm_expired offers a new link and shows the sent screen", async () => {
    const page = await open("/confirm-email?token=abc", { scenario: "confirm_expired" });

    expect(screen.getByRole("heading", { name: "Срок действия ссылки истёк" })).toBeInTheDocument();

    await page.user.click(screen.getByRole("button", { name: "Отправить новую ссылку" }));

    const region = await screen.findByRole("region", { name: "Проверь почту" });

    expect(
      within(region).getByText("Письмо отправлено. Перейдите по ссылке в письме для завершения регистрации"),
    ).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Отправить повторно" })).toBeDisabled();
  });

  it("6. oidc_pending_registration prefills the name and completes the registration", async () => {
    const page = await open("/auth/oidc?provider=google&result=registration_required", {
      scenario: "oidc_pending_registration",
    });

    expect(page.input("Имя пользователя")).toHaveValue("ivan_petrov");
    expect(page.input("Год рождения")).toHaveValue("");

    await page.user.type(page.input("Год рождения"), "1998");
    await page.user.click(screen.getByRole("button", { name: "Продолжить" }));

    await waitFor(() => expect(page.scope.getState(router.$path)).toBe("/"));
    expect(page.scope.getState($$session.outputs.$status)).toBe("authenticated");
    expect(within(page.header()).getByRole("button", { name: "Меню пользователя movie_fan_42" })).toBeInTheDocument();
  });

  it("7. oidc_pending_link signs in by password; a 400 clears only the password", async () => {
    const page = await open("/auth/oidc?provider=vk&result=link_required", {
      scenario: "oidc_pending_link,login_invalid_email",
    });

    expect(page.input("Email")).toHaveValue("ivan@example.com");
    expect(page.input("Email")).toHaveAttribute("readonly");

    await page.user.type(page.input("Пароль"), "Wrong#2026");
    await page.user.click(screen.getByRole("button", { name: "Войти" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Неверные email или пароль");
    expect(page.input("Пароль")).toHaveValue("");
    expect(page.input("Email")).toHaveValue("ivan@example.com");

    page.storage.set(MOCK_STORAGE_KEYS.authScenario, "oidc_pending_link,login_ok");

    await page.user.type(page.input("Пароль"), "Kino#2026");
    await page.user.click(screen.getByRole("button", { name: "Войти" }));

    await waitFor(() => expect(page.scope.getState(router.$path)).toBe("/"));
    expect(page.scope.getState($$session.outputs.$status)).toBe("authenticated");
  });

  it("8a. result=error returns to /register with the provider message", async () => {
    const page = await open("/auth/oidc?provider=yandex&result=error");

    expect(page.scope.getState(router.$path)).toBe("/register");
    expect(
      screen.getByText("Не удалось выполнить вход через Яндекс. Попробуйте снова или используйте другой способ"),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Создать аккаунт" })).toBeInTheDocument();
  });

  it("8b. an unknown provider returns to /register without a message", async () => {
    const page = await open("/auth/oidc?provider=github&result=error");

    expect(page.scope.getState(router.$path)).toBe("/register");
    expect(screen.queryByText(/Не удалось выполнить вход/)).toBeNull();
  });

  it("9. logout returns home as a guest with login and registration in the header", async () => {
    const page = await open("/", { signedIn: true });

    await page.user.click(within(page.header()).getByRole("button", { name: "Меню пользователя movie_fan_42" }));
    await page.user.click(screen.getByRole("menuitem", { name: /Выйти/ }));

    await waitFor(() => expect(page.scope.getState($$session.outputs.$status)).toBe("guest"));
    expect(page.scope.getState(router.$path)).toBe("/");
    expect(within(page.header()).getByRole("button", { name: "Войти" })).toBeInTheDocument();
    expect(within(page.header()).getByRole("link", { name: "Зарегистрироваться" })).toBeInTheDocument();
  });

  it("10a. a guest on /register sees the form", async () => {
    const page = await open("/register");

    expect(page.scope.getState(router.$path)).toBe("/register");
    expect(screen.getByRole("form", { name: "Создать аккаунт" })).toBeInTheDocument();
  });

  it("10b. a signed in user on /register goes home", async () => {
    const page = await open("/register", { signedIn: true });

    expect(page.scope.getState(router.$path)).toBe("/");
    expect(screen.queryByRole("form", { name: "Создать аккаунт" })).toBeNull();
  });
});
