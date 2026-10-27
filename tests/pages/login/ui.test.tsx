import { RouterProvider } from "@effector/router-react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { allSettled, fork } from "effector";
import { Provider } from "effector-react";
import { describe, expect, it } from "vitest";

import { Routing } from "@/pages";
import { $$home } from "@/pages/home";

import { BaseLayout } from "@/layouts/base";

import { $$session } from "@/entities/session";

import { transportFx } from "@/shared/api";
import { MOCK_STORAGE_KEYS } from "@/shared/api/mocks";
import { router } from "@/shared/routes";

import { createControlledTransport } from "../../controlled-transport";
import { createTestMockStorage, setupMockApiScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const setup = async (path = "/login", scenario?: string) => {
  const storage = createTestMockStorage();
  if (scenario) storage.set(MOCK_STORAGE_KEYS.authScenario, scenario);
  const { scope } = await setupMockApiScope({ initialEntry: path, storage });

  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <Routing />
      </RouterProvider>
    </Provider>,
  );
  return { scope, storage, user: userEventSetup() };
};

describe("login form UI", () => {
  it("shows the production form and validates/focuses fields without a request", async () => {
    const { user } = await setup();
    expect(screen.queryByText(/заглушка/)).not.toBeInTheDocument();
    expect(screen.queryByText("Забыли пароль?")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Продолжить с/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Закрыть окно входа" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Войти" }));
    expect(screen.getByText("Введите имя пользователя или email")).toBeInTheDocument();
    expect(screen.getByText("Введите пароль")).toBeInTheDocument();
    expect(screen.getByLabelText("Имя пользователя или Email")).toHaveFocus();

    await user.type(screen.getByLabelText("Имя пользователя или Email"), "невалидный логин");
    await user.tab();
    expect(screen.getByText("Введите корректные имя пользователя или email")).toBeInTheDocument();
  });

  it.each(["movie_fan_42", "fan@example.test"])(
    "signs in with %s and keeps the session in the header",
    async (login) => {
      const { scope, user } = await setup();
      await user.type(screen.getByLabelText("Имя пользователя или Email"), login);
      await user.type(screen.getByLabelText("Пароль", { selector: "input" }), "Kino#2026");
      await user.click(screen.getByRole("button", { name: "Показать пароль" }));
      expect(screen.getByLabelText("Пароль", { selector: "input" })).toHaveAttribute("type", "text");
      await user.click(screen.getByRole("button", { name: "Войти" }));

      expect(await screen.findByRole("button", { name: /Меню пользователя/ })).toBeInTheDocument();
      expect(scope.getState(router.$path)).toBe("/");
      expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
    },
  );

  it("shows a server error above the form and clears only the password", async () => {
    const { user } = await setup("/login", "login_invalid_email");
    await user.type(screen.getByLabelText("Имя пользователя или Email"), "movie_fan_42");
    await user.type(screen.getByLabelText("Пароль", { selector: "input" }), "wrong");
    await user.click(screen.getByRole("button", { name: "Войти" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Неверные имя пользователя или пароль");
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByLabelText("Имя пользователя или Email")).toHaveValue("movie_fan_42");
    expect(screen.getByLabelText("Пароль", { selector: "input" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Войти" })).toBeEnabled();
  });

  it("resends confirmation for the submitted login and starts the countdown", async () => {
    const { user } = await setup("/login", "login_email_not_confirmed");
    await user.type(screen.getByLabelText("Имя пользователя или Email"), "fan@example.test");
    await user.type(screen.getByLabelText("Пароль", { selector: "input" }), "Kino#2026");
    await user.click(screen.getByRole("button", { name: "Войти" }));
    const resend = await screen.findByRole("button", { name: "Отправить новую ссылку" });
    await user.click(resend);

    expect(await screen.findByRole("status")).toHaveTextContent("Письмо отправлено");
    expect(resend).toBeDisabled();
    expect(screen.getByText(/Можно отправить ещё раз через/)).toBeInTheDocument();
  });

  it("the header opens a dismissable dialog and restores focus", async () => {
    const { user, scope } = await setup("/");
    const trigger = screen.getByRole("button", { name: "Войти" });
    await user.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Вход в DejaView" })).toBeInTheDocument();
    expect(scope.getState(router.$path)).toBe("/");
    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it.each([
    ["Изображение", "image"],
    ["Видео", "video"],
    ["Аудио", "audio"],
  ])("%s resumes on the same page after modal sign-in", async (label, mode) => {
    const { scope, user } = await setup("/");
    await user.type(screen.getByLabelText("Опиши, что помнишь о фильме"), "Герой в поезде");
    await user.click(screen.getByRole("tab", { name: `${label}, после входа` }));
    const dialog = await screen.findByRole("dialog", { name: "Вход в DejaView" });
    expect(scope.getState(router.$path)).toBe("/");
    await user.type(within(dialog).getByLabelText("Имя пользователя или Email"), "movie_fan_42");
    await user.type(within(dialog).getByLabelText("Пароль", { selector: "input" }), "Kino#2026");
    await user.click(within(dialog).getByRole("button", { name: "Войти" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState($$home.$$search.outputs.$mode)).toBe(mode);
    expect(scope.getState($$home.$$search.outputs.$text)).toBe("Герой в поезде");
    expect(screen.getByRole("tab", { name: label })).toHaveAttribute("aria-selected", "true");
  });

  it("closing discards the pending action and reopening resets the password", async () => {
    const { scope, user } = await setup("/");
    const trigger = screen.getByRole("tab", { name: "Видео, после входа" });
    await user.click(trigger);
    await user.type(screen.getByLabelText("Пароль", { selector: "input" }), "not retained");
    await user.click(screen.getByRole("button", { name: "Закрыть окно входа" }));
    expect(scope.getState($$home.$$search.outputs.$pendingMode)).toBeNull();
    expect(scope.getState($$home.$$search.outputs.$mode)).toBe("text");

    await user.click(trigger);
    expect(screen.getByLabelText("Пароль", { selector: "input" })).toHaveValue("");
    expect(scope.getState($$session.outputs.$isLoginDialogOpened)).toBe(true);
  });

  it("Escape cancels a pending login even after the submit button becomes disabled", async () => {
    const held = createControlledTransport();
    const scope = fork({ handlers: [[transportFx, held.transport]] });
    const user = userEventSetup();
    await allSettled($$session.inputs.loginRequired, { scope, params: { path: "/", replace: false } });
    render(
      <Provider value={scope}>
        <RouterProvider router={router}>
          <BaseLayout>
            <div />
          </BaseLayout>
        </RouterProvider>
      </Provider>,
    );
    await user.type(screen.getByLabelText("Имя пользователя или Email"), "movie_fan_42");
    await user.type(screen.getByLabelText("Пароль", { selector: "input" }), "Kino#2026");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Войти" }));
    await held.waitForCalls(1);
    expect(screen.getByRole("dialog")).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(held.current().request.signal?.aborted).toBe(true);
  });
});
