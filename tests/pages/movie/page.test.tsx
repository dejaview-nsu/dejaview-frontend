import { RouterProvider } from "@effector/router-react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { allSettled, type Scope } from "effector";
import { Provider } from "effector-react";
import { describe, expect, it, vi } from "vitest";

import { $$movie, MoviePage } from "@/pages/movie";

import { BaseLayout } from "@/layouts/base";

import { MovieCard, MovieMatchCard } from "@/entities/movie";
import { $$session } from "@/entities/session";

import { createMockStorage, createMockTransport, MOCK_STORAGE_KEYS, NO_MOCK_DELAYS } from "@/shared/api/mocks";
import { EMPTY_MOVIE_FIXTURE, MOVIE_FIXTURE, REVIEW_FIXTURES } from "@/shared/api/mocks/movies";
import { router } from "@/shared/routes";

import { jsonResponse } from "../../controlled-transport";
import { setupMockApiScope, setupSessionScope } from "../../session-scope";
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

describe("movie page", () => {
  it("shows card fields, crew plurals, cast and paginated reviews; guest actions open login on the same route", async () => {
    const { scope } = await setupMockApiScope({ initialEntry: "/movies/157336" });
    renderPage(scope);

    expect(screen.getByRole("heading", { name: "Интерстеллар", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Interstellar")).toBeInTheDocument();
    expect(screen.getByText("2014")).toBeInTheDocument();
    expect(screen.getByText("12+")).toBeInTheDocument();
    expect(screen.getByText("2 ч 49 мин")).toBeInTheDocument();
    expect(screen.getByText("Страны")).toBeInTheDocument();
    expect(screen.getByText("США, Великобритания")).toBeInTheDocument();
    expect(screen.getByText("Сценаристы")).toBeInTheDocument();
    expect(screen.getByText("Кристофер Нолан, Джонатан Нолан")).toBeInTheDocument();
    expect(screen.getByText("Композитор")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Актёры" })).toBeInTheDocument();
    expect(screen.getByText("Мэттью Макконахи")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Трейлер" })).toHaveTextContent("Трейлер скоро появится");
    expect(screen.getByRole("button", { name: /Сортировать по:/ })).toHaveTextContent("Сначала лучшие");
    expect(screen.getByLabelText("Сумма реакций: 0")).toHaveTextContent("0");
    expect(screen.getByLabelText("Сумма реакций: -5")).toHaveTextContent("-5");

    const reviews = screen.getByRole("region", { name: "Отзывы" });
    expect(within(reviews).getAllByRole("article")).toHaveLength(10);
    const user = userEventSetup();
    await user.click(screen.getByRole("button", { name: "Ещё отзывы" }));
    expect(within(reviews).getAllByRole("article")).toHaveLength(20);
    await user.click(screen.getByRole("button", { name: "Ещё отзывы" }));
    expect(within(reviews).getAllByRole("article")).toHaveLength(23);
    expect(screen.queryByRole("button", { name: "Ещё отзывы" })).toBeNull();

    await user.click(screen.getByRole("button", { name: /Сортировать по:/ }));
    expect(screen.getByRole("option", { name: "Сначала лучшие" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("option", { name: "Самые старые" }));
    expect(within(reviews).getAllByRole("article")).toHaveLength(10);
    expect(within(within(reviews).getAllByRole("article")[0]).getByText("kinoman_1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Хочу посмотреть" }));
    expect(screen.getByRole("dialog", { name: "Вход в DejaView" })).toBeInTheDocument();
    expect(scope.getState($$session.outputs.$loginDialogPath)).toBe("/movies/157336");
    expect(scope.getState(router.$path)).toBe("/movies/157336");
  });

  it("hides missing data and shows poster and review fallbacks", async () => {
    const { scope } = await setupMockApiScope({ initialEntry: "/movies/1000001" });
    renderPage(scope);

    expect(screen.getByRole("heading", { name: "Фильм без данных" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Нет постера/ })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Сюжет" })).toHaveTextContent("Описание пока не добавлено");
    expect(screen.queryByRole("heading", { name: "О фильме" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Актёры" })).toBeNull();
    expect(screen.getByText("Нет постера")).toBeInTheDocument();
    expect(screen.getByText("Пока никто не оставил отзыв")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Сортировать по:/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ещё отзывы" })).toBeNull();
  });

  it("handles broken poster and actor images, deleted authors and edited untitled reviews", async () => {
    const { scope } = await setupSessionScope({
      initialEntry: "/movies/157336",
      transport: async ({ path }) =>
        jsonResponse(
          200,
          path.includes("/reviews")
            ? {
                reviews: [
                  { ...REVIEW_FIXTURES[0], username: null, title: null, is_edited: true, likes: 2, dislikes: 5 },
                ],
                has_more: false,
              }
            : {
                ...MOVIE_FIXTURE,
                actors: [{ ...MOVIE_FIXTURE.actors[0], photo_url: "https://example.com/missing.jpg" }],
              },
        ),
    });
    renderPage(scope);

    fireEvent.error(screen.getByRole("img", { name: /Постер фильма/ }));
    expect(screen.getByRole("img", { name: /Нет постера/ })).toBeInTheDocument();
    fireEvent.error(screen.getByRole("img", { name: "Мэттью Макконахи" }));
    expect(screen.getByRole("img", { name: "Нет фото: Мэттью Макконахи" })).toBeInTheDocument();
    expect(screen.getByText("Удалённый пользователь")).toBeInTheDocument();
    expect(screen.getByText(/Редактирован/)).toBeInTheDocument();
    expect(screen.getByLabelText("Сумма реакций: -3")).toHaveTextContent("-3");
  });

  it("shows contract errors and retries unavailable data", async () => {
    const storage = createMockStorage(() => null);
    storage.set(MOCK_STORAGE_KEYS.movieScenario, "MOVIE_UNAVAILABLE");
    const { scope } = await setupMockApiScope({ initialEntry: "/movies/157336", storage });
    renderPage(scope);

    expect(screen.getByRole("alert")).toHaveTextContent("Не удалось загрузить информацию о фильме. Попробуйте позже");
    storage.remove(MOCK_STORAGE_KEYS.movieScenario);
    await userEventSetup().click(screen.getByRole("button", { name: "Повторить" }));
    expect(screen.getByRole("heading", { name: "Интерстеллар" })).toBeInTheDocument();
  });

  it("shows 404 with a return link", async () => {
    const { scope } = await setupMockApiScope({ initialEntry: "/movies/404404" });
    renderPage(scope);

    expect(screen.getByRole("heading", { name: "Фильм не найден" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Перейти к поиску" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("region", { name: "Отзывы" })).toBeNull();
  });

  it("recovers reviews independently and keeps the movie visible", async () => {
    const storage = createMockStorage(() => null);
    storage.set(MOCK_STORAGE_KEYS.reviewScenario, "error");
    const { scope } = await setupMockApiScope({ initialEntry: "/movies/157336", storage });
    renderPage(scope);

    expect(screen.getByRole("heading", { name: "Интерстеллар" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Не удалось загрузить отзывы");
    storage.remove(MOCK_STORAGE_KEYS.reviewScenario);
    await userEventSetup().click(screen.getByRole("button", { name: "Повторить загрузку отзывов" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(within(screen.getByRole("region", { name: "Отзывы" })).getAllByRole("article")).toHaveLength(10);
  });

  it("updates the card when movieId changes on the same route and ignores query-only updates", async () => {
    const storage = createMockStorage(() => null);
    const transport = vi.fn(createMockTransport({ storage, delays: NO_MOCK_DELAYS }));
    const { scope } = await setupSessionScope({ initialEntry: "/movies/157336", transport });
    renderPage(scope);

    await act(() => allSettled(router.navigate, { scope, params: { path: "/movies/603" } }));
    expect(screen.getByRole("heading", { name: "Матрица" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Интерстеллар" })).toBeNull();
    expect(scope.getState($$movie.outputs.$movie)?.movie_id).toBe(603);

    const requests = transport.mock.calls.length;
    await act(() => allSettled(router.navigate, { scope, params: { path: "/movies/603?source=search" } }));
    expect(transport.mock.calls).toHaveLength(requests);
  });

  it.each([MovieCard, MovieMatchCard])("opens movie details from a search result", async (Card) => {
    const { scope } = await setupMockApiScope();
    render(
      <Provider value={scope}>
        <RouterProvider router={router}>
          <Card movie={MOVIE_FIXTURE} />
        </RouterProvider>
      </Provider>,
    );

    await userEventSetup().click(screen.getByRole("link"));

    expect(scope.getState(router.$path)).toBe("/movies/157336");
    expect(scope.getState($$movie.outputs.$status)).toBe("ready");
  });

  it("keeps future actions disabled for an authenticated user", async () => {
    const { scope } = await setupSessionScope({
      initialEntry: "/movies/1",
      authenticated: true,
      transport: async ({ path }) =>
        jsonResponse(200, path.includes("/reviews") ? { reviews: [], has_more: false } : EMPTY_MOVIE_FIXTURE),
    });
    renderPage(scope);

    expect(screen.getByRole("button", { name: "Оценить" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Хочу посмотреть" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Просмотрено" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Написать отзыв" })).toBeDisabled();
  });

  it.each(["Оценить", "Хочу посмотреть", "Просмотрено", "Написать отзыв"])(
    "opens the existing login dialog for the guest action %s and keeps the movie URL",
    async (name) => {
      const { scope } = await setupMockApiScope({ initialEntry: "/movies/157336?source=search" });
      renderPage(scope);
      const action = screen.getByRole("button", { name });

      expect(action).toBeEnabled();
      await userEventSetup().click(action);

      expect(screen.getByRole("dialog", { name: "Вход в DejaView" })).toBeInTheDocument();
      expect(scope.getState($$session.outputs.$loginDialogPath)).toBe("/movies/157336?source=search");
      expect(scope.getState(router.$path)).toBe("/movies/157336");
    },
  );

  it("returns a directly opened movie to search", async () => {
    const { scope, history } = await setupMockApiScope({ initialEntry: "/movies/157336" });
    renderPage(scope);

    await userEventSetup().click(screen.getByRole("button", { name: "Назад" }));

    expect(history.location.pathname).toBe("/");
    expect(history.index).toBe(0);
  });
});
