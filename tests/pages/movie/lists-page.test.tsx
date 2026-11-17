import { RouterProvider } from "@effector/router-react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { allSettled, type Scope } from "effector";
import { Provider } from "effector-react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MoviePage } from "@/pages/movie";

import { BaseLayout } from "@/layouts/base";

import { $$session } from "@/entities/session";

import { type TransportResponse } from "@/shared/api";
import { createMockStorage, createMockTransport, MOCK_STORAGE_KEYS, NO_MOCK_DELAYS } from "@/shared/api/mocks";
import { router } from "@/shared/routes";

import { setupApiScope, setupMockApiScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const renderPage = (scope: Scope) =>
  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <BaseLayout>
          <MoviePage />
        </BaseLayout>
      </RouterProvider>
    </Provider>,
  );

const loginThroughDialog = async () => {
  const user = userEventSetup();
  const dialog = screen.getByRole("dialog", { name: "Вход в DejaView" });

  await user.type(within(dialog).getByLabelText("Имя пользователя или Email"), "movie_fan_42");
  await user.type(within(dialog).getByLabelText("Пароль", { exact: true }), "Password123!");
  await user.click(within(dialog).getByRole("button", { name: "Войти" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Вход в DejaView" })).toBeNull());
};

beforeEach(() => sessionStorage.clear());

describe("movie list controls", () => {
  it("adds and removes each list independently and reloads the saved state", async () => {
    const storage = createMockStorage(() => null);
    storage.set(MOCK_STORAGE_KEYS.session, "authenticated");
    const { scope } = await setupMockApiScope({ initialEntry: "/movies/157336", storage });
    renderPage(scope);
    const user = userEventSetup();
    const wantToWatch = screen.getByRole("checkbox", { name: "Хочу посмотреть" });
    const watched = screen.getByRole("checkbox", { name: "Просмотрено" });

    expect(wantToWatch).not.toBeChecked();
    expect(watched).not.toBeChecked();
    await user.click(wantToWatch);
    await waitFor(() => expect(wantToWatch).toBeChecked());
    expect(watched).not.toBeChecked();

    watched.focus();
    await user.keyboard(" ");
    await waitFor(() => expect(watched).toBeChecked());
    expect(wantToWatch).toBeChecked();

    await user.click(wantToWatch);
    await waitFor(() => expect(wantToWatch).not.toBeChecked());
    expect(watched).toBeChecked();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("Оценок пока нет")).toHaveTextContent("—");

    await act(() => allSettled(router.navigate, { scope, params: { path: "/movies/603" } }));
    expect(screen.getByRole("checkbox", { name: "Просмотрено" })).not.toBeChecked();
    await act(() => allSettled(router.navigate, { scope, params: { path: "/movies/157336" } }));
    expect(screen.getByRole("checkbox", { name: "Хочу посмотреть" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Просмотрено" })).toBeChecked();
  });

  it.each(["Хочу посмотреть", "Просмотрено"])(
    "logs a guest in and completes %s on the original movie page",
    async (name) => {
      const { scope } = await setupMockApiScope({ initialEntry: "/movies/157336?source=search" });
      renderPage(scope);

      await userEventSetup().click(screen.getByRole("checkbox", { name }));
      await loginThroughDialog();

      await waitFor(() => expect(screen.getByRole("checkbox", { name })).toBeChecked());
      expect(scope.getState(router.$path)).toBe("/movies/157336");
      expect(scope.getState(router.$query)).toEqual({ source: "search" });
      expect(screen.getByRole("heading", { name: "Интерстеллар", level: 1 })).toBeInTheDocument();
    },
  );

  it("cancels the requested addition when the guest dismisses login", async () => {
    const { scope } = await setupMockApiScope({ initialEntry: "/movies/157336" });
    renderPage(scope);
    const user = userEventSetup();

    await user.click(screen.getByRole("checkbox", { name: "Хочу посмотреть" }));
    await user.click(screen.getByRole("button", { name: "Закрыть окно входа" }));
    await act(() => allSettled($$session.inputs.loginPressed, { scope }));
    await loginThroughDialog();

    expect(screen.getByRole("checkbox", { name: "Хочу посмотреть" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Просмотрено" })).not.toBeChecked();
  });

  it("keeps the movie visible when membership cannot load and allows retry", async () => {
    const storage = createMockStorage(() => null);
    storage.set(MOCK_STORAGE_KEYS.session, "authenticated");
    storage.set(MOCK_STORAGE_KEYS.listScenario, "error");
    const { scope } = await setupMockApiScope({ initialEntry: "/movies/157336", storage });
    renderPage(scope);

    expect(screen.getByRole("heading", { name: "Интерстеллар", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Хочу посмотреть" })).toBeDisabled();
    storage.remove(MOCK_STORAGE_KEYS.listScenario);
    await userEventSetup().click(screen.getByRole("button", { name: "Повторить действие со списками" }));

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.getByRole("checkbox", { name: "Хочу посмотреть" })).toBeEnabled();
  });

  it("preserves the previous mark on save failure and retries the requested change", async () => {
    const storage = createMockStorage(() => null);
    storage.set(MOCK_STORAGE_KEYS.session, "authenticated");
    const { scope } = await setupMockApiScope({ initialEntry: "/movies/157336", storage });
    renderPage(scope);
    const wantToWatch = screen.getByRole("checkbox", { name: "Хочу посмотреть" });
    storage.set(MOCK_STORAGE_KEYS.listScenario, "error");

    await userEventSetup().click(wantToWatch);
    await screen.findByRole("alert");
    expect(wantToWatch).not.toBeChecked();
    storage.remove(MOCK_STORAGE_KEYS.listScenario);
    await userEventSetup().click(screen.getByRole("button", { name: "Повторить действие со списками" }));

    await waitFor(() => expect(wantToWatch).toBeChecked());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("blocks repeated toggles while saving without adding progress text", async () => {
    const storage = createMockStorage(() => null);
    storage.set(MOCK_STORAGE_KEYS.session, "authenticated");
    const mockTransport = createMockTransport({ storage, delays: NO_MOCK_DELAYS });
    let completeSave: (() => void) | undefined;
    const transport = vi.fn((request: Parameters<typeof mockTransport>[0]) =>
      request.method === "PUT"
        ? new Promise<TransportResponse>((resolve) => {
            completeSave = () => void mockTransport(request).then(resolve);
          })
        : mockTransport(request),
    );
    const { scope } = await setupApiScope({ initialEntry: "/movies/157336", transport });
    renderPage(scope);
    const user = userEventSetup();
    const wantToWatch = screen.getByRole("checkbox", { name: "Хочу посмотреть" });

    await user.click(wantToWatch);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("group", { name: "Мои списки" })).toHaveAttribute("aria-busy", "true");
    expect(wantToWatch).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Просмотрено" })).toBeDisabled();
    await user.click(wantToWatch);
    expect(transport.mock.calls.filter(([request]) => request.method === "PUT")).toHaveLength(1);

    await act(async () => completeSave?.());
    await waitFor(() => expect(wantToWatch).toBeChecked());
    expect(wantToWatch).toBeEnabled();
    expect(screen.getByRole("group", { name: "Мои списки" })).toHaveAttribute("aria-busy", "false");
  });
});
