import { RouterProvider } from "@effector/router-react";
import { act, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "effector-react";
import { afterEach, describe, expect, it } from "vitest";

import { Routing } from "@/pages";
import { $$home } from "@/pages/home";

import { MOCK_STORAGE_KEYS } from "@/shared/api/mocks";
import { router } from "@/shared/routes";

import { createTestMockStorage, setupMockApiScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const RETURN_PATH_KEY = "dejaview:oidc-return-path";

const open = async (path: string, { scenario, signedIn = false }: { scenario?: string; signedIn?: boolean } = {}) => {
  const storage = createTestMockStorage();

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

  return { scope, user: userEventSetup() };
};

afterEach(() => {
  sessionStorage.clear();
});

describe("search mode around the OIDC redirect", () => {
  it("a guest who picks video and goes to OIDC from the registration page saves the mode in the return path", async () => {
    const { scope, user } = await open("/");

    await user.click(screen.getByRole("tab", { name: "Видео, после входа" }));
    await waitFor(() => expect(scope.getState(router.$path)).toBe("/login"));

    expect(scope.getState(router.$query)).toEqual({ redirect: "/?mode=video" });

    await user.click(screen.getByRole("link", { name: "Зарегистрироваться" }));
    await waitFor(() => expect(scope.getState(router.$path)).toBe("/register"));

    const google = await screen.findByRole("link", { name: "Продолжить с Google" });

    google.addEventListener("click", (event) => event.preventDefault());
    await user.click(google);

    expect(sessionStorage.getItem(RETURN_PATH_KEY)).toBe("/?mode=video");
  });

  it("a successful OIDC sign-in returns to the saved mode and removes it from the address", async () => {
    sessionStorage.setItem(RETURN_PATH_KEY, "/?mode=video");

    const { scope } = await open("/auth/oidc?provider=google&result=success", { signedIn: true });

    await waitFor(() => expect(scope.getState(router.$path)).toBe("/"));

    expect(scope.getState(router.$query)).toEqual({});
    expect(scope.getState($$home.$$search.outputs.$mode)).toBe("video");
    expect(await screen.findByRole("tab", { name: "Видео" })).toHaveAttribute("aria-selected", "true");
    expect(sessionStorage.getItem(RETURN_PATH_KEY)).toBeNull();
  });

  it("an OIDC registration returns to the saved mode", async () => {
    sessionStorage.setItem(RETURN_PATH_KEY, "/?mode=image");

    const { scope, user } = await open("/auth/oidc?provider=yandex&result=registration_required", {
      scenario: "oidc_pending_registration,oidc_complete_ok",
    });

    await user.type(screen.getByLabelText("Год рождения", { selector: "input" }), "1998");
    await user.click(screen.getByRole("button", { name: "Продолжить" }));

    await waitFor(() => expect(scope.getState(router.$path)).toBe("/"));

    expect(scope.getState(router.$query)).toEqual({});
    expect(scope.getState($$home.$$search.outputs.$mode)).toBe("image");
  });

  it("a sign-in without a saved mode opens the home page in the text mode", async () => {
    sessionStorage.setItem(RETURN_PATH_KEY, "/");

    const { scope } = await open("/auth/oidc?provider=google&result=success", { signedIn: true });

    await waitFor(() => expect(scope.getState(router.$path)).toBe("/"));

    expect(scope.getState(router.$query)).toEqual({});
    expect(scope.getState($$home.$$search.outputs.$mode)).toBe("text");
  });

  it("an unknown mode in the address is ignored", async () => {
    const { scope } = await open("/?mode=smell", { signedIn: true });

    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState($$home.$$search.outputs.$mode)).toBe("text");
  });
});
