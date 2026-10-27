import { RouterProvider } from "@effector/router-react";
import { render, screen } from "@testing-library/react";
import { allSettled } from "effector";
import { Provider } from "effector-react";
import { describe, expect, it } from "vitest";

import { $$home, HomePage } from "@/pages/home";
import "@/pages/login/model";

import { BaseLayout } from "@/layouts/base";

import { $$session } from "@/entities/session";

import { router } from "@/shared/routes";

import { setupSessionScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

describe("search page UI", () => {
  it("guest sees text mode and media selection opens login while preserving text", async () => {
    const { scope } = await setupSessionScope();
    render(
      <Provider value={scope}>
        <RouterProvider router={router}>
          <HomePage />
        </RouterProvider>
      </Provider>,
    );
    const user = userEventSetup();
    await user.type(screen.getByLabelText("Опиши, что помнишь о фильме"), "Сцена из фильма");
    expect(screen.getByRole("button", { name: "Начать поиск" })).toBeEnabled();
    await user.click(screen.getByRole("tab", { name: /Изображение/ }));
    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState($$session.outputs.$loginDialogPath)).toBe("/?mode=image");
    await allSettled($$session.inputs.signedIn, { scope, params: { login: "movie_fan_42", password: "Kino#2026" } });
    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState($$home.$$search.outputs.$text)).toBe("Сцена из фильма");
  });
  it("clears the description and updates the character counter", async () => {
    const { scope } = await setupSessionScope();
    render(
      <Provider value={scope}>
        <RouterProvider router={router}>
          <HomePage />
        </RouterProvider>
      </Provider>,
    );
    const user = userEventSetup();
    const input = screen.getByLabelText("Опиши, что помнишь о фильме");
    await user.type(input, "Сцена");
    expect(screen.getByText("5/250")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Очистить описание" }));
    expect(input).toHaveValue("");
    expect(screen.getByText("0/250")).toBeInTheDocument();
    expect(scope.getState($$home.$$search.outputs.$text)).toBe("");
  });
  it("the account menu supports keyboard navigation and logout", async () => {
    const { scope } = await setupSessionScope({ authenticated: true });
    render(
      <Provider value={scope}>
        <RouterProvider router={router}>
          <BaseLayout>
            <HomePage />
          </BaseLayout>
        </RouterProvider>
      </Provider>,
    );
    const user = userEventSetup();
    await user.click(screen.getByRole("button", { name: /Меню пользователя/ }));
    expect(screen.getByRole("menu")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: /Профиль/ })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: /Выйти/ })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Войти" })).toBeInTheDocument();
  });
  it("only selected input is visible; drafts survive mode switches", async () => {
    const { scope } = await setupSessionScope({ authenticated: true });
    render(
      <Provider value={scope}>
        <RouterProvider router={router}>
          <HomePage />
        </RouterProvider>
      </Provider>,
    );
    const user = userEventSetup();
    await user.type(screen.getByLabelText("Опиши, что помнишь о фильме"), "Герой в поезде");
    await user.click(screen.getByRole("tab", { name: "Изображение" }));
    expect(screen.getByRole("tab", { name: "Изображение" })).toHaveAttribute(
      "aria-controls",
      screen.getByRole("tabpanel").id,
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.upload(
      screen.getByLabelText("Выберите изображение"),
      new File(["image"], "frame.png", { type: "image/png" }),
    );
    await user.click(screen.getByRole("tab", { name: "Видео" }));
    expect(screen.queryByLabelText("Выберите изображение")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Изображение" }));
    expect(screen.getByText(/frame.png/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Текст" }));
    expect(screen.getByRole("textbox")).toHaveValue("Герой в поезде");
    await user.click(screen.getByRole("tab", { name: "Аудио" }));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Выберите аудиофрагмент")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Записать с микрофона" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Начать поиск" })).toBeEnabled();
  });
});
