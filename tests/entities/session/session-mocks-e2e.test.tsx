import { RouterProvider } from "@effector/router-react";
import { render, screen, waitFor } from "@testing-library/react";
import { invoke } from "@withease/factories";
import { allSettled, scopeBind } from "effector";
import { Provider } from "effector-react";
import { describe, expect, it } from "vitest";

import { $$login, $$loginRoute } from "@/pages/login/model";
import { $$profile } from "@/pages/profile/model";
import { $$register } from "@/pages/register/model";

import { BaseLayout } from "@/layouts/base";

import { $$session } from "@/entities/session";

import { createFileSearchFactory } from "@/shared/api";
import { MOCK_STORAGE_KEYS } from "@/shared/api/mocks";
import { router, routes } from "@/shared/routes";

import { createTestMockStorage, setupMockApiScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

describe("session on mock transport", () => {
  it("guest → /profile → login → /profile → sign out → home", async () => {
    const { scope } = await setupMockApiScope();

    expect(scope.getState($$session.outputs.$status)).toBe("guest");

    await allSettled(routes.profile.open, { scope, params: undefined });

    expect(scope.getState(router.$path)).toBe("/login");
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile" });
    expect(scope.getState($$loginRoute.outputs.readyRoute.$isOpened)).toBe(true);

    await allSettled($$login.inputs.stubLoginPressed, { scope });

    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
    expect(scope.getState($$session.outputs.$user)?.username).toBe("movie_fan_42");
    expect(scope.getState(router.$path)).toBe("/profile");
    expect(scope.getState($$profile.outputs.readyRoute.$isOpened)).toBe(true);

    render(
      <Provider value={scope}>
        <RouterProvider router={router}>
          <BaseLayout>
            <div />
          </BaseLayout>
        </RouterProvider>
      </Provider>,
    );

    expect(screen.getByText("Профиль")).toBeInTheDocument();
    expect(screen.queryByText("Войти")).not.toBeInTheDocument();

    await userEventSetup().click(screen.getByRole("button", { name: "Выйти" }));

    await waitFor(() => expect(screen.getByText("Войти")).toBeInTheDocument());
    expect(screen.getByText("Зарегистрироваться")).toBeInTheDocument();
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState(router.$path)).toBe("/");
  });

  it.each([
    ["login", routes.login],
    ["register", routes.register],
  ])("signed in user opening /%s goes home", async (_name, route) => {
    const storage = createTestMockStorage();
    storage.set(MOCK_STORAGE_KEYS.session, "authenticated");
    const { scope } = await setupMockApiScope({ initialEntry: "/about", storage });

    await allSettled(route.open, { scope, params: undefined });

    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState($$loginRoute.outputs.readyRoute.$isOpened)).toBe(false);
    expect(scope.getState($$register.outputs.readyRoute.$isOpened)).toBe(false);
  });

  it("stays signed in after reload", async () => {
    const storage = createTestMockStorage();
    const first = await setupMockApiScope({ initialEntry: "/login", storage });

    await allSettled($$login.inputs.stubLoginPressed, { scope: first.scope });
    expect(first.scope.getState($$session.outputs.$status)).toBe("authenticated");

    const reloaded = await setupMockApiScope({ initialEntry: "/profile", storage });

    expect(reloaded.scope.getState($$session.outputs.$status)).toBe("authenticated");
    expect(reloaded.scope.getState(router.$path)).toBe("/profile");
  });

  it("SESSION_EXPIRED scenario makes the user a guest", async () => {
    const storage = createTestMockStorage();
    storage.set(MOCK_STORAGE_KEYS.session, "authenticated");
    storage.set(MOCK_STORAGE_KEYS.searchScenario, "SESSION_EXPIRED");
    const { scope } = await setupMockApiScope({ initialEntry: "/about", storage });
    const $$search = invoke(createFileSearchFactory, { mode: "video" });

    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");

    scopeBind($$search.inputs.started, { scope })(new File(["video"], "scene.mp4", { type: "video/mp4" }));
    await allSettled(scope);

    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState(router.$path)).toBe("/login");
    expect(scope.getState(router.$query)).toEqual({ redirect: "/about" });
    expect(scope.getState($$search.outputs.$error)).toBeNull();

    const reloaded = await setupMockApiScope({ storage });

    expect(reloaded.scope.getState($$session.outputs.$status)).toBe("guest");
  });
});
