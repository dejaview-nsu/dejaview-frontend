import { RouterProvider } from "@effector/router-react";
import { act, render, screen, within } from "@testing-library/react";
import { allSettled, fork, type Scope } from "effector";
import { Provider } from "effector-react";
import { type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { OidcCallbackPage } from "@/pages/oidc-callback";
import { RegisterPage } from "@/pages/register";

import { BaseLayout } from "@/layouts/base";

import { $$notifications } from "@/shared/lib/notifications";
import { router } from "@/shared/routes";

import { setupSessionScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const renderInLayout = (scope: Scope, page: ReactNode) =>
  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <BaseLayout>{page}</BaseLayout>
      </RouterProvider>
    </Provider>,
  );

const setupRegister = async () => {
  const { scope } = await setupSessionScope({ initialEntry: "/register" });

  renderInLayout(scope, <RegisterPage />);

  return {
    scope,
    user: userEventSetup(),
    input: (label: string) => screen.getByLabelText(label, { selector: "input" }),
  };
};

describe("registration layout", () => {
  it("uses the brand shell with the dark header", async () => {
    await setupRegister();

    expect(screen.getByRole("navigation", { name: "Главная навигация" })).toBeInTheDocument();
    expect(screen.getByText("Найди то, что почти забыл")).toBeInTheDocument();
  });

  it("shows the benefits column from the desktop breakpoint and hides it on phones", async () => {
    await setupRegister();

    const benefits = screen.getByTestId("auth-benefits");

    expect(benefits).toHaveClass("hidden", "desktop:flex");
    expect(
      within(benefits)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Поиск по кадру, видео, звукуНе только по описанию сцены",
      "Списки фильмов«Хочу посмотреть» и «Просмотрено»",
      "Оценки и отзывыДелись мнением о фильмах",
      "Профиль со статистикойСколько посмотрел и что любишь",
    ]);
  });

  it("keeps a 16 px side padding and no fixed width on phones", async () => {
    await setupRegister();

    const content = screen.getByTestId("auth-content");

    expect(content).toHaveClass("w-full", "px-4");
    expect(content.className).not.toMatch(/(^|\s)(w|min-w)-\[\d+px\]/);
    expect(content).toHaveClass("desktop:flex");
  });
});

describe("registration form accessibility", () => {
  it("every field has a visible label", async () => {
    const { input } = await setupRegister();

    for (const label of ["Имя пользователя", "Email", "Год рождения", "Пароль", "Подтверждение пароля"]) {
      const field = input(label);
      const visibleLabel = document.querySelector(`label[for="${field.id}"]`);

      expect(visibleLabel).toHaveTextContent(label);
    }
  });

  it("birth year opens the numeric keyboard", async () => {
    const { input } = await setupRegister();

    expect(input("Год рождения")).toHaveAttribute("inputmode", "numeric");
  });

  it("an invalid field is marked and linked to its message", async () => {
    const { user, input } = await setupRegister();

    await user.click(input("Email"));
    await user.tab();

    const field = input("Email");
    const message = screen.getByText("Введите email").closest("p");

    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(message).not.toBeNull();
    expect(field.getAttribute("aria-describedby")?.split(" ")).toContain(message?.id);
  });

  it.each(["Пароль", "Подтверждение пароля"])("%s has a show and hide password button", async (label) => {
    const { user, input } = await setupRegister();
    const field = input(label);
    const toggle = within(field.parentElement as HTMLElement).getByRole("button", { name: "Показать пароль" });

    expect(field).toHaveAttribute("type", "password");
    expect(toggle).toHaveAttribute("aria-controls", field.id);

    await user.click(toggle);

    expect(field).toHaveAttribute("type", "text");
    expect(within(field.parentElement as HTMLElement).getByRole("button", { name: "Скрыть пароль" })).toBe(toggle);

    await user.click(toggle);

    expect(field).toHaveAttribute("type", "password");
  });

  it("checklist items read the rule and its state for screen readers", async () => {
    const { user, input } = await setupRegister();
    const items = () =>
      within(screen.getByRole("list", { name: "Требования к паролю" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent);

    expect(items()).toEqual([
      "Длина от 8 до 128 символов — не выполнено",
      "Заглавная латинская буква — не выполнено",
      "Строчная латинская буква — не выполнено",
      "Хотя бы одна цифра — не выполнено",
      "Хотя бы один спецсимвол: ! @ # $ % и др. — не выполнено",
    ]);

    await user.type(input("Пароль"), "Kino2");

    expect(items()).toEqual([
      "Длина от 8 до 128 символов — не выполнено",
      "Заглавная латинская буква — выполнено",
      "Строчная латинская буква — выполнено",
      "Хотя бы одна цифра — выполнено",
      "Хотя бы один спецсимвол: ! @ # $ % и др. — не выполнено",
    ]);

    const list = screen.getByRole("list", { name: "Требования к паролю" });

    for (const item of within(list).getAllByRole("listitem")) {
      expect(item.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
      expect(item.querySelector(".sr-only")).not.toBeNull();
    }

    expect(
      new Set([...list.querySelectorAll("svg")].map((icon) => icon.getAttribute("class")?.match(/lucide-[\w-]+/)?.[0])),
    ).toEqual(new Set(["lucide-circle-check", "lucide-circle-x"]));
  });

  it("provider buttons keep the mockup case and touch size", async () => {
    await setupRegister();

    for (const name of ["Продолжить с Google", "Продолжить с Яндекс", "Продолжить с VK"]) {
      const link = screen.getByRole("link", { name });

      expect(link.className).not.toMatch(/(^|\s)uppercase(\s|$)/);
      expect(link).toHaveClass("min-h-12");
    }
  });

  it("the login link is at least 44 px tall", async () => {
    await setupRegister();

    const form = screen.getByRole("region", { name: "Создать аккаунт" });

    expect(within(form).getByRole("link", { name: "Войти" })).toHaveClass("min-h-11");
  });
});

describe("waiting state", () => {
  it("the OIDC spinner is busy and stops spinning with reduced motion", () => {
    const scope = fork();

    renderInLayout(scope, <OidcCallbackPage />);

    const busy = document.querySelector('[aria-busy="true"]');

    expect(busy).not.toBeNull();
    expect(busy?.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(busy?.querySelector("svg")).toHaveClass("motion-safe:animate-spin");
    expect(busy?.querySelector("svg")).not.toHaveClass("animate-spin");
  });
});

describe("notification banner", () => {
  it.each([
    ["success", "status"],
    ["error", "alert"],
  ] as const)("%s uses role=%s and a close button labelled «Закрыть»", async (tone, role) => {
    const { scope } = await setupSessionScope({ initialEntry: "/register" });

    renderInLayout(scope, <div />);

    await act(() => allSettled($$notifications.inputs.shown, { scope, params: { text: "Текст уведомления", tone } }));

    const banner = screen.getByText("Текст уведомления").closest(`[role="${role}"]`) as HTMLElement;

    expect(banner).not.toBeNull();
    expect(within(banner).getByRole("button", { name: "Закрыть" })).toHaveClass("min-h-11", "min-w-11");

    await userEventSetup().click(within(banner).getByRole("button", { name: "Закрыть" }));

    expect(screen.queryByText("Текст уведомления")).toBeNull();
  });
});
