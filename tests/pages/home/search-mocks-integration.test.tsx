import { historyAdapter } from "@effector/router";
import { RouterProvider } from "@effector/router-react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { allSettled, type EffectParams, fork } from "effector";
import { Provider } from "effector-react";
import { createMemoryHistory } from "history";
import { describe, expect, it, vi } from "vitest";

import { $$home, HomePage } from "@/pages/home";
import "@/pages/login/model";

import { fileConstraints } from "@/features/search-by-file";
import { checkVideo } from "@/features/search-by-video";

import { $$session } from "@/entities/session";

import { type FileSearchMode, transportFx, type TransportRequest } from "@/shared/api";
import { createMockTransport, MOCK_STORAGE_KEYS, NO_MOCK_DELAYS, type SearchScenario } from "@/shared/api/mocks";
import { validateFileSelection } from "@/shared/lib/files";
import { router, routes } from "@/shared/routes";

import { createControlledTransport } from "../../controlled-transport";
import { createTestMockStorage } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

type SearchMode = "text" | FileSearchMode;

const TAB_NAMES: Record<SearchMode, string> = { text: "Текст", image: "Изображение", video: "Видео" };

const INPUT_LABELS: Record<SearchMode, string> = {
  text: "Опиши, что помнишь о фильме",
  image: "Выберите изображение",
  video: "Выберите видеофрагмент",
};

const setup = async (
  scenario: SearchScenario = "found",
  authenticated = true,
  {
    durationSeconds = 24,
    holdVideo = false,
    holdMode = null,
  }: { durationSeconds?: number; holdVideo?: boolean; holdMode?: SearchMode | null } = {},
) => {
  const storage = createTestMockStorage();
  if (authenticated) storage.set(MOCK_STORAGE_KEYS.session, "authenticated");
  storage.set(MOCK_STORAGE_KEYS.searchScenario, scenario);
  const mock = createMockTransport({ storage, delays: NO_MOCK_DELAYS });
  const held = createControlledTransport();
  const transport = vi.fn((request: TransportRequest) =>
    (holdVideo && request.path === "/search/video") || (holdMode && request.path === `/search/${holdMode}`)
      ? held.transport(request)
      : mock(request),
  );
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
        $$videoSearch.__.checkFx,
        ({ files }: EffectParams<typeof $$videoSearch.__.checkFx>) => checkVideo(files, async () => durationSeconds),
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
  return { scope, storage, transport, held, selectFile, search, user };
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
    ["image", "Матрица", 603, "Подробнее о фильме «Матрица»"],
    ["video", "Начало", 27205, "Открыть карточку фильма"],
  ] as const)("%s sends one multipart file and renders the contract response", async (mode, title, movieId, link) => {
    const { transport, selectFile, search } = await setup();
    const file = await selectFile(mode);
    await search();
    expect(await screen.findByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: link })).toHaveAttribute("href", `/movies/${movieId}`);
    const requests = transport.mock.calls.map(([request]) => request).filter(({ path }) => path.startsWith("/search/"));
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ method: "POST", path: `/search/${mode}` });
    expect(requests[0].body).toBeInstanceOf(FormData);
    const body = requests[0].body as FormData;
    expect([...body.keys()]).toEqual(["file"]);
    expect(body.get("file")).toBe(file);
  });

  it.each([
    ["text", "image"],
    ["image", "video"],
    ["video", "text"],
  ] as const)(
    "a running %s search does not show up or block the %s mode when every mode has data",
    async (running, other) => {
      const { transport, held, selectFile, search, user } = await setup("found", true, { holdMode: running });
      await user.type(screen.getByLabelText(INPUT_LABELS.text), "Хакер выбирает таблетку");
      await selectFile("image");
      await selectFile("video");
      await user.click(screen.getByRole("tab", { name: TAB_NAMES[running] }));
      await search();
      await held.waitForCalls(1);

      await user.click(screen.getByRole("tab", { name: TAB_NAMES[other] }));

      expect(screen.getByRole("button", { name: "Начать поиск" })).toBeEnabled();
      expect(screen.getByLabelText(INPUT_LABELS[other])).toBeEnabled();
      expect(screen.queryByRole("region", { name: "Результаты поиска" })).not.toBeInTheDocument();

      await search();
      await waitFor(() =>
        expect(transport.mock.calls.some(([request]) => request.path === `/search/${other}`)).toBe(true),
      );
      expect(held.current().request.signal?.aborted).toBe(false);

      await user.click(screen.getByRole("tab", { name: TAB_NAMES[running] }));
      expect(screen.getByRole("button", { name: "Поиск выполняется" })).toBeDisabled();
    },
  );

  it("image result keeps the shared results header", async () => {
    const { selectFile, search } = await setup();
    await selectFile("image");
    await search();
    await screen.findByRole("heading", { name: "Матрица" });
    expect(screen.getByText("Найден 1 фильм")).toBeInTheDocument();
    expect(screen.queryByText("этот фильм")).not.toBeInTheDocument();
  });

  it("video shows the selected file card and the single result layout", async () => {
    const { selectFile, search } = await setup();
    await selectFile("video");
    expect(screen.getByText("scene.mp4")).toBeInTheDocument();
    expect(screen.getByText("Файл подходит — можно начинать поиск")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Заменить" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Удалить" })).toBeEnabled();
    await search();
    expect(await screen.findByRole("heading", { name: "Похоже, это этот фильм" })).toBeInTheDocument();
    expect(screen.getByText("Ваш фрагмент")).toBeInTheDocument();
    expect(screen.queryByText("Найден 1 фильм")).not.toBeInTheDocument();
  });

  it("video removal returns the empty upload zone", async () => {
    const { selectFile, user } = await setup();
    await selectFile("video");
    await user.click(screen.getByRole("button", { name: "Удалить" }));
    expect(screen.queryByText("scene.mp4")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Выбрать файл" })).toBeInTheDocument();
    expect(screen.getByText("Перетащите видеофрагмент сюда или выберите файл")).toBeInTheDocument();
  });

  it("video empty response explains what helps and searches again with the same file", async () => {
    const { storage, transport, selectFile, search, user } = await setup("empty");
    await selectFile("video");
    await search();
    expect(await screen.findByRole("heading", { name: "Не удалось узнать фильм" })).toBeInTheDocument();
    expect(screen.getByText("Что может помочь")).toBeInTheDocument();
    expect(screen.getByText("scene.mp4")).toBeInTheDocument();
    storage.set(MOCK_STORAGE_KEYS.searchScenario, "found");
    await user.click(screen.getByRole("button", { name: "Искать снова" }));
    expect(await screen.findByRole("heading", { name: "Начало" })).toBeInTheDocument();
    expect(transport.mock.calls.filter(([request]) => request.path === "/search/video")).toHaveLength(2);
  });

  it("video backend error keeps the file and shows the message under the shared title", async () => {
    const { selectFile, search } = await setup("FILE_CORRUPTED");
    await selectFile("video");
    await search();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("heading", { name: "Не получилось начать поиск" })).toBeInTheDocument();
    expect(
      within(alert).getByText("Не удалось открыть видео — возможно, файл поврежден. Попробуйте другой файл."),
    ).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: "Выбрать другой файл" })).toBeEnabled();
    expect(screen.getByText("scene.mp4")).toBeInTheDocument();
    expect(screen.getByText("Файл поврежден")).toBeInTheDocument();
    expect(screen.queryByText("Файл подходит — можно начинать поиск")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Начать поиск" })).toBeEnabled();
  });

  it("video file action in the red block opens the file picker", async () => {
    const { selectFile, search, user } = await setup("FILE_CORRUPTED");
    await selectFile("video");
    await search();
    const alert = await screen.findByRole("alert");
    const opened = vi.fn();
    const input = screen.getByLabelText("Выберите видеофрагмент");
    const button = within(alert).getByRole("button", { name: "Выбрать другой файл" });
    expect(input.id).not.toBe("");
    expect(button).toHaveAttribute("for", input.id);
    input.addEventListener("click", opened);
    await user.click(button);
    expect(opened).toHaveBeenCalledOnce();
  });

  it("video empty result opens the file picker from «Выбрать другое видео»", async () => {
    const { selectFile, search, user } = await setup("empty");
    await selectFile("video");
    await search();
    await screen.findByRole("heading", { name: "Не удалось узнать фильм" });
    const opened = vi.fn();
    const input = screen.getByLabelText("Выберите видеофрагмент");
    const button = screen.getByRole("button", { name: "Выбрать другое видео" });
    expect(button).toHaveAttribute("for", input.id);
    input.addEventListener("click", opened);
    await user.click(button);
    expect(opened).toHaveBeenCalledOnce();
  });

  it("video search without a file offers to choose one", async () => {
    const { search, user } = await setup();
    await user.click(screen.getByRole("tab", { name: "Видео" }));
    await search();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Сначала добавьте видеофрагмент: нажмите «Выбрать файл».")).toBeInTheDocument();
    const opened = vi.fn();
    screen.getByLabelText("Выберите видеофрагмент").addEventListener("click", opened);
    await user.click(within(alert).getByRole("button", { name: "Выбрать файл" }));
    expect(opened).toHaveBeenCalledOnce();
  });

  it("video server failure offers a retry with the same file", async () => {
    const { storage, transport, selectFile, search, user } = await setup("INTERNAL_ERROR");
    await selectFile("video");
    await search();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("heading", { name: "Не получилось начать поиск" })).toBeInTheDocument();
    expect(within(alert).queryByRole("button", { name: "Выбрать другой файл" })).not.toBeInTheDocument();
    expect(screen.getByText("Файл подходит — можно начинать поиск")).toBeInTheDocument();
    storage.set(MOCK_STORAGE_KEYS.searchScenario, "found");
    await user.click(within(alert).getByRole("button", { name: "Повторить" }));
    expect(await screen.findByRole("heading", { name: "Начало" })).toBeInTheDocument();
    expect(transport.mock.calls.filter(([request]) => request.path === "/search/video")).toHaveLength(2);
  });

  it("video replace hint is hidden while the search is running", async () => {
    const { held, selectFile, search } = await setup("found", true, { holdVideo: true });
    await selectFile("video");
    const hint = "Чтобы заменить видео, перетащите другое сюда или нажмите «Заменить»";
    expect(screen.getByText(hint)).toBeInTheDocument();
    await search();
    await held.waitForCalls(1);
    expect(await screen.findByRole("heading", { name: "Загружаем видео…" })).toBeInTheDocument();
    expect(screen.queryByText(hint)).not.toBeInTheDocument();
  });

  it("video unavailability shows the warning block and retries with the same file", async () => {
    const { storage, transport, selectFile, search, user } = await setup("SEARCH_UNAVAILABLE");
    await selectFile("video");
    await search();
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("heading", { name: "Поиск временно недоступен" })).toBeInTheDocument();
    expect(
      within(alert).getByText(
        "Мы уже разбираемся. Попробуйте еще раз через несколько минут — видеофрагмент сохранится",
      ),
    ).toBeInTheDocument();
    storage.set(MOCK_STORAGE_KEYS.searchScenario, "found");
    await user.click(within(alert).getByRole("button", { name: "Повторить" }));
    expect(await screen.findByRole("heading", { name: "Начало" })).toBeInTheDocument();
    expect(transport.mock.calls.filter(([request]) => request.path === "/search/video")).toHaveLength(2);
  });

  it("long video gets a red badge and the check message without a request", async () => {
    const { transport, selectFile, search } = await setup("found", true, { durationSeconds: 47 });
    await selectFile("video");
    expect(await screen.findByText("Фрагмент длиннее 30 секунд")).toBeInTheDocument();
    await search();
    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText(
        "Фрагмент длиннее 30 секунд. Обрежьте видео до самой узнаваемой сцены или выберите другой файл.",
      ),
    ).toBeInTheDocument();
    expect(transport.mock.calls.some(([request]) => request.path === "/search/video")).toBe(false);
    expect(screen.getByRole("button", { name: "Начать поиск" })).toBeEnabled();
  });

  it("leaving the page cancels a running video search and keeps the file", async () => {
    const { scope, held, selectFile, search } = await setup("found", true, { holdVideo: true });
    await selectFile("video");
    await search();
    await held.waitForCalls(1);
    expect(await screen.findByRole("heading", { name: "Загружаем видео…" })).toBeInTheDocument();
    await allSettled(routes.about.open, { scope, params: undefined });
    expect(held.current().request.signal?.aborted).toBe(true);
    expect(scope.getState($$home.$$search.outputs.$pending)).toBe(false);
    expect(scope.getState($$home.$$search.outputs.$video).files).toHaveLength(1);
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

  it("guest who picks video and signs in returns to the video mode with text and file kept", async () => {
    const { scope, transport, selectFile, user } = await setup("found", false);
    await user.type(screen.getByLabelText(INPUT_LABELS.text), "Хакер выбирает таблетку");
    await user.click(screen.getByRole("tab", { name: "Видео, после входа" }));
    await waitFor(() => expect(scope.getState(router.$path)).toBe("/login"));
    expect(scope.getState(router.$query)).toEqual({ redirect: "/?mode=video" });
    expect(scope.getState($$home.$$search.outputs.$mode)).toBe("text");
    expect(scope.getState($$home.$$search.outputs.$pendingMode)).toBe("video");

    await allSettled($$session.inputs.signedIn, { scope, params: { login: "movie_fan_42", password: "Kino#2026" } });
    await waitFor(() => expect(scope.getState(router.$path)).toBe("/"));

    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
    expect(screen.getByRole("tab", { name: "Видео" })).toHaveAttribute("aria-selected", "true");
    expect(scope.getState($$home.$$search.outputs.$pendingMode)).toBeNull();
    expect(transport.mock.calls.some(([request]) => request.path.startsWith("/search/"))).toBe(false);

    await selectFile("video");
    await user.click(screen.getByRole("tab", { name: "Текст" }));
    expect(screen.getByLabelText(INPUT_LABELS.text)).toHaveValue("Хакер выбирает таблетку");
    await user.click(screen.getByRole("tab", { name: "Видео" }));
    expect(screen.getByText("scene.mp4")).toBeInTheDocument();
  });

  it("guest who leaves the login page without signing in keeps the current mode", async () => {
    const { scope, user } = await setup("found", false);
    await user.type(screen.getByLabelText(INPUT_LABELS.text), "Хакер");
    await user.click(screen.getByRole("tab", { name: "Видео, после входа" }));
    await waitFor(() => expect(scope.getState(router.$path)).toBe("/login"));

    await allSettled(routes.home.open, { scope, params: {} });

    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState($$home.$$search.outputs.$mode)).toBe("text");
    expect(scope.getState($$home.$$search.outputs.$pendingMode)).toBeNull();
    expect(screen.getByRole("tab", { name: "Текст" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText(INPUT_LABELS.text)).toHaveValue("Хакер");
  });
});
