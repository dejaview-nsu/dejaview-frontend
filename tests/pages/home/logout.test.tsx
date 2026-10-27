import { historyAdapter } from "@effector/router";
import { RouterProvider } from "@effector/router-react";
import { render, screen, waitFor } from "@testing-library/react";
import { allSettled, fork } from "effector";
import { Provider } from "effector-react";
import { createMemoryHistory } from "history";
import { describe, expect, it } from "vitest";

import { HomePage } from "@/pages/home";
import "@/pages/login/model";

import { BaseLayout } from "@/layouts/base";

import { $$session } from "@/entities/session";

import { transportFx } from "@/shared/api";
import { MOCK_STORAGE_KEYS } from "@/shared/api/mocks";
import { router } from "@/shared/routes";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";
import { createTestMockStorage, sessionInfo, setupMockApiScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const renderHome = (scope: ReturnType<typeof fork>) => {
  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <BaseLayout>
          <HomePage />
        </BaseLayout>
      </RouterProvider>
    </Provider>,
  );

  return userEventSetup();
};

describe("logout on the search page", () => {
  it.each([
    ["Изображение", "image"],
    ["Видео", "video"],
    ["Аудио", "audio"],
  ])("%s opens login again after logout", async (tab, mode) => {
    const storage = createTestMockStorage();
    storage.set(MOCK_STORAGE_KEYS.session, "authenticated");
    const { scope } = await setupMockApiScope({ storage });
    const user = renderHome(scope);

    await user.click(screen.getByRole("tab", { name: tab }));
    expect(scope.getState(router.$path)).toBe("/");
    expect(screen.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");

    await user.click(screen.getByRole("button", { name: /Меню пользователя/ }));
    await user.click(screen.getByRole("menuitem", { name: /Выйти/ }));

    await waitFor(() => expect(screen.getByRole("link", { name: "Войти" })).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Зарегистрироваться" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Меню пользователя/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Текст" })).toHaveAttribute("aria-selected", "true");
    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState(router.$query)).toEqual({});

    const reloaded = await setupMockApiScope({ storage });
    expect(reloaded.scope.getState($$session.outputs.$status)).toBe("guest");

    await user.click(screen.getByRole("tab", { name: `${tab}, после входа` }));

    expect(scope.getState(router.$path)).toBe("/login");
    expect(scope.getState(router.$query)).toEqual({ redirect: `/?mode=${mode}` });
  });

  it("disables the menu during logout and shows a retryable server error", async () => {
    const controlled = createControlledTransport();
    const scope = fork({ handlers: [[transportFx, controlled.transport]] });
    await allSettled($$session.inputs.sessionCreated, { scope, params: sessionInfo });
    await allSettled(router.setHistory, {
      scope,
      params: historyAdapter(createMemoryHistory({ initialEntries: ["/"] })),
    });
    const user = renderHome(scope);

    await user.click(screen.getByRole("button", { name: /Меню пользователя/ }));
    await user.click(screen.getByRole("menuitem", { name: /Выйти/ }));
    await controlled.waitForCalls(1);

    expect(screen.getByRole("button", { name: /Меню пользователя/ })).toBeDisabled();
    expect(screen.getByText("Выходим…")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    controlled.current().resolve(jsonResponse(500, { code: "INTERNAL_ERROR", message: "Попробуйте позже" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Попробуйте позже"));
    expect(screen.getByRole("button", { name: /Меню пользователя/ })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /Меню пользователя/ }));
    await user.click(screen.getByRole("menuitem", { name: /Выйти/ }));
    await controlled.waitForCalls(2);
    controlled.current().resolve(jsonResponse(204, ""));

    await waitFor(() => expect(screen.getByRole("link", { name: "Войти" })).toBeInTheDocument());
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
  });
});
