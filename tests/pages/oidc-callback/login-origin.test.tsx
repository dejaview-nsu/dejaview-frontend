import { RouterProvider } from "@effector/router-react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { allSettled } from "effector";
import { Provider } from "effector-react";
import { afterEach, describe, expect, it } from "vitest";

import { Routing } from "@/pages";

import { saveOidcOrigin, saveOidcReturnPath } from "@/features/oidc-sign-in";

import { MOCK_STORAGE_KEYS } from "@/shared/api/mocks";
import { router } from "@/shared/routes";

import { createTestMockStorage, setupMockApiScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const failedText = (provider: string) =>
  `Не удалось выполнить вход через ${provider}. Попробуйте снова или используйте другой способ`;

const open = async (path: string, scenario?: string) => {
  const storage = createTestMockStorage();

  if (scenario) storage.set(MOCK_STORAGE_KEYS.authScenario, scenario);

  const { scope } = await act(() => setupMockApiScope({ initialEntry: path, storage }));

  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <Routing />
      </RouterProvider>
    </Provider>,
  );

  return { scope, user: userEventSetup() };
};

const returnFromProvider = (scope: Awaited<ReturnType<typeof open>>["scope"], provider: string, result: string) =>
  act(() => allSettled(router.navigate, { scope, params: { path: "/auth/oidc", query: { provider, result } } }));

afterEach(() => {
  sessionStorage.clear();
});

describe("OIDC failure after a sign-in started on the login form", () => {
  it("result=error opens the login form with the provider message and keeps the return page", async () => {
    saveOidcOrigin("login");
    saveOidcReturnPath("/movies/603");

    const { scope } = await open("/auth/oidc?provider=google&result=error");

    await waitFor(() => expect(scope.getState(router.$path)).toBe("/login"));
    expect(scope.getState(router.$query)).toEqual({ redirect: "/movies/603" });
    expect(screen.getByRole("region", { name: "Вход в DejaView" })).toBeInTheDocument();
    expect(screen.getByText(failedText("Google"))).toBeInTheDocument();
    expect(sessionStorage.getItem("dejaview:oidc-origin")).toBeNull();
    expect(sessionStorage.getItem("dejaview:oidc-return-path")).toBeNull();
  });

  it("a sign-in started from the home page returns to /login without a redirect", async () => {
    saveOidcOrigin("login");
    saveOidcReturnPath("/");

    const { scope } = await open("/auth/oidc?provider=vk&result=error");

    await waitFor(() => expect(scope.getState(router.$path)).toBe("/login"));
    expect(scope.getState(router.$query)).toEqual({});
    expect(screen.getByText(failedText("VK"))).toBeInTheDocument();
  });

  it("an expired pending sign-in returns to the login form", async () => {
    saveOidcOrigin("login");

    const { scope } = await open("/auth/oidc?provider=yandex&result=registration_required", "oidc_pending_expired");

    await waitFor(() => expect(scope.getState(router.$path)).toBe("/login"));
    expect(screen.getByText(failedText("Яндекс"))).toBeInTheDocument();
  });

  it("the dialog button, a provider refusal and the login form work as one flow", async () => {
    const { scope, user } = await open("/movies/603");

    await user.click(screen.getByRole("button", { name: "Войти" }));

    const google = within(await screen.findByRole("dialog")).getByRole("link", { name: "Продолжить с Google" });

    google.addEventListener("click", (event) => event.preventDefault());
    await user.click(google);
    await returnFromProvider(scope, "google", "error");

    await waitFor(() => expect(scope.getState(router.$path)).toBe("/login"));
    expect(scope.getState(router.$query)).toEqual({ redirect: "/movies/603" });
    expect(screen.getByText(failedText("Google"))).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const form = within(screen.getByRole("region", { name: "Вход в DejaView" }));

    expect(form.getByRole("button", { name: "Войти" })).toBeEnabled();
    expect(form.getByRole("link", { name: "Продолжить с Google" })).not.toHaveAttribute("aria-disabled");
  });

  it("a sign-in started on the registration form still returns to registration", async () => {
    const { scope, user } = await open("/register");

    const yandex = screen.getByRole("link", { name: "Продолжить с Яндекс" });

    yandex.addEventListener("click", (event) => event.preventDefault());
    await user.click(yandex);
    await returnFromProvider(scope, "yandex", "error");

    await waitFor(() => expect(scope.getState(router.$path)).toBe("/register"));
    expect(screen.getByText(failedText("Яндекс"))).toBeInTheDocument();
  });
});
