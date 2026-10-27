import { RouterProvider } from "@effector/router-react";
import { act, render, screen, within } from "@testing-library/react";
import { allSettled, fork, type Scope } from "effector";
import { Provider } from "effector-react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { RegisterPage } from "@/pages/register";

import { BaseLayout } from "@/layouts/base";

import { $$notifications } from "@/shared/lib/notifications";
import { router } from "@/shared/routes";

import { jsonResponse } from "../../controlled-transport";
import { setupSessionScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const REGISTRATION_UI = [
  "src/layouts/auth",
  "src/shared/ui/panel",
  "src/shared/ui/form-field",
  "src/pages/register/ui",
  "src/pages/confirm-email/ui",
  "src/pages/oidc-callback/ui",
  "src/features/resend-confirmation/ui",
  "src/features/oidc-sign-in/ui",
  "src/layouts/base/ui/notification-banner.tsx",
];

const collectFiles = (path: string): string[] =>
  statSync(path).isDirectory()
    ? readdirSync(path).flatMap((name) => collectFiles(join(path, name)))
    : path.endsWith(".tsx")
      ? [path]
      : [];

const files = REGISTRATION_UI.flatMap(collectFiles);

const renderInLayout = (scope: Scope, page: ReactNode) =>
  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <BaseLayout>{page}</BaseLayout>
      </RouterProvider>
    </Provider>,
  );

describe("design system tokens", () => {
  it("finds the registration components", () => {
    expect(files.length).toBeGreaterThanOrEqual(12);
  });

  it.each(files)("%s has no hex, rgb or px values", (file) => {
    const source = readFileSync(file, "utf8");

    expect(source).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(source).not.toMatch(/\brgba?\(/);
    expect(source).not.toMatch(/\d(\.\d+)?px\b/);
  });

  it("columns and the hero switch at the desktop breakpoint token", () => {
    const shell = readFileSync("src/layouts/auth/ui/auth-shell.tsx", "utf8");

    expect(shell).toMatch(/desktop:flex/);
    expect(shell).not.toMatch(/\blg:/);
  });
});

describe("header on registration pages", () => {
  it.each(["/register", "/confirm-email?token=abc", "/auth/oidc?provider=google&result=account_blocked"])(
    "%s shows only the logo to a guest, as in the mockups",
    async (path) => {
      const { scope } = await setupSessionScope({
        initialEntry: path,
        transport: async () => jsonResponse(410, { code: "AUTH_CONFIRMATION_LINK_EXPIRED", message: "x", field: null }),
      });

      renderInLayout(scope, <div />);

      const header = screen.getByRole("navigation", { name: "Главная навигация" });

      expect(within(header).getByRole("link", { name: "DejaView — главная" })).toBeInTheDocument();
      expect(within(header).queryByRole("button", { name: "Войти" })).toBeNull();
      expect(within(header).queryByRole("link", { name: "Зарегистрироваться" })).toBeNull();
      expect(within(header).queryByRole("button", { name: "Открыть меню" })).toBeNull();
    },
  );

  it("the home page still shows guest actions", async () => {
    const { scope } = await setupSessionScope({ initialEntry: "/" });

    renderInLayout(scope, <div />);

    const header = screen.getByRole("navigation", { name: "Главная навигация" });

    expect(within(header).getByRole("button", { name: "Войти" })).toBeEnabled();
    expect(within(header).getByRole("link", { name: "Зарегистрироваться" })).toHaveAttribute("href", "/register");
  });

  it("a signed in user keeps the account menu on /confirm-email", async () => {
    const { scope } = await setupSessionScope({
      initialEntry: "/confirm-email?token=abc",
      authenticated: true,
      transport: async () => jsonResponse(410, { code: "AUTH_CONFIRMATION_LINK_EXPIRED", message: "x", field: null }),
    });

    renderInLayout(scope, <div />);

    expect(screen.getByRole("button", { name: "Меню пользователя movie_fan_42" })).toBeInTheDocument();
  });
});

describe("accessibility", () => {
  it("an invalid field has aria-invalid and its message in aria-describedby", async () => {
    const { scope } = await setupSessionScope({ initialEntry: "/register" });

    renderInLayout(scope, <RegisterPage />);

    const user = userEventSetup();
    const field = screen.getByLabelText("Имя пользователя", { selector: "input" });

    await user.click(field);
    await user.tab();

    const message = screen.getByText("Введите имя пользователя").closest("p") as HTMLElement;

    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field.getAttribute("aria-describedby")?.split(" ")).toContain(message.id);
  });

  it("the password checklist reads each rule with its state", async () => {
    const { scope } = await setupSessionScope({ initialEntry: "/register" });

    renderInLayout(scope, <RegisterPage />);

    await userEventSetup().type(screen.getByLabelText("Пароль", { selector: "input" }), "Kino#");

    expect(
      within(screen.getByRole("list", { name: "Требования к паролю" }))
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Длина от 8 до 128 символов — не выполнено",
      "Заглавная латинская буква — выполнено",
      "Строчная латинская буква — выполнено",
      "Хотя бы одна цифра — не выполнено",
      "Хотя бы один спецсимвол: ! @ # $ % и др. — выполнено",
    ]);
  });

  it.each([
    ["success", "status"],
    ["error", "alert"],
  ] as const)("a %s banner has role=%s and a «Закрыть» button", async (tone, role) => {
    const scope = fork();

    renderInLayout(scope, <div />);

    await act(() => allSettled($$notifications.inputs.shown, { scope, params: { text: "Уведомление", tone } }));

    const banner = screen.getByText("Уведомление").closest(`[role="${role}"]`) as HTMLElement;

    expect(banner).not.toBeNull();
    expect(within(banner).getByRole("button", { name: "Закрыть" })).toBeInTheDocument();
  });
});
