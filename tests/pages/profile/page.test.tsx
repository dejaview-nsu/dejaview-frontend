import { RouterProvider } from "@effector/router-react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { allSettled, type Scope } from "effector";
import { Provider } from "effector-react";
import { afterEach, describe, expect, it } from "vitest";

import { Routing } from "@/pages";

import { type Transport, type TransportRequest } from "@/shared/api";
import { createMockTransport, MOCK_STORAGE_KEYS, type MockStorage, NO_MOCK_DELAYS } from "@/shared/api/mocks";
import { router } from "@/shared/routes";

import { createTestMockStorage, setupApiScope, setupMockApiScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

type Lists = { want_to_watch: number[]; watched: number[] };

const renderApp = (scope: Scope) =>
  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <Routing />
      </RouterProvider>
    </Provider>,
  );

const signedInStorage = (lists?: Lists) => {
  const storage = createTestMockStorage();

  storage.set(MOCK_STORAGE_KEYS.session, "authenticated");

  if (lists) storage.set(`${MOCK_STORAGE_KEYS.lists}:movie_fan_42`, JSON.stringify(lists));

  return storage;
};

const openProfile = async (storage: MockStorage, initialEntry = "/profile") => {
  const { scope } = await act(() => setupMockApiScope({ initialEntry, storage }));

  renderApp(scope);

  return { scope, user: userEventSetup() };
};

const createGatedTransport = (storage: MockStorage, respond?: (request: TransportRequest) => Promise<unknown>) => {
  const mock = createMockTransport({ storage, delays: NO_MOCK_DELAYS });
  const deletes: TransportRequest[] = [];
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));

  const transport: Transport = async (request) => {
    if (request.method === "DELETE") {
      deletes.push(request);
      await gate;
      if (respond) await respond(request);
    }

    return mock(request);
  };

  return { transport, deletes, release: () => release() };
};

const statValue = (label: string) => screen.getByText(label, { selector: "dt" }).nextElementSibling;

const movieTitles = () =>
  within(screen.getByRole("tabpanel"))
    .queryAllByRole("heading", { level: 3 })
    .map((heading) => heading.textContent);

afterEach(() => sessionStorage.clear());

describe("profile page", () => {
  it("sends a guest to login and back to the profile tab after signing in", async () => {
    const { scope, user } = await openProfile(createTestMockStorage(), "/profile?tab=watched");

    expect(scope.getState(router.$path)).toBe("/login");
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile?tab=watched" });

    const form = within(await screen.findByRole("region", { name: "Вход в DejaView" }));

    await user.type(form.getByLabelText("Имя пользователя или Email"), "movie_fan_42");
    await user.type(form.getByLabelText("Пароль", { exact: true }), "Password123!");
    await user.click(form.getByRole("button", { name: "Войти" }));

    expect(await screen.findByRole("heading", { level: 1, name: "movie_fan_42" })).toBeInTheDocument();
    expect(scope.getState(router.$path)).toBe("/profile");
    expect(screen.getByRole("tab", { name: "Просмотрено" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows the name, dates and statistics of the profile", async () => {
    await openProfile(signedInStorage({ want_to_watch: [603], watched: [157336, 603, 423] }));

    expect(await screen.findByRole("heading", { level: 1, name: "movie_fan_42" })).toBeInTheDocument();
    expect(screen.getByText("Дата регистрации: 14.09.2026")).toBeInTheDocument();
    expect(screen.getByText("Год рождения: 2001")).toBeInTheDocument();
    expect(statValue("Просмотрено")).toHaveTextContent("3");
    expect(statValue("Оценок")).toHaveTextContent("0");
    expect(statValue("Отзывов")).toHaveTextContent("0");
    expect(screen.getByLabelText("Оценок пока нет")).toHaveTextContent("—");
    expect(screen.getByRole("button", { name: "Изменить имя" })).toBeInTheDocument();
  });

  it("shows the average rating with one digit after a comma", async () => {
    const storage = signedInStorage();
    storage.set(MOCK_STORAGE_KEYS.profileScenario, "rated");
    await openProfile(storage);

    await screen.findByRole("heading", { level: 1, name: "movie_fan_42" });

    expect(statValue("Средняя оценка")).toHaveTextContent("7,8");
    expect(statValue("Оценок")).toHaveTextContent("38");
    expect(statValue("Отзывов")).toHaveTextContent("12");
  });

  it("shows the user icon when the account has no photo", async () => {
    await openProfile(signedInStorage());

    await screen.findByRole("heading", { level: 1, name: "movie_fan_42" });

    expect(screen.queryByRole("img", { name: /Фото профиля/ })).not.toBeInTheDocument();
  });

  it("retries a failed profile load", async () => {
    const storage = signedInStorage();
    storage.set(MOCK_STORAGE_KEYS.profileScenario, "error");
    const { user } = await openProfile(storage);

    expect(await screen.findByText("Произошла ошибка. Попробуйте позже")).toBeInTheDocument();

    storage.remove(MOCK_STORAGE_KEYS.profileScenario);
    await user.click(screen.getByRole("button", { name: "Повторить загрузку профиля" }));

    expect(await screen.findByRole("heading", { level: 1, name: "movie_fan_42" })).toBeInTheDocument();
  });

  it.each(["error", "RATE_LIMITED", "INVALID_RESPONSE", "NETWORK_ERROR", "TIMEOUT"])(
    "shows the general error in the header for the %s profile scenario",
    async (scenario) => {
      const storage = signedInStorage();
      storage.set(MOCK_STORAGE_KEYS.profileScenario, scenario);
      await openProfile(storage);

      const header = await screen.findByRole("alert");

      expect(header).toHaveTextContent("Произошла ошибка. Попробуйте позже");
      expect(within(header).getByRole("button", { name: "Повторить загрузку профиля" })).toBeInTheDocument();
    },
  );

  it("sends the user to login when the session expires while loading the profile", async () => {
    const storage = signedInStorage();
    storage.set(MOCK_STORAGE_KEYS.profileScenario, "SESSION_EXPIRED");
    const { scope } = await openProfile(storage, "/profile?tab=watched");

    await waitFor(() => expect(scope.getState(router.$path)).toBe("/login"));
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile?tab=watched" });
  });

  it("shows the five profile tabs and keeps the selected list tab in the address", async () => {
    const { scope, user } = await openProfile(signedInStorage({ want_to_watch: [603, 157336], watched: [423] }));

    const tabs = await screen.findAllByRole("tab");

    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Хочу посмотреть",
      "Просмотрено",
      "Мои оценки",
      "Мои отзывы",
      "Безопасность",
    ]);
    expect(screen.getByRole("tab", { name: "Хочу посмотреть" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(movieTitles()).toEqual(["Интерстеллар", "Матрица"]));

    await user.click(screen.getByRole("tab", { name: "Просмотрено" }));

    expect(scope.getState(router.$query)).toEqual({ tab: "watched" });
    expect(screen.getByRole("tab", { name: "Просмотрено" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(movieTitles()).toHaveLength(1));

    await act(() => allSettled(router.back, { scope }));

    expect(scope.getState(router.$query)).toEqual({});
    expect(screen.getByRole("tab", { name: "Хочу посмотреть" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(movieTitles()).toEqual(["Интерстеллар", "Матрица"]));
  });

  it("opens the tab from the address", async () => {
    await openProfile(signedInStorage({ want_to_watch: [], watched: [603] }), "/profile?tab=watched");

    expect(await screen.findByRole("tab", { name: "Просмотрено" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(movieTitles()).toEqual(["Матрица"]));
  });

  it("normalizes an unknown tab without adding a history entry", async () => {
    const { scope } = await openProfile(signedInStorage(), "/profile?tab=lists");

    await waitFor(() => expect(scope.getState(router.$query)).toEqual({}));
    expect(scope.getState(router.$history)?.location.search).toBe("");
    expect(screen.getByRole("tab", { name: "Хочу посмотреть" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows movie tiles with ratings, links and a remove button", async () => {
    const storage = signedInStorage({ want_to_watch: [], watched: [603] });
    storage.set(MOCK_STORAGE_KEYS.listScenario, "demo");
    await openProfile(storage, "/profile?tab=watched");

    const panel = within(await screen.findByRole("tabpanel"));
    const title = await panel.findByRole("link", { name: "Матрица" });

    expect(title).toHaveAttribute("href", "/movies/603");
    expect(panel.getByText(/Общая оценка:/)).toHaveTextContent("Общая оценка: 6,3");
    expect(panel.getByText(/Ваша оценка:/)).toHaveTextContent("Ваша оценка: –");
    expect(panel.getByRole("button", { name: "Удалить «Матрица» из списка" })).toHaveTextContent("Удалить");
    expect(panel.queryByRole("button", { name: /Оценить|Изменить/ })).not.toBeInTheDocument();
  });

  it.each([
    ["/profile", "Добавляй фильмы кнопкой «Хочу посмотреть» на странице фильма"],
    ["/profile?tab=watched", "Добавляй фильмы кнопкой «Просмотрено» на странице фильма"],
  ])("shows the empty state on %s", async (path, hint) => {
    await openProfile(signedInStorage(), path);

    expect(await screen.findByRole("heading", { name: "Список пуст" })).toBeInTheDocument();
    expect(screen.getByText(hint)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Найти фильм" })).toHaveAttribute("href", "/");
  });

  it("retries a failed list load", async () => {
    const storage = signedInStorage({ want_to_watch: [603], watched: [] });
    storage.set(MOCK_STORAGE_KEYS.listScenario, "error");
    const { user } = await openProfile(storage);

    expect(await screen.findByText("Произошла ошибка. Попробуйте позже")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "movie_fan_42" })).toBeInTheDocument();

    storage.remove(MOCK_STORAGE_KEYS.listScenario);
    await user.click(screen.getByRole("button", { name: "Повторить загрузку списка" }));

    await waitFor(() => expect(movieTitles()).toEqual(["Матрица"]));
  });
});

describe("profile list loading errors", () => {
  it.each(["error", "RATE_LIMITED", "INVALID_RESPONSE", "NETWORK_ERROR", "TIMEOUT"])(
    "shows the general error with a retry button for the %s list scenario",
    async (scenario) => {
      const storage = signedInStorage({ want_to_watch: [603], watched: [] });
      storage.set(MOCK_STORAGE_KEYS.listScenario, scenario);
      await openProfile(storage);

      const panel = within(await screen.findByRole("tabpanel"));

      expect(await panel.findByRole("alert")).toHaveTextContent("Произошла ошибка. Попробуйте позже");
      expect(panel.getByRole("button", { name: "Повторить загрузку списка" })).toBeInTheDocument();
    },
  );

  it("sends the user to login when the session expires while loading the list", async () => {
    const storage = signedInStorage({ want_to_watch: [603], watched: [] });
    storage.set(MOCK_STORAGE_KEYS.listScenario, "SESSION_EXPIRED");
    const { scope } = await openProfile(storage, "/profile?tab=watched");

    await waitFor(() => expect(scope.getState(router.$path)).toBe("/login"));
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile?tab=watched" });
  });
});

describe("profile list removal", () => {
  it("removes the movie, updates the statistics and the movie page", async () => {
    const storage = signedInStorage({ want_to_watch: [157336], watched: [603, 157336] });
    const { scope, user } = await openProfile(storage, "/profile?tab=watched");

    await waitFor(() => expect(movieTitles()).toEqual(["Интерстеллар", "Матрица"]));
    expect(statValue("Просмотрено")).toHaveTextContent("2");

    await user.click(screen.getByRole("button", { name: "Удалить «Интерстеллар» из списка" }));

    await waitFor(() => expect(movieTitles()).toEqual(["Матрица"]));
    await waitFor(() => expect(statValue("Просмотрено")).toHaveTextContent("1"));

    await act(() => allSettled(router.navigate, { scope, params: { path: "/movies/157336" } }));

    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Просмотрено" })).not.toBeDisabled());
    expect(screen.getByRole("checkbox", { name: "Просмотрено" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Хочу посмотреть" })).toBeChecked();
  });

  it.each([
    "remove_error",
    "remove_rate_limited",
    "remove_invalid_parameter",
    "remove_not_found",
    "remove_invalid_response",
    "remove_network_error",
    "remove_timeout",
  ])("keeps the movie and shows the general notification for %s", async (scenario) => {
    const storage = signedInStorage({ want_to_watch: [603], watched: [] });
    storage.set(MOCK_STORAGE_KEYS.listScenario, scenario);
    const { user } = await openProfile(storage);

    await user.click(await screen.findByRole("button", { name: "Удалить «Матрица» из списка" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Произошла ошибка. Попробуйте позже");
    expect(movieTitles()).toEqual(["Матрица"]);
    expect(screen.getByRole("button", { name: "Удалить «Матрица» из списка" })).toBeEnabled();
  });

  it("blocks the button while removing and ignores repeated presses", async () => {
    const storage = signedInStorage({ want_to_watch: [603, 157336], watched: [] });
    const gated = createGatedTransport(storage);
    const { scope } = await act(() => setupApiScope({ initialEntry: "/profile", transport: gated.transport }));
    renderApp(scope);
    const user = userEventSetup();

    const button = await screen.findByRole("button", { name: "Удалить «Матрица» из списка" });

    await user.click(button);
    await user.click(button);

    expect(button).toBeDisabled();
    expect(screen.getByRole("button", { name: "Удалить «Интерстеллар» из списка" })).toBeEnabled();
    expect(gated.deletes).toHaveLength(1);

    await act(async () => gated.release());

    await waitFor(() => expect(movieTitles()).toEqual(["Интерстеллар"]));
    expect(gated.deletes).toHaveLength(1);
  });

  it("sends the user to login when the remove request answers 401", async () => {
    const storage = signedInStorage({ want_to_watch: [], watched: [603] });
    storage.set(MOCK_STORAGE_KEYS.listScenario, "remove_session_expired");
    const { scope, user } = await openProfile(storage, "/profile?tab=watched");

    await user.click(await screen.findByRole("button", { name: "Удалить «Матрица» из списка" }));

    await waitFor(() => expect(scope.getState(router.$path)).toBe("/login"));
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile?tab=watched" });
  });

  it("sends the user to login when the session expires during removal", async () => {
    const storage = signedInStorage({ want_to_watch: [], watched: [603] });
    const gated = createGatedTransport(storage, async () => {
      storage.set(MOCK_STORAGE_KEYS.listScenario, "SESSION_EXPIRED");
    });
    const { scope } = await act(() =>
      setupApiScope({ initialEntry: "/profile?tab=watched", transport: gated.transport }),
    );
    renderApp(scope);

    await userEventSetup().click(await screen.findByRole("button", { name: "Удалить «Матрица» из списка" }));
    await act(async () => gated.release());

    await waitFor(() => expect(scope.getState(router.$path)).toBe("/login"));
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile?tab=watched" });
    expect(screen.queryByRole("alert", { name: /Произошла ошибка/ })).not.toBeInTheDocument();
  });
});
