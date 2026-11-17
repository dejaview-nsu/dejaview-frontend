import { RouterProvider } from "@effector/router-react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { allSettled, type Scope } from "effector";
import { Provider } from "effector-react";
import { afterEach, describe, expect, it } from "vitest";

import { Routing } from "@/pages";

import { $$movieListIntent } from "@/features/movie-lists";

import { MOCK_STORAGE_KEYS } from "@/shared/api/mocks";
import { router } from "@/shared/routes";

import { createTestMockStorage, setupMockApiScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const renderApp = (scope: Scope) =>
  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <Routing />
      </RouterProvider>
    </Provider>,
  );

const begin = async () => {
  const storage = createTestMockStorage();
  const { scope } = await act(() => setupMockApiScope({ initialEntry: "/movies/603?from=search", storage }));
  const view = renderApp(scope);
  const user = userEventSetup();

  await user.click(screen.getByRole("checkbox", { name: "Хочу посмотреть" }));

  return { scope, storage, view, user };
};

afterEach(() => sessionStorage.clear());

describe("movie list continuation through authentication pages", () => {
  it("keeps the movie when switching from the login dialog to registration and back to login", async () => {
    const { scope, user } = await begin();

    await user.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Зарегистрироваться" }));
    await screen.findByRole("heading", { name: "Создать аккаунт" });
    await user.click(within(screen.getByRole("main")).getByRole("link", { name: "Войти" }));

    const form = within(await screen.findByRole("region", { name: "Вход в DejaView" }));

    await user.type(form.getByLabelText("Имя пользователя или Email"), "movie_fan_42");
    await user.type(form.getByLabelText("Пароль", { exact: true }), "Password123!");
    await user.click(form.getByRole("button", { name: "Войти" }));

    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Хочу посмотреть" })).toBeChecked());
    expect(scope.getState(router.$path)).toBe("/movies/603");
    expect(scope.getState(router.$query)).toEqual({ from: "search" });
    expect(scope.getState($$movieListIntent.outputs.$intent)).toBeNull();
  });

  it("restores the action after an OIDC browser reload", async () => {
    const { storage, view, user } = await begin();
    const provider = within(screen.getByRole("dialog")).getByRole("link", { name: "Продолжить с Google" });

    provider.addEventListener("click", (event) => event.preventDefault());
    await user.click(provider);
    view.unmount();
    storage.set(MOCK_STORAGE_KEYS.session, "authenticated");

    const { scope } = await act(() =>
      setupMockApiScope({ initialEntry: "/auth/oidc?provider=google&result=success", storage }),
    );

    renderApp(scope);

    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Хочу посмотреть" })).toBeChecked());
    expect(scope.getState(router.$path)).toBe("/movies/603");
    expect(scope.getState(router.$query)).toEqual({ from: "search" });
    expect(scope.getState($$movieListIntent.outputs.$intent)).toBeNull();
  });

  it("returns from email confirmation after reloading the tab and completes the action", async () => {
    const { storage, view, user } = await begin();

    await user.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Зарегистрироваться" }));
    await screen.findByRole("heading", { name: "Создать аккаунт" });
    view.unmount();

    const { scope } = await act(() => setupMockApiScope({ initialEntry: "/confirm-email?token=email-token", storage }));

    renderApp(scope);

    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Хочу посмотреть" })).toBeChecked());
    expect(scope.getState(router.$path)).toBe("/movies/603");
    expect(scope.getState(router.$query)).toEqual({ from: "search" });
    expect(scope.getState($$movieListIntent.outputs.$intent)).toBeNull();
  });

  it("an OIDC registration refusal retains the movie through registration and another attempt", async () => {
    const { scope, user } = await begin();

    await user.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Зарегистрироваться" }));
    await screen.findByRole("heading", { name: "Создать аккаунт" });

    const provider = screen.getByRole("link", { name: "Продолжить с Google" });

    provider.addEventListener("click", (event) => event.preventDefault());
    await user.click(provider);
    await act(() =>
      allSettled(router.navigate, {
        scope,
        params: { path: "/auth/oidc", query: { provider: "google", result: "error" } },
      }),
    );

    await screen.findByRole("heading", { name: "Создать аккаунт" });
    expect(scope.getState(router.$query)).toEqual({ redirect: "/movies/603?from=search" });
    expect(scope.getState($$movieListIntent.outputs.$intent)).toEqual({
      movieId: "603",
      list: "want_to_watch",
      selected: true,
    });
  });

  it("leaving registration for another page cancels the return and the pending addition", async () => {
    const { scope, storage, view, user } = await begin();

    await user.click(within(screen.getByRole("dialog")).getByRole("link", { name: "Зарегистрироваться" }));
    await screen.findByRole("heading", { name: "Создать аккаунт" });
    await act(() => allSettled(router.navigate, { scope, params: { path: "/about", query: {} } }));
    view.unmount();

    const reloaded = await act(() => setupMockApiScope({ initialEntry: "/confirm-email?token=email-token", storage }));

    expect(reloaded.scope.getState(router.$path)).toBe("/");
    expect(reloaded.scope.getState($$movieListIntent.outputs.$intent)).toBeNull();
  });
});
