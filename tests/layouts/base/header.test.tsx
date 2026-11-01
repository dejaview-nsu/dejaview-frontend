import { historyAdapter } from "@effector/router";
import { RouterProvider } from "@effector/router-react";
import { render, screen } from "@testing-library/react";
import { allSettled, fork, type Scope } from "effector";
import { Provider } from "effector-react";
import { createMemoryHistory } from "history";
import { describe, expect, it } from "vitest";

import { BaseLayout } from "@/layouts/base";

import { $$session } from "@/entities/session";

import { router } from "@/shared/routes";

import { setupSessionScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const pages = [
  ["home", "/"],
  ["standard", "/about"],
] as const;

const renderLayout = (scope: Scope) =>
  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <BaseLayout>
          <div />
        </BaseLayout>
      </RouterProvider>
    </Provider>,
  );

describe("base layout header", () => {
  it.each(pages)("%s header shows no account controls until the session is known", async (_name, path) => {
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: historyAdapter(createMemoryHistory({ initialEntries: [path] })),
    });
    renderLayout(scope);

    expect(scope.getState($$session.outputs.$status)).toBe("unknown");
    expect(screen.queryByRole("button", { name: "Войти" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Зарегистрироваться" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Меню пользователя/ })).not.toBeInTheDocument();
  });

  it.each(pages)("%s header shows login and registration links to a guest", async (_name, path) => {
    const { scope } = await setupSessionScope({ initialEntry: path });
    renderLayout(scope);

    expect(screen.getByRole("button", { name: "Войти" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "Зарегистрироваться" })).toHaveAttribute("href", "/register");
    expect(screen.queryByRole("button", { name: /Меню пользователя/ })).not.toBeInTheDocument();
  });

  it.each(pages)("%s header shows the avatar menu to a signed in user", async (_name, path) => {
    const { scope } = await setupSessionScope({ initialEntry: path, authenticated: true });
    renderLayout(scope);

    const trigger = screen.getByRole("button", { name: "Меню пользователя movie_fan_42" });
    expect(trigger).toHaveTextContent("MO");
    expect(screen.queryByRole("button", { name: "Войти" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Зарегистрироваться" })).not.toBeInTheDocument();

    await userEventSetup().click(trigger);

    expect(screen.getByRole("menuitem", { name: /Профиль/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Выйти/ })).toBeInTheDocument();
  });
});
