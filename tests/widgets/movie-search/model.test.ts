import { createRoute, createRouter, historyAdapter } from "@effector/router";
import { invoke } from "@withease/factories";
import { allSettled, createEvent, createStore, createWatch, fork, sample, scopeBind } from "effector";
import { createMemoryHistory } from "history";
import { describe, expect, it, vi } from "vitest";

import { createMovieSearchFactory } from "@/widgets/movie-search";

import { fileConstraints } from "@/features/search-by-file";

import { type SessionStatus } from "@/entities/session";

import { transportFx } from "@/shared/api";
import { validateFileSelection } from "@/shared/lib/files";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";

const imageFile = () => new File(["image"], "frame.png", { type: "image/png" });
const videoFile = () => new File(["video"], "scene.mp4", { type: "video/mp4" });
const movie = { movie_id: 1, title: "Фильм", year: null, poster_url: null, overview: null };

const setup = async (status: SessionStatus = "authenticated", validate?: () => Promise<void>) => {
  const route = createRoute({ path: "/" });
  const other = createRoute({ path: "/other" });
  const router = createRouter({ routes: [route, other] });
  const statusChanged = createEvent<SessionStatus>();
  const $status = createStore<SessionStatus>(status);

  sample({ clock: statusChanged, target: $status });

  const home = invoke(createMovieSearchFactory, { $isActive: route.$isOpened, $sessionStatus: $status });
  const controlled = createControlledTransport();
  const scope = fork({
    handlers: [
      [transportFx, controlled.transport],
      [
        home.__.$$imageSearch.__.validateFx,
        validate ??
          (({ files }: { files: File[] }) => {
            validateFileSelection(files, fileConstraints.image);
          }),
      ],
      [
        home.__.$$videoSearch.__.validateFx,
        ({ files }: { files: File[] }) => {
          validateFileSelection(files, fileConstraints.video);
        },
      ],
    ],
  });
  await allSettled(router.setHistory, {
    scope,
    params: historyAdapter(createMemoryHistory({ initialEntries: ["/"] })),
  });
  return { route, other, router, home, scope, controlled, statusChanged };
};

const startImage = async ({ home, scope, controlled }: Awaited<ReturnType<typeof setup>>) => {
  await allSettled(home.inputs.modeSelected, { scope, params: "image" });
  await allSettled(home.inputs.filesSelected, { scope, params: { mode: "image", files: [imageFile()] } });
  scopeBind(home.inputs.searchPressed, { scope })();
  await controlled.waitForCalls(1);
  return controlled.current();
};

describe("movie search model", () => {
  it("opens immediately in text mode without a demonstration request", async () => {
    const { route, home, scope, controlled } = await setup("guest");
    expect(scope.getState(route.$isOpened)).toBe(true);
    expect(scope.getState(home.outputs.$mode)).toBe("text");
    expect(controlled.calls).toHaveLength(0);
  });

  it("guest media modes request login, text stays available", async () => {
    const { home, scope } = await setup("guest");
    const login = vi.fn();
    createWatch({ unit: home.outputs.loginRequested, scope, fn: login });
    for (const mode of ["image", "video", "audio"] as const)
      await allSettled(home.inputs.modeSelected, { scope, params: mode });
    await allSettled(home.inputs.modeSelected, { scope, params: "text" });
    expect(login).toHaveBeenCalledTimes(3);
    expect(scope.getState(home.outputs.$mode)).toBe("text");
  });

  it("preserves drafts independently across modes and leaving the page", async () => {
    const { home, scope, other } = await setup();
    const image = imageFile();
    const video = videoFile();
    await allSettled(home.inputs.textChanged, { scope, params: "Описание сцены" });
    await allSettled(home.inputs.filesSelected, { scope, params: { mode: "image", files: [image] } });
    await allSettled(home.inputs.filesSelected, { scope, params: { mode: "video", files: [video] } });
    for (const mode of ["image", "video", "audio", "text"] as const)
      await allSettled(home.inputs.modeSelected, { scope, params: mode });
    await allSettled(other.open, { scope, params: undefined });
    expect(scope.getState(home.outputs.$text)).toBe("Описание сцены");
    expect(scope.getState(home.outputs.$image).files).toEqual([image]);
    expect(scope.getState(home.outputs.$video).files).toEqual([video]);
  });

  it.each([[], [imageFile(), imageFile()], [videoFile()]])(
    "rejects invalid image selection without calling search",
    async (...files) => {
      const { home, scope, controlled } = await setup();
      await allSettled(home.inputs.modeSelected, { scope, params: "image" });
      await allSettled(home.inputs.filesSelected, { scope, params: { mode: "image", files } });
      await allSettled(home.inputs.searchPressed, { scope });
      expect(scope.getState(home.outputs.$image).error).toContain("Поиск не запущен");
      expect(controlled.calls).toHaveLength(0);
      expect(scope.getState(home.outputs.$pending)).toBe(false);
    },
  );

  it("shows upload, processing and one result; blocks duplicate starts", async () => {
    const context = await setup();
    const { home, scope, controlled } = context;
    const call = await startImage(context);
    expect(scope.getState(home.outputs.$pending)).toBe(true);
    call.request.onUploadProgress?.(0.5);
    expect(scope.getState(home.outputs.$image)).toMatchObject({ stage: "uploading", progress: 50 });
    expect(scope.getState(home.outputs.$progressMessage)).toBe("Загружаем файл: 50%");
    scopeBind(home.inputs.searchPressed, { scope })();
    expect(controlled.calls).toHaveLength(1);
    call.request.onUploadComplete?.();
    expect(scope.getState(home.outputs.$image).stage).toBe("processing");
    expect(scope.getState(home.outputs.$progressMessage)).toBe("Файл загружен. Ищем фильм…");
    scopeBind(home.inputs.modeSelected, { scope })("video");
    expect(scope.getState(home.outputs.$activeSearchMode)).toBe("image");
    expect(scope.getState(home.outputs.$hasSearchOutput)).toBe(true);
    call.resolve(jsonResponse(200, { results: [movie] }));
    await allSettled(scope);
    expect(scope.getState(home.outputs.$image).result).toEqual(movie);
    expect(scope.getState(home.outputs.$video).result).toBeNull();
    expect(scope.getState(home.outputs.$image).files).toHaveLength(1);
    expect(scope.getState(home.outputs.$pending)).toBe(false);
    expect(scope.getState(home.outputs.$results)).toBeNull();
    expect(scope.getState(home.outputs.$hasSearchOutput)).toBe(false);
    await allSettled(home.inputs.modeSelected, { scope, params: "image" });
    expect(scope.getState(home.outputs.$results)).toEqual([movie]);
    await allSettled(home.inputs.modeSelected, { scope, params: "text" });
    expect(scope.getState(home.outputs.$results)).toBeNull();
    expect(scope.getState(home.outputs.$error)).toBeNull();
    expect(scope.getState(home.outputs.$isStubMode)).toBe(false);
  });

  it.each(["empty", "unavailable"])("handles %s and allows replacing file and retrying", async (kind) => {
    const context = await setup();
    const { home, scope, controlled } = context;
    const call = await startImage(context);
    call.resolve(
      kind === "empty"
        ? jsonResponse(200, { results: [] })
        : jsonResponse(503, { code: "SEARCH_UNAVAILABLE", message: "Поиск временно недоступен" }),
    );
    await allSettled(scope);
    expect(scope.getState(home.outputs.$image).result).toBeNull();
    if (kind === "empty") expect(scope.getState(home.outputs.$image).isEmpty).toBe(true);
    else expect(scope.getState(home.outputs.$image).error).toContain("временно недоступен");
    await allSettled(home.inputs.filesSelected, { scope, params: { mode: "image", files: [imageFile()] } });
    expect(scope.getState(home.outputs.$image)).toMatchObject({ error: null, isEmpty: false });
    scopeBind(home.inputs.searchPressed, { scope })();
    await controlled.waitForCalls(2);
    controlled.current().resolve(jsonResponse(200, { results: [movie] }));
    await allSettled(scope);
    expect(scope.getState(home.outputs.$image).result).toEqual(movie);
  });

  it.each(["leave", "logout", "cancel"])("%s cancels upload and keeps the file", async (action) => {
    const context = await setup();
    const { home, scope, other, statusChanged } = context;
    const call = await startImage(context);
    if (action === "leave") await allSettled(other.open, { scope, params: undefined });
    if (action === "logout") await allSettled(statusChanged, { scope, params: "guest" });
    if (action === "cancel") await allSettled(home.inputs.searchCancelled, { scope });
    expect(call.request.signal?.aborted).toBe(true);
    expect(scope.getState(home.outputs.$pending)).toBe(false);
    expect(scope.getState(home.outputs.$image).files).toHaveLength(1);
    if (action === "logout") expect(scope.getState(home.outputs.$mode)).toBe("text");
  });

  it("ignores late validation after replacing file or leaving page", async () => {
    let finish!: () => void;
    const context = await setup(
      "authenticated",
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { home, scope, controlled, other } = context;
    await allSettled(home.inputs.modeSelected, { scope, params: "image" });
    await allSettled(home.inputs.filesSelected, { scope, params: { mode: "image", files: [imageFile()] } });
    scopeBind(home.inputs.searchPressed, { scope })();
    await vi.waitFor(() => expect(finish).toBeDefined());
    scopeBind(home.inputs.filesSelected, { scope })({ mode: "image", files: [imageFile()] });
    scopeBind(other.open, { scope })();
    finish();
    await allSettled(scope);
    expect(controlled.calls).toHaveLength(0);
    expect(scope.getState(home.outputs.$pending)).toBe(false);
  });
});
