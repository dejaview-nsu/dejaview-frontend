import { invoke } from "@withease/factories";
import { createWatch, type Store } from "effector";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  createFileSearchFactory,
  type FileSearchStage,
  isAbortError,
  type MovieSearchResult,
  searchByFile,
} from "@/shared/api";

import { FakeXMLHttpRequest } from "../../fake-xhr";

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

const videoFile = () => new File(["video"], "scene.mp4", { type: "video/mp4" });

const track = <Value>($store: Store<Value>, initial: Value) => {
  const latest = { value: initial };

  createWatch({
    unit: $store,
    fn: (value) => {
      latest.value = value;
    },
  });

  return latest;
};

const setup = () => {
  const $$search = invoke(createFileSearchFactory, { mode: "video" });
  const failed = vi.fn();
  const succeeded = vi.fn();

  createWatch({ unit: $$search.outputs.failed, fn: failed });
  createWatch({ unit: $$search.outputs.succeeded, fn: succeeded });

  return {
    $$search,
    failed,
    succeeded,
    stage: track<FileSearchStage>($$search.outputs.$stage, "idle"),
    progress: track<number | null>($$search.outputs.$progress, 0),
    results: track<MovieSearchResult[] | null>($$search.outputs.$results, null),
    error: track<ApiError | null>($$search.outputs.$error, null),
  };
};

const waitForXhr = async (count = 1) => {
  await vi.waitFor(() => expect(FakeXMLHttpRequest.instances).toHaveLength(count));

  return FakeXMLHttpRequest.last();
};

beforeEach(() => {
  FakeXMLHttpRequest.reset();
  vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("file search without scope", () => {
  it("reports progress and stages through XMLHttpRequest", async () => {
    const { $$search, stage, progress, results } = setup();

    $$search.inputs.started(videoFile());
    const xhr = await waitForXhr();

    expect(xhr.url).toBe("/api/v1/search/video");
    expect(stage.value).toBe("uploading");

    xhr.progressUpload(30, 100);
    expect(progress.value).toBe(30);

    xhr.progressUpload(0, 0, false);
    expect(progress.value).toBeNull();

    xhr.finishUpload();
    expect(stage.value).toBe("processing");
    expect(progress.value).toBe(100);

    xhr.respond(200, JSON.stringify(found));
    await vi.waitFor(() => expect(stage.value).toBe("done"));

    expect(results.value).toEqual(found.results);
  });

  it.each([
    ["uploading", (xhr: FakeXMLHttpRequest) => xhr.progressUpload(40, 100)],
    ["processing", (xhr: FakeXMLHttpRequest) => xhr.finishUpload()],
  ])("cancel during %s aborts XMLHttpRequest", async (expectedStage, advance) => {
    const { $$search, stage, progress, error, failed, succeeded } = setup();

    $$search.inputs.started(videoFile());
    const xhr = await waitForXhr();

    advance(xhr);
    expect(stage.value).toBe(expectedStage);

    $$search.inputs.cancelled();

    expect(xhr.aborted).toBe(true);
    expect(stage.value).toBe("idle");
    expect(progress.value).toBe(0);
    expect(error.value).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(failed).not.toHaveBeenCalled();
    expect(succeeded).not.toHaveBeenCalled();
  });

  it.each([
    [
      "TIMEOUT",
      () => {
        vi.advanceTimersByTime(90_000);
      },
    ],
    ["NETWORK_ERROR", () => FakeXMLHttpRequest.last().failNetwork()],
  ])("%s during uploading fails without passing through processing", async (code, breakUpload) => {
    vi.useFakeTimers();
    const { $$search, progress, error } = setup();
    const stages: FileSearchStage[] = [];

    createWatch({ unit: $$search.outputs.$stage, fn: (value) => stages.push(value) });

    $$search.inputs.started(videoFile());
    const xhr = await waitForXhr();

    xhr.progressUpload(40, 100);
    breakUpload();

    await vi.waitFor(() => expect(stages.at(-1)).toBe("failed"));

    expect(stages).not.toContain("processing");
    expect(progress.value).toBe(40);
    expect(error.value).toMatchObject({ code });
  });
});

describe("searchByFile abort", () => {
  it("rejects with AbortError and clears timers", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();

    const promise = searchByFile({ mode: "image", file: videoFile(), signal: controller.signal });
    const xhr = await waitForXhr();

    expect(vi.getTimerCount()).toBe(1);

    controller.abort();

    const error = await promise.catch((reason: unknown) => reason);

    expect(isAbortError(error)).toBe(true);
    expect(error).not.toBeInstanceOf(ApiError);
    expect(xhr.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("abort during upload does not report processing", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const controller = new AbortController();

    const promise = searchByFile({
      mode: "video",
      file: videoFile(),
      signal: controller.signal,
      onUploadProgress: (fraction) => console.log("загрузка", fraction),
      onUploadComplete: () => console.log("обработка…"),
    });
    const xhr = await waitForXhr();

    xhr.progressUpload(40, 100);
    controller.abort();

    const error = await promise.catch((reason: unknown) => reason);

    expect(isAbortError(error)).toBe(true);
    expect(log.mock.calls).toEqual([["загрузка", 0.4]]);

    log.mockRestore();
  });
});
