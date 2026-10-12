import { historyAdapter } from "@effector/router";
import { RouterProvider } from "@effector/router-react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { allSettled, type EffectParams, fork } from "effector";
import { Provider } from "effector-react";
import { createMemoryHistory } from "history";
import { describe, expect, it, vi } from "vitest";

import { $$home, HomePage } from "@/pages/home";

import { fileConstraints } from "@/features/search-by-file";

import { $$session } from "@/entities/session";

import { type FileSearchMode, transportFx } from "@/shared/api";
import { createMockTransport, MOCK_STORAGE_KEYS, NO_MOCK_DELAYS, type SearchScenario } from "@/shared/api/mocks";
import { validateFileSelection } from "@/shared/lib/files";
import { router } from "@/shared/routes";

import { createTestMockStorage } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const setup = async (scenario: SearchScenario = "found", authenticated = true) => {
  const storage = createTestMockStorage();
  if (authenticated) storage.set(MOCK_STORAGE_KEYS.session, "authenticated");
  storage.set(MOCK_STORAGE_KEYS.searchScenario, scenario);
  const transport = vi.fn(createMockTransport({ storage, delays: NO_MOCK_DELAYS }));
  const { $$imageSearch, $$videoSearch } = $$home.$$search.__;
  const scope = fork({
    handlers: [
      [transportFx, transport],
      // jsdom cannot decode media; only browser decoding is replaced, the API flow stays real.
      [
        $$imageSearch.__.validateFx,
        ({ files }: EffectParams<typeof $$imageSearch.__.validateFx>) =>
          validateFileSelection(files, fileConstraints.image),
      ],
      [
        $$videoSearch.__.validateFx,
        ({ files }: EffectParams<typeof $$videoSearch.__.validateFx>) =>
          validateFileSelection(files, fileConstraints.video),
      ],
    ],
  });
  const history = createMemoryHistory({ initialEntries: ["/"] });
  await allSettled(router.setHistory, { scope, params: historyAdapter(history) });
  await allSettled($$session.inputs.sessionCheckRequested, { scope });
  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <HomePage />
      </RouterProvider>
    </Provider>,
  );
  const user = userEventSetup();
  const selectFile = async (mode: FileSearchMode) => {
    const image = mode === "image";
    const file = new File([mode], image ? "frame.png" : "scene.mp4", {
      type: image ? "image/png" : "video/mp4",
    });
    await user.click(screen.getByRole("tab", { name: image ? "Изображение" : "Видео" }));
    await user.upload(screen.getByLabelText(image ? "Выберите изображение" : "Выберите видеофрагмент"), file);
    return file;
  };
  const search = () => user.click(screen.getByRole("button", { name: "Начать поиск" }));
  return { scope, storage, transport, selectFile, search, user };
};

describe("home search through the backend mock transport", () => {
  it("guest can search by description through the JSON endpoint without signing in", async () => {
    const { scope, user, transport, search } = await setup("found", false);
    expect(screen.queryByText(/Поиск по описанию появится/)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Опиши, что помнишь о фильме"), "  Хакер выбирает таблетку  ");
    await search();
    expect(await screen.findByRole("heading", { name: "Матрица" })).toBeInTheDocument();
    const requests = transport.mock.calls.map(([request]) => request).filter(({ path }) => path.startsWith("/search/"));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      method: "POST",
      path: "/search/text",
      body: { query: "Хакер выбирает таблетку" },
    });
    const results = screen.getByRole("region", { name: "Результаты поиска" });
    expect(within(results).getByText("Найдено 5 фильмов")).toBeInTheDocument();
    expect(within(results).getAllByRole("article")).toHaveLength(5);
    expect(
      within(screen.getByRole("region", { name: "Поиск фильма" })).queryByRole("heading", { name: "Матрица" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Как это работает?" })).not.toBeInTheDocument();
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState(router.$path)).toBe("/");
  });

  it("text empty state allows clarifying the query and searching again", async () => {
    const { storage, user, search } = await setup("empty", false);
    const description = screen.getByLabelText("Опиши, что помнишь о фильме");
    await user.type(description, "Хакер");
    await search();
    expect(await screen.findByRole("heading", { name: "Ничего не нашлось" })).toBeInTheDocument();
    expect(description).toHaveValue("Хакер");
    await user.click(screen.getByRole("button", { name: "Изменить запрос" }));
    expect(description).toHaveFocus();
    storage.set(MOCK_STORAGE_KEYS.searchScenario, "found");
    await user.type(description, " выбирает таблетку");
    await search();
    expect(await screen.findByRole("heading", { name: "Матрица" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ничего не нашлось" })).not.toBeInTheDocument();
  });

  it("text search displays a backend failure and permits retry", async () => {
    const { storage, user, search } = await setup("SEARCH_UNAVAILABLE", false);
    await user.type(screen.getByLabelText("Опиши, что помнишь о фильме"), "Хакер выбирает таблетку");
    await search();
    expect(await screen.findByText("Поиск временно недоступен. Попробуйте позже")).toBeInTheDocument();
    storage.set(MOCK_STORAGE_KEYS.searchScenario, "found");
    await search();
    expect(await screen.findByRole("heading", { name: "Матрица" })).toBeInTheDocument();
  });

  it.each([
    ["image", "Матрица", 603],
    ["video", "Начало", 27205],
  ] as const)("%s sends one multipart file and renders the contract response", async (mode, title, movieId) => {
    const { transport, selectFile, search } = await setup();
    const file = await selectFile(mode);
    await search();
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText("Найден 1 фильм")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `Подробнее о фильме «${title}»` })).toHaveAttribute(
      "href",
      `/movies/${movieId}`,
    );
    const requests = transport.mock.calls.map(([request]) => request).filter(({ path }) => path.startsWith("/search/"));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: "POST", path: `/search/${mode}` });
    expect(requests[0].body).toBeInstanceOf(FormData);
    const body = requests[0].body as FormData;
    expect([...body.keys()]).toEqual(["file"]);
    expect(body.get("file")).toBe(file);
  });

  it("empty catalog response preserves the file and allows a new search", async () => {
    const { storage, selectFile, search } = await setup("empty");
    await selectFile("image");
    await search();
    expect(await screen.findByRole("heading", { name: "Ничего не нашлось" })).toBeInTheDocument();
    expect(screen.getByText(/frame.png/)).toBeInTheDocument();
    storage.set(MOCK_STORAGE_KEYS.searchScenario, "found");
    await search();
    expect(await screen.findByRole("heading", { name: "Матрица" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ничего не нашлось" })).not.toBeInTheDocument();
  });

  it.each([
    ["SEARCH_UNAVAILABLE", "Поиск временно недоступен. Попробуйте позже"],
    ["SERVER_BUSY", "Сервис перегружен. Попробуйте позже"],
    ["FILE_CORRUPTED", "Невозможно выполнить поиск по изображению: файл поврежден или не может быть обработан"],
  ] as const)("%s replaces the old result with a backend message and allows retry", async (scenario, message) => {
    const { storage, selectFile, search } = await setup();
    await selectFile("image");
    await search();
    await screen.findByRole("heading", { name: "Матрица" });
    storage.set(MOCK_STORAGE_KEYS.searchScenario, scenario);
    await search();
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Матрица" })).not.toBeInTheDocument();
    expect(screen.getByText(/frame.png/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Начать поиск" })).toBeEnabled();
    storage.set(MOCK_STORAGE_KEYS.searchScenario, "found");
    await search();
    expect(await screen.findByRole("heading", { name: "Матрица" })).toBeInTheDocument();
    expect(screen.queryByText(message)).not.toBeInTheDocument();
  });

  it("expired backend session opens login and removes the previous film", async () => {
    const { scope, storage, selectFile, search } = await setup();
    await selectFile("image");
    await search();
    await screen.findByRole("heading", { name: "Матрица" });
    storage.set(MOCK_STORAGE_KEYS.searchScenario, "SESSION_EXPIRED");
    await search();
    await waitFor(() => expect(scope.getState(router.$path)).toBe("/login"));
    expect(scope.getState(router.$query)).toEqual({ redirect: "/" });
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(storage.get(MOCK_STORAGE_KEYS.session)).toBeNull();
    expect(screen.queryByRole("heading", { name: "Матрица" })).not.toBeInTheDocument();
    expect(scope.getState($$home.$$search.outputs.$pending)).toBe(false);
  });
});
