import { RouterProvider } from "@effector/router-react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { type Scope } from "effector";
import { Provider } from "effector-react";
import { afterEach, describe, expect, it } from "vitest";

import { Routing } from "@/pages";

import { $$session } from "@/entities/session";

import { type Transport } from "@/shared/api";
import { createMockTransport, MOCK_STORAGE_KEYS, type MockStorage, NO_MOCK_DELAYS } from "@/shared/api/mocks";
import { router } from "@/shared/routes";

import { createTestMockStorage, setupApiScope, setupMockApiScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const GENERAL = "Произошла ошибка. Попробуйте позже";

const renderApp = (scope: Scope) =>
  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <Routing />
      </RouterProvider>
    </Provider>,
  );

const signedInStorage = () => {
  const storage = createTestMockStorage();

  storage.set(MOCK_STORAGE_KEYS.session, "authenticated");

  return storage;
};

const openProfile = async (storage: MockStorage, initialEntry = "/profile") => {
  const { scope } = await act(() => setupMockApiScope({ initialEntry, storage }));

  renderApp(scope);

  return { scope, user: userEventSetup() };
};

const signOutDialog = () => within(screen.getByRole("alertdialog", { name: "Выход из профиля" }));

afterEach(() => sessionStorage.clear());

describe("profile sign out", () => {
  it.each(["/profile", "/profile?tab=ratings", "/profile?tab=security"])(
    "shows the bottom actions on %s",
    async (path) => {
      await openProfile(signedInStorage(), path);

      expect(await screen.findByRole("button", { name: "Выйти из профиля" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Удалить профиль" })).toBeInTheDocument();
    },
  );

  it("asks for confirmation and keeps the user signed in on «Нет»", async () => {
    const { scope, user } = await openProfile(signedInStorage());

    await user.click(await screen.findByRole("button", { name: "Выйти из профиля" }));

    expect(signOutDialog().getByText("Вы уверены, что хотите выйти из профиля?")).toBeInTheDocument();

    await user.click(signOutDialog().getByRole("button", { name: "Нет" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");

    await user.click(screen.getByRole("button", { name: "Выйти из профиля" }));
    await user.click(signOutDialog().getByRole("button", { name: "Закрыть окно выхода" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("signs out and opens the home page on «Да, выйти»", async () => {
    const storage = signedInStorage();
    const { scope, user } = await openProfile(storage);

    await user.click(await screen.findByRole("button", { name: "Выйти из профиля" }));
    await user.click(signOutDialog().getByRole("button", { name: "Да, выйти" }));

    await waitFor(() => expect(scope.getState(router.$path)).toBe("/"));
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(storage.get(MOCK_STORAGE_KEYS.session)).toBeNull();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("treats an expired session as a successful sign out", async () => {
    const storage = signedInStorage();
    storage.set(MOCK_STORAGE_KEYS.authScenario, "logout_session_expired");
    const { scope, user } = await openProfile(storage);

    await user.click(await screen.findByRole("button", { name: "Выйти из профиля" }));
    await user.click(signOutDialog().getByRole("button", { name: "Да, выйти" }));

    await waitFor(() => expect(scope.getState(router.$path)).toBe("/"));
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
  });

  it.each([
    "logout_rate_limited",
    "logout_server_error",
    "logout_network_error",
    "logout_timeout",
    "logout_invalid_response",
  ])("shows the %s error in the dialog and lets the user retry", async (scenario) => {
    const storage = signedInStorage();
    storage.set(MOCK_STORAGE_KEYS.authScenario, scenario);
    const { scope, user } = await openProfile(storage);

    await user.click(await screen.findByRole("button", { name: "Выйти из профиля" }));
    await user.click(signOutDialog().getByRole("button", { name: "Да, выйти" }));

    expect(await signOutDialog().findByRole("alert")).toHaveTextContent(GENERAL);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(scope.getState(router.$path)).toBe("/profile");
    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");

    storage.remove(MOCK_STORAGE_KEYS.authScenario);
    await user.click(signOutDialog().getByRole("button", { name: "Да, выйти" }));

    await waitFor(() => expect(scope.getState(router.$path)).toBe("/"));
  });

  it("keeps the dialog open and ignores repeated presses while signing out", async () => {
    const storage = signedInStorage();
    const mock = createMockTransport({ storage, delays: NO_MOCK_DELAYS });
    let logouts = 0;
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const transport: Transport = async (request) => {
      if (request.path === "/auth/logout") {
        logouts += 1;
        await gate;
      }

      return mock(request);
    };
    const { scope } = await act(() => setupApiScope({ initialEntry: "/profile", transport }));
    renderApp(scope);
    const user = userEventSetup();

    await user.click(await screen.findByRole("button", { name: "Выйти из профиля" }));
    await user.click(signOutDialog().getByRole("button", { name: "Да, выйти" }));

    const confirm = signOutDialog().getByRole("button", { name: "Да, выйти" });

    expect(confirm).toBeDisabled();
    expect(signOutDialog().getByRole("button", { name: "Нет" })).toBeDisabled();
    expect(signOutDialog().getByRole("button", { name: "Закрыть окно выхода" })).toBeDisabled();

    await user.click(confirm);
    await user.keyboard("{Escape}");

    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(logouts).toBe(1);

    await act(async () => release());

    await waitFor(() => expect(scope.getState(router.$path)).toBe("/"));
    expect(logouts).toBe(1);
  });
});

describe("profile features that are not ready yet", () => {
  it.each([
    ["ratings", "Мои оценки", "Оценки появятся в следующем обновлении"],
    ["reviews", "Мои отзывы", "Отзывы появятся в следующем обновлении"],
  ])("shows a placeholder on the %s tab without loading a list", async (tab, name, hint) => {
    const storage = signedInStorage();
    const mock = createMockTransport({ storage, delays: NO_MOCK_DELAYS });
    const paths: string[] = [];
    const transport: Transport = (request) => {
      paths.push(request.path);

      return mock(request);
    };
    const { scope } = await act(() => setupApiScope({ initialEntry: "/profile", transport }));
    renderApp(scope);
    const user = userEventSetup();

    await screen.findByRole("heading", { name: "Список пуст" });
    await user.click(screen.getByRole("tab", { name }));

    expect(scope.getState(router.$query)).toEqual({ tab });

    const panel = within(screen.getByRole("tabpanel"));

    expect(panel.getByRole("heading", { name: "Скоро будет готово" })).toBeInTheDocument();
    expect(panel.getByText(hint)).toBeInTheDocument();
    expect(paths.filter((path) => path.startsWith("/users/me/lists"))).toHaveLength(1);
  });

  it.each([["Изменить имя"], ["Изменить фото"], ["Удалить профиль"]])(
    "shows «Скоро будет готово» for «%s»",
    async (name) => {
      const { user } = await openProfile(signedInStorage());

      await screen.findByRole("heading", { level: 1, name: "movie_fan_42" });
      await user.click(screen.getByRole("button", { name }));

      expect(await screen.findByRole("status")).toHaveTextContent("Скоро будет готово");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    },
  );

  it("shows the delete photo button only when the account has a photo", async () => {
    const storage = signedInStorage();
    storage.set(MOCK_STORAGE_KEYS.sessionAvatar, "https://example.com/avatar.png");
    const { user } = await openProfile(storage);

    await screen.findByRole("heading", { level: 1, name: "movie_fan_42" });

    expect(screen.getByRole("img", { name: "Фото профиля movie_fan_42" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Удалить фото" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Скоро будет готово");
  });

  it("shows the photo overlay on mouse hover and keyboard focus, but not on touch", async () => {
    const storage = signedInStorage();
    storage.set(MOCK_STORAGE_KEYS.sessionAvatar, "https://example.com/avatar.png");
    const { user } = await openProfile(storage);

    await screen.findByRole("heading", { level: 1, name: "movie_fan_42" });

    const change = screen.getByRole("button", { name: "Изменить фото" });
    const avatar = change.parentElement as HTMLElement;

    expect(change).toHaveClass("opacity-0", "group-data-[hovered]:opacity-100", "data-[focus-visible]:opacity-100");
    expect(screen.getByRole("button", { name: "Удалить фото" })).toHaveClass("md:group-data-[hovered]:opacity-100");
    expect(avatar).not.toHaveAttribute("data-hovered");

    fireEvent.pointerEnter(avatar, { pointerType: "touch" });

    expect(avatar).not.toHaveAttribute("data-hovered");

    await user.hover(change);

    expect(avatar).toHaveAttribute("data-hovered", "true");

    await user.unhover(change);

    expect(avatar).not.toHaveAttribute("data-hovered");

    await user.keyboard("{Tab}");
    act(() => change.focus());

    expect(change).toHaveAttribute("data-focus-visible", "true");
  });

  it("hides the delete photo button without a photo", async () => {
    await openProfile(signedInStorage());

    await screen.findByRole("heading", { level: 1, name: "movie_fan_42" });

    expect(screen.queryByRole("button", { name: "Удалить фото" })).not.toBeInTheDocument();
  });
});
