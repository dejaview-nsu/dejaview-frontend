import { invoke } from "@withease/factories";
import { allSettled, createWatch, fork, scopeBind } from "effector";
import { describe, expect, it, vi } from "vitest";

import {
  ApiError,
  createFileSearchFactory,
  type FileSearchMode,
  isSearchUnavailableError,
  transportFx,
} from "@/shared/api";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";

const found = {
  results: [
    {
      movie_id: 27205,
      title: "Начало",
      year: 2010,
      poster_url: "https://image.tmdb.org/t/p/w500/poster-27205.jpg",
      overview: "Кобб крадет идеи из снов, а теперь должен внедрить идею в чужое подсознание.",
    },
  ],
};

const fileCorrupted = {
  code: "FILE_CORRUPTED",
  message: "Невозможно выполнить поиск по видеофрагменту: файл поврежден или не может быть обработан",
  field: "file",
};

const videoFile = () => new File(["video"], "scene.mp4", { type: "video/mp4" });

const setup = (mode: FileSearchMode = "video", { ignoreAbort = false } = {}) => {
  const $$search = invoke(createFileSearchFactory, { mode });
  const controlled = createControlledTransport({ ignoreAbort });
  const scope = fork({ handlers: [[transportFx, controlled.transport]] });
  const succeeded = vi.fn();
  const failed = vi.fn();

  const stages: string[] = [];

  createWatch({ unit: $$search.outputs.succeeded, scope, fn: succeeded });
  createWatch({ unit: $$search.outputs.failed, scope, fn: failed });
  createWatch({ unit: $$search.outputs.$stage, scope, fn: (stage) => stages.push(stage) });

  const start = scopeBind($$search.inputs.started, { scope });
  const cancel = scopeBind($$search.inputs.cancelled, { scope });

  const state = () => ({
    stage: scope.getState($$search.outputs.$stage),
    progress: scope.getState($$search.outputs.$progress),
    results: scope.getState($$search.outputs.$results),
    isEmpty: scope.getState($$search.outputs.$isEmpty),
    error: scope.getState($$search.outputs.$error),
  });

  const startSearch = async (file = videoFile()) => {
    const count = controlled.calls.length;

    start(file);
    await controlled.waitForCalls(count + 1);

    return controlled.current();
  };

  const finishWith = async (response: ReturnType<typeof jsonResponse>) => {
    const call = controlled.current();

    call.request.onUploadComplete?.();
    call.resolve(response);
    await allSettled(scope);
  };

  return { scope, controlled, succeeded, failed, stages, start, cancel, state, startSearch, finishWith };
};

describe("file search request", () => {
  it.each([
    ["video", "/search/video", { upload: 90_000, response: 30_000 }],
    ["image", "/search/image", { upload: 15_000, response: 20_000 }],
  ] as const)("%s mode sends one file as multipart to %s", async (mode, path, timeouts) => {
    const { startSearch, finishWith } = setup(mode);
    const file = videoFile();

    const { request } = await startSearch(file);

    expect(request.method).toBe("POST");
    expect(request.path).toBe(path);
    expect(request.timeouts).toEqual(timeouts);
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).getAll("file")).toEqual([file]);

    await finishWith(jsonResponse(200, { results: [] }));
  });
});

describe("file search stages and progress", () => {
  it("goes uploading → processing → done with progress", async () => {
    const { startSearch, state, succeeded, failed } = setup();

    const { request, resolve } = await startSearch();

    expect(state()).toMatchObject({ stage: "uploading", progress: 0 });

    request.onUploadProgress?.(0.25);
    expect(state()).toMatchObject({ stage: "uploading", progress: 25 });

    request.onUploadProgress?.(0.5);
    expect(state().progress).toBe(50);

    request.onUploadComplete?.();
    expect(state()).toMatchObject({ stage: "processing", progress: 100 });

    resolve(jsonResponse(200, found));
    await vi.waitFor(() => expect(state().stage).toBe("done"));

    expect(state()).toMatchObject({ results: found.results, isEmpty: false, error: null });
    expect(succeeded).toHaveBeenCalledWith(found.results);
    expect(failed).not.toHaveBeenCalled();
  });

  it("progress is null while total size is unknown", async () => {
    const { startSearch, finishWith, state } = setup();

    const { request } = await startSearch();
    request.onUploadProgress?.(null);

    expect(state()).toMatchObject({ stage: "uploading", progress: null });

    request.onUploadComplete?.();
    expect(state()).toMatchObject({ stage: "processing", progress: 100 });

    await finishWith(jsonResponse(200, { results: [] }));
  });

  it("empty results are done, not an error", async () => {
    const { startSearch, finishWith, state, failed } = setup();

    await startSearch();
    await finishWith(jsonResponse(200, { results: [] }));

    expect(state()).toMatchObject({ stage: "done", results: [], isEmpty: true, error: null });
    expect(failed).not.toHaveBeenCalled();
  });
});

describe("file search errors", () => {
  it("file error from server is failed with server message", async () => {
    const { startSearch, finishWith, state, failed } = setup();

    await startSearch();
    await finishWith(jsonResponse(422, fileCorrupted));

    expect(state().stage).toBe("failed");
    expect(state().error).toBeInstanceOf(ApiError);
    expect(state().error).toMatchObject({ status: 422, ...fileCorrupted });
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "503 SEARCH_UNAVAILABLE",
      jsonResponse(503, { code: "SEARCH_UNAVAILABLE", message: "Поиск временно недоступен. Попробуйте позже" }),
    ],
    ["503 SERVER_BUSY", jsonResponse(503, { code: "SERVER_BUSY", message: "Сервис перегружен. Попробуйте позже" })],
    ["502 HTML from nginx", jsonResponse(502, "<html><body><h1>502 Bad Gateway</h1></body></html>")],
  ])("%s is failed with search unavailable error", async (_name, response) => {
    const { startSearch, finishWith, state, failed } = setup();

    await startSearch();
    await finishWith(response);

    expect(state().stage).toBe("failed");
    expect(isSearchUnavailableError(state().error)).toBe(true);
    expect(state().results).toBeNull();
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it("401 returns to idle without error and without failed", async () => {
    const { startSearch, finishWith, state, failed } = setup();

    await startSearch();
    await finishWith(
      jsonResponse(401, { code: "SESSION_EXPIRED", message: "Сессия истекла. Войдите снова", field: null }),
    );

    expect(state()).toMatchObject({ stage: "idle", error: null, results: null, progress: 0 });
    expect(failed).not.toHaveBeenCalled();
  });
});

describe("file search restart", () => {
  it.each([
    ["done", jsonResponse(200, found)],
    ["done and empty", jsonResponse(200, { results: [] })],
    ["failed", jsonResponse(422, fileCorrupted)],
  ])("started after %s resets state immediately", async (_name, response) => {
    const { startSearch, finishWith, state } = setup();

    const first = await startSearch();
    first.request.onUploadProgress?.(0.7);
    await finishWith(response);

    await startSearch();

    expect(state()).toMatchObject({ stage: "uploading", progress: 0, results: null, isEmpty: false, error: null });

    await finishWith(jsonResponse(200, { results: [] }));
  });
});

describe("file search cancel", () => {
  it("cancel during uploading aborts request and returns to idle without error", async () => {
    const { scope, startSearch, cancel, state, succeeded, failed } = setup();

    const { request } = await startSearch();
    request.onUploadProgress?.(0.4);

    cancel();
    await allSettled(scope);

    expect(request.signal?.aborted).toBe(true);
    expect(state()).toMatchObject({ stage: "idle", progress: 0, results: null, error: null });
    expect(failed).not.toHaveBeenCalled();
    expect(succeeded).not.toHaveBeenCalled();
  });

  it("cancel during processing aborts request and returns to idle without error", async () => {
    const { scope, startSearch, cancel, state, succeeded, failed } = setup();

    const { request } = await startSearch();
    request.onUploadComplete?.();
    expect(state().stage).toBe("processing");

    cancel();
    await allSettled(scope);

    expect(request.signal?.aborted).toBe(true);
    expect(state()).toMatchObject({ stage: "idle", progress: 0, results: null, error: null });
    expect(failed).not.toHaveBeenCalled();
    expect(succeeded).not.toHaveBeenCalled();
  });

  it("ignores late progress, upload end and response of a cancelled request", async () => {
    const { scope, startSearch, cancel, state, succeeded, failed } = setup("video", { ignoreAbort: true });

    const old = await startSearch();
    cancel();

    expect(old.request.signal?.aborted).toBe(true);
    expect(state().stage).toBe("idle");

    old.request.onUploadProgress?.(0.9);
    old.request.onUploadComplete?.();
    old.resolve(jsonResponse(200, found));
    await allSettled(scope);

    expect(state()).toMatchObject({ stage: "idle", progress: 0, results: null, error: null });
    expect(succeeded).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
  });

  it("new search during a running one aborts the old and never rolls back to idle", async () => {
    const { scope, startSearch, state, stages, succeeded, failed } = setup();

    const first = await startSearch();
    first.request.onUploadProgress?.(0.6);

    const second = await startSearch();

    expect(first.request.signal?.aborted).toBe(true);
    expect(state()).toMatchObject({ stage: "uploading", progress: 0 });

    first.request.onUploadProgress?.(0.95);
    first.request.onUploadComplete?.();
    expect(state()).toMatchObject({ stage: "uploading", progress: 0 });

    second.request.onUploadProgress?.(0.3);
    expect(state().progress).toBe(30);

    second.request.onUploadComplete?.();
    second.resolve(jsonResponse(200, found));
    await allSettled(scope);

    expect(state()).toMatchObject({ stage: "done", results: found.results, error: null });
    expect(stages).toEqual(["uploading", "processing", "done"]);
    expect(succeeded).toHaveBeenCalledTimes(1);
    expect(failed).not.toHaveBeenCalled();
  });

  it("cancel in idle changes nothing", async () => {
    const { scope, cancel, state, stages } = setup();

    cancel();
    await allSettled(scope);

    expect(state()).toMatchObject({ stage: "idle", progress: 0, results: null, error: null });
    expect(stages).toEqual([]);
  });

  it("cancel after done keeps the result", async () => {
    const { scope, startSearch, finishWith, cancel, state } = setup();

    await startSearch();
    await finishWith(jsonResponse(200, found));

    cancel();
    await allSettled(scope);

    expect(state()).toMatchObject({ stage: "done", progress: 100, results: found.results, error: null });
  });

  it("cancel after failed keeps the error", async () => {
    const { scope, startSearch, finishWith, cancel, state } = setup();

    await startSearch();
    await finishWith(jsonResponse(422, fileCorrupted));

    cancel();
    await allSettled(scope);

    expect(state().stage).toBe("failed");
    expect(state().error).toMatchObject(fileCorrupted);
  });
});
