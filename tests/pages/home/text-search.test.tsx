import { RouterProvider } from "@effector/router-react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Provider } from "effector-react";
import { describe, expect, it, vi } from "vitest";

import { $$home, HomePage } from "@/pages/home";

import { $$session } from "@/entities/session";

import { type TransportRequest, type TransportResponse } from "@/shared/api";
import { TransportError } from "@/shared/api/transport/errors";
import { router } from "@/shared/routes";

import { jsonResponse } from "../../controlled-transport";
import { setupSessionScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const LABEL = "Опиши, что помнишь о фильме";

const HINT = "Сюжет, сцена, персонажи, реплики, жанр или примерный год.";

const movie = (id: number, extra: Partial<Record<"year" | "overview" | "poster_url", unknown>> = {}) => ({
  movie_id: id,
  title: `Фильм ${id}`,
  year: null,
  poster_url: null,
  overview: null,
  ...extra,
});

type Reply = TransportResponse | Error;

const setup = async ({ authenticated = false, replies = [] as Reply[] } = {}) => {
  const queue = [...replies];
  const transport = vi.fn(async (request: TransportRequest) => {
    const reply = queue.shift() ?? jsonResponse(200, { results: [] });
    if (request.path !== "/search/text") throw new Error(`Unexpected ${request.path}`);
    if (reply instanceof Error) throw reply;
    return reply;
  });
  const { scope } = await setupSessionScope({ authenticated, transport });
  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <HomePage />
      </RouterProvider>
    </Provider>,
  );
  const user = userEventSetup();
  const input = screen.getByLabelText(LABEL);
  const search = () => user.click(screen.getByRole("button", { name: "Начать поиск" }));
  const results = () => screen.queryByRole("region", { name: "Результаты поиска" });
  const sent = () => transport.mock.calls.map(([request]) => request.body);
  return { scope, user, input, search, results, sent, queue };
};

describe("text search on the home page", () => {
  it("links the field with its label and hint and shows the counter", async () => {
    const { input, user } = await setup();
    expect(input).toHaveAttribute("placeholder", "Например: солдат в окопе, за кадром играет скрипка");
    expect(input).toHaveAccessibleDescription(HINT);
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByText("0/250")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Очистить описание" })).not.toBeInTheDocument();
    await user.type(input, "  😀 ");
    expect(screen.getByText("4/250")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Очистить описание" })).toBeInTheDocument();
  });

  it.each([
    ["   ", "Опиши, что помнишь о фильме — минимум 3 символа"],
    ["Со", "Запрос слишком короткий — нужно минимум 3 символа"],
  ])("shows the client error for %j under the field without a request", async (text, message) => {
    const { input, user, search, sent } = await setup();
    await user.type(input, text);
    await search();
    expect(sent()).toHaveLength(0);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(message);
    expect(screen.queryByText(HINT)).not.toBeInTheDocument();
    expect(input).toHaveValue(text);
    await user.type(input, "в");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(input).toHaveAccessibleDescription(HINT);
  });

  it("stops typing at 250 characters, accepts a long paste and marks the counter", async () => {
    const { input, user, search, sent } = await setup();
    fireEvent.change(input, { target: { value: "а".repeat(250) } });
    await user.type(input, "б");
    expect(input).toHaveValue("а".repeat(250));
    await user.clear(input);
    input.focus();
    await user.paste("б".repeat(263));
    expect(input).toHaveValue("б".repeat(263));
    const counter = screen.getByText("263/250");
    expect(counter).toHaveClass("text-error-text");
    await search();
    expect(sent()).toHaveLength(0);
    expect(screen.getByRole("alert")).toHaveTextContent("Запрос длиннее 250 символов — сократи описание");
    expect(input).toHaveValue("б".repeat(263));
  });

  it("shows up to 10 movies in server order with the submitted query and keeps the draft", async () => {
    const found = [
      movie(1, { year: 2019, overview: "Два солдата пересекают линию фронта." }),
      ...Array.from({ length: 11 }, (_, index) => movie(index + 2)),
    ];
    const { input, user, search, results, sent, scope } = await setup({
      replies: [jsonResponse(200, { results: found })],
    });
    await user.type(input, "  Солдат в окопе  ");
    await search();
    const region = await waitFor(() => {
      const element = results();
      expect(element).not.toBeNull();
      return element as HTMLElement;
    });
    await within(region).findByRole("heading", { name: "Фильм 1" });
    expect(sent()).toEqual([{ query: "Солдат в окопе" }]);
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(within(region).getByRole("heading", { level: 2 })).toHaveTextContent(
      "Результаты по запросу«Солдат в окопе»",
    );
    expect(within(region).getByText("Найдено 10 фильмов")).toBeInTheDocument();
    const cards = within(region).getAllByRole("article");
    expect(cards).toHaveLength(10);
    expect(cards.map((card) => within(card).getByRole("heading").textContent)).toEqual(
      found.slice(0, 10).map(({ title }) => title),
    );
    expect(within(cards[0]).getByText("2019")).toBeInTheDocument();
    expect(within(cards[0]).getByText("Два солдата пересекают линию фронта.")).toHaveClass("line-clamp-2");
    expect(within(cards[0]).getByRole("img", { name: "Нет постера фильма «Фильм 1»" })).toBeInTheDocument();
    expect(within(cards[0]).getByRole("link", { name: "Подробнее о фильме «Фильм 1»" })).toHaveAttribute(
      "href",
      "/movies/1",
    );
    expect(region).not.toHaveTextContent("%");
    expect(input).toHaveValue("  Солдат в окопе  ");
    await user.type(input, " и скрипка");
    expect(within(region).getByText("«Солдат в окопе»")).toBeInTheDocument();
  });

  it.each([
    [1, "Найден 1 фильм"],
    [2, "Найдено 2 фильма"],
    [5, "Найдено 5 фильмов"],
  ])("declines the count for %i movies", async (count, label) => {
    const replies = [jsonResponse(200, { results: Array.from({ length: count }, (_, index) => movie(index + 1)) })];
    const { input, user, search } = await setup({ replies });
    await user.type(input, "Солдат в окопе");
    await search();
    expect(await screen.findByText(label)).toBeInTheDocument();
  });

  it("shows the empty state with editing and searching again", async () => {
    const { input, user, search, sent, queue } = await setup({ replies: [jsonResponse(200, { results: [] })] });
    await user.type(input, "Солдат в окопе");
    await search();
    expect(await screen.findByRole("heading", { name: "Не удалось узнать фильм" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Попробуйте уточнить или переформулировать запрос, добавив сюжет, сцену, персонажей, жанр или примерный год выпуска",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Что может помочь" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "опиши конкретную сцену, а не весь фильм;",
      "добавь детали: где происходит действие, кто герои;",
      "укажи примерный год или страну.",
    ]);
    await user.click(screen.getByRole("button", { name: "Изменить запрос" }));
    expect(input).toHaveFocus();
    expect(input).toHaveValue("Солдат в окопе");
    await user.type(input, " и скрипка");
    queue.push(jsonResponse(200, { results: [movie(7)] }));
    await user.click(screen.getByRole("button", { name: "Искать снова" }));
    expect(await screen.findByRole("heading", { name: "Фильм 7" })).toBeInTheDocument();
    expect(sent()).toEqual([{ query: "Солдат в окопе" }, { query: "Солдат в окопе и скрипка" }]);
  });

  it("validates the field again when searching again from the empty state", async () => {
    const { input, user, search, sent } = await setup({ replies: [jsonResponse(200, { results: [] })] });
    await user.type(input, "Солдат в окопе");
    await search();
    await screen.findByRole("heading", { name: "Не удалось узнать фильм" });
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "Искать снова" }));
    expect(sent()).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent("Опиши, что помнишь о фильме — минимум 3 символа");
    expect(screen.queryByRole("heading", { name: "Не удалось узнать фильм" })).not.toBeInTheDocument();
  });

  it.each([
    ["QUERY_NOT_ALLOWED", 422, "Не получилось выполнить поиск по этому запросу. Измени формулировку и попробуй снова"],
    ["QUERY_TOO_SHORT", 422, "Запрос слишком короткий — нужно минимум 3 символа"],
    ["QUERY_EMPTY", 400, "Опиши, что помнишь о фильме — минимум 3 символа"],
  ])("shows the server %s error under the field and hides old results", async (code, status, message) => {
    const replies = [
      jsonResponse(200, { results: [movie(1)] }),
      jsonResponse(status, { code, message: "Невозможно выполнить поиск по запросу", field: "query" }),
    ];
    const { input, user, search, results } = await setup({ replies });
    await user.type(input, "Солдат в окопе");
    await search();
    await screen.findByRole("heading", { name: "Фильм 1" });
    await search();
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText(/Невозможно выполнить/)).not.toBeInTheDocument();
    expect(results()).toBeNull();
    expect(input).toHaveValue("Солдат в окопе");
  });

  it.each([
    ["503", jsonResponse(503, { code: "SEARCH_UNAVAILABLE", message: "ML недоступен", field: null })],
    ["timeout", new TransportError("timeout")],
    ["network", new TransportError("network")],
    ["429", jsonResponse(429, { code: "RATE_LIMITED", message: "x", field: null })],
  ])("shows the video-mode unavailable notice for %s and hides old results", async (_, failure) => {
    const { input, user, search, queue } = await setup({ replies: [jsonResponse(200, { results: [movie(1)] })] });
    await user.type(input, "Солдат в окопе");
    await search();
    await screen.findByRole("heading", { name: "Фильм 1" });
    queue.push(failure);
    await search();
    const notice = await screen.findByRole("alert");
    expect(within(notice).getByRole("heading", { name: "Поиск временно недоступен" })).toBeInTheDocument();
    expect(notice).toHaveTextContent("Мы уже разбираемся. Попробуйте еще раз через несколько минут");
    expect(notice).not.toHaveTextContent(/ML|503|RATE/);
    expect(screen.queryByRole("heading", { name: "Фильм 1" })).not.toBeInTheDocument();
    expect(input).toHaveValue("Солдат в окопе");
    queue.push(jsonResponse(200, { results: [movie(2)] }));
    await user.click(within(notice).getByRole("button", { name: "Повторить" }));
    expect(await screen.findByRole("heading", { name: "Фильм 2" })).toBeInTheDocument();
  });

  it("keeps the text when switching modes back and forth for a signed-in user", async () => {
    const { input, user, scope } = await setup({ authenticated: true });
    await user.type(input, "Солдат в окопе");
    for (const name of ["Изображение", "Видео", "Аудио", "Текст"])
      await user.click(screen.getByRole("tab", { name: new RegExp(name) }));
    expect(screen.getByLabelText(LABEL)).toHaveValue("Солдат в окопе");
    expect(scope.getState($$home.$$search.outputs.$text)).toBe("Солдат в окопе");
  });
});
