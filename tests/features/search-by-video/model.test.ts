import { invoke } from "@withease/factories";
import { allSettled, createEvent, createStore, fork, sample, scopeBind } from "effector";
import { describe, expect, it, vi } from "vitest";

import {
  checkVideo,
  createSearchByVideoFactory,
  videoCheckMessages,
  type VideoCheckResult,
  videoSearchTexts,
} from "@/features/search-by-video";

import { transportFx } from "@/shared/api";
import { TransportError } from "@/shared/api/transport/errors";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";

const video = (name = "scene.mp4") => new File(["video"], name, { type: "video/mp4" });

const movie = { movie_id: 27205, title: "Начало", year: 2010, poster_url: null, overview: "Сны" };

type CheckCall = { files: File[]; resolve: (result: VideoCheckResult) => void };

const setup = ({ manualChecks = false, durationSeconds = 24 } = {}) => {
  const accessChanged = createEvent<boolean>();
  const $allowed = createStore(true);

  sample({ clock: accessChanged, target: $allowed });

  const model = invoke(createSearchByVideoFactory, { $allowed });
  const controlled = createControlledTransport();
  const checks: CheckCall[] = [];
  const check = vi.fn(({ files }: { files: File[] }) =>
    manualChecks
      ? new Promise<VideoCheckResult>((resolve) => checks.push({ files, resolve }))
      : checkVideo(files, async () => durationSeconds),
  );
  const scope = fork({
    handlers: [
      [transportFx, controlled.transport],
      [model.__.checkFx, check],
    ],
  });
  const state = () => scope.getState(model.outputs.$state);
  const select = async (files: File[]) => {
    if (manualChecks) scopeBind(model.inputs.filesSelected, { scope })(files);
    else await allSettled(model.inputs.filesSelected, { scope, params: files });
  };
  const press = () => scopeBind(model.inputs.searchPressed, { scope })();
  const cancel = () => scopeBind(model.inputs.cancelled, { scope })();

  return { model, scope, controlled, check, checks, state, select, press, cancel, accessChanged };
};

const startSearch = async (context: ReturnType<typeof setup>) => {
  await context.select([video()]);
  context.press();
  await context.controlled.waitForCalls(context.controlled.calls.length + 1);
  return context.controlled.current();
};

describe("video search model", () => {
  it("checks the file on selection without sending it", async () => {
    const { select, state, controlled, check } = setup();
    await select([video()]);
    expect(state().check).toEqual({ status: "valid", durationSeconds: 24 });
    expect(state()).toMatchObject({ stage: "idle", error: null, result: null });
    expect(check).toHaveBeenCalledOnce();
    expect(controlled.calls).toHaveLength(0);
  });

  it("marks a long fragment invalid on selection and shows the check text only after pressing search", async () => {
    const context = setup({ durationSeconds: 47 });
    await context.select([video()]);
    expect(context.state().check).toEqual({ status: "invalid", reason: "tooLong", durationSeconds: 47 });
    expect(context.state().error).toBeNull();
    context.press();
    await allSettled(context.scope);
    expect(context.state()).toMatchObject({
      error: videoCheckMessages.tooLong,
      errorKind: "file",
      durationSeconds: 47,
      files: [expect.any(File)],
      stage: "idle",
    });
    expect(context.controlled.calls).toHaveLength(0);
    expect(context.scope.getState(context.model.outputs.$pending)).toBe(false);
  });

  it("asks to add a video when search is pressed without a file", async () => {
    const context = setup();
    context.press();
    await allSettled(context.scope);
    expect(context.state()).toMatchObject({ error: videoCheckMessages.missing, errorKind: "missing" });
    expect(context.controlled.calls).toHaveLength(0);
  });

  it("re-checks before sending and goes through uploading, processing and done", async () => {
    const context = setup({ manualChecks: true });
    const { select, press, checks, state, scope, model, controlled } = context;
    const file = video();
    await select([file]);
    checks[0].resolve({ ok: true, file, durationSeconds: 24 });
    await allSettled(scope);
    press();
    expect(state().stage).toBe("validating");
    expect(scope.getState(model.outputs.$pending)).toBe(true);
    expect(checks).toHaveLength(2);
    expect(controlled.calls).toHaveLength(0);
    checks[1].resolve({ ok: true, file, durationSeconds: 24 });
    await controlled.waitForCalls(1);
    const call = controlled.current();
    expect(call.request.path).toBe("/search/video");
    expect(state()).toMatchObject({ stage: "uploading", progress: 0 });
    call.request.onUploadProgress?.(null as unknown as number);
    expect(state().progress).toBeNull();
    call.request.onUploadProgress?.(0.64);
    expect(state().progress).toBe(64);
    call.request.onUploadComplete?.();
    expect(state().stage).toBe("processing");
    call.resolve(jsonResponse(200, { results: [movie] }));
    await allSettled(scope);
    expect(state()).toMatchObject({ stage: "done", result: movie, isEmpty: false, error: null });
    expect(scope.getState(model.outputs.$pending)).toBe(false);
  });

  it("empty response is not an error", async () => {
    const context = setup();
    const call = await startSearch(context);
    call.resolve(jsonResponse(200, { results: [] }));
    await allSettled(context.scope);
    expect(context.state()).toMatchObject({ isEmpty: true, error: null, result: null });
  });

  it.each([
    ["SEARCH_UNAVAILABLE", jsonResponse(503, { code: "SEARCH_UNAVAILABLE", message: "x", field: null })],
    ["SERVER_BUSY", jsonResponse(503, { code: "SERVER_BUSY", message: "x", field: null })],
    ["NGINX_502", jsonResponse(502, "<html>Bad Gateway</html>", { "Content-Type": "text/html" })],
    ["504 HTML", jsonResponse(504, "<html>Gateway Timeout</html>", { "Content-Type": "text/html" })],
    ["504 JSON", jsonResponse(504, { code: "GATEWAY_TIMEOUT", message: "x", field: null })],
  ])("%s shows the unavailable block text and keeps the file", async (_, response) => {
    const context = setup();
    const call = await startSearch(context);
    call.resolve(response);
    await allSettled(context.scope);
    expect(context.state()).toMatchObject({
      errorKind: "unavailable",
      error: videoSearchTexts.unavailableText,
      files: [expect.any(File)],
    });
  });

  it.each([
    ["VIDEO_TOO_LONG", 422, "tooLong", videoCheckMessages.tooLong],
    ["FILE_CORRUPTED", 422, "corrupted", videoCheckMessages.corrupted],
    ["FILE_TOO_LARGE", 413, "tooLarge", "Сообщение сервера как есть"],
    ["UNSUPPORTED_FORMAT", 415, "format", "Сообщение сервера как есть"],
    ["FILE_REQUIRED", 400, "missing", "Сообщение сервера как есть"],
    ["TOO_MANY_FILES", 400, "multiple", "Сообщение сервера как есть"],
  ])("server rejection %s marks the file invalid and keeps its duration", async (code, status, reason, message) => {
    const context = setup();
    const call = await startSearch(context);
    call.resolve(jsonResponse(status, { code, message: "Сообщение сервера как есть", field: null }));
    await allSettled(context.scope);
    expect(context.state()).toMatchObject({
      errorKind: "file",
      error: message,
      check: { status: "invalid", reason, durationSeconds: 24 },
      durationSeconds: 24,
      files: [expect.any(File)],
    });
  });

  it("server failure keeps the file valid and offers a retry", async () => {
    const context = setup();
    const call = await startSearch(context);
    call.resolve(jsonResponse(500, { code: "INTERNAL_ERROR", message: "Сообщение сервера как есть", field: null }));
    await allSettled(context.scope);
    expect(context.state()).toMatchObject({
      errorKind: "server",
      error: "Сообщение сервера как есть",
      check: { status: "valid", durationSeconds: 24 },
    });
    context.press();
    await context.controlled.waitForCalls(2);
  });

  it.each(["network", "timeout"] as const)("%s failure is a server error with the client text", async (kind) => {
    const context = setup();
    const call = await startSearch(context);
    call.reject(new TransportError(kind));
    await allSettled(context.scope);
    expect(context.state().errorKind).toBe("server");
    expect(context.state().error).toMatch(kind === "network" ? /связаться с сервером/ : /долго не отвечает/);
  });

  it.each([
    [{ "Retry-After": "30" }, "Слишком много запросов. Подождите 30 секунд и попробуйте снова."],
    [{ "Retry-After": "1" }, "Слишком много запросов. Подождите 1 секунду и попробуйте снова."],
    [{ "Retry-After": "120" }, "Слишком много запросов. Подождите 120 секунд и попробуйте снова."],
    [{ "Retry-After": "0" }, "Слишком много запросов. Подождите минуту и попробуйте снова."],
    [{}, "Слишком много запросов. Подождите минуту и попробуйте снова."],
  ])("rate limit uses Retry-After %o and keeps search available", async (headers, message) => {
    const context = setup();
    const call = await startSearch(context);
    call.resolve(jsonResponse(429, { code: "RATE_LIMITED", message: "x", field: null }, headers));
    await allSettled(context.scope);
    expect(context.state()).toMatchObject({ error: message, errorKind: "server" });
    expect(context.scope.getState(context.model.outputs.$pending)).toBe(false);
    context.press();
    await context.controlled.waitForCalls(2);
  });

  it("expired session is left to the API client and shows no error", async () => {
    const context = setup();
    const call = await startSearch(context);
    call.resolve(jsonResponse(401, { code: "SESSION_EXPIRED", message: "x", field: null }));
    await allSettled(context.scope);
    expect(context.state()).toMatchObject({ stage: "idle", error: null, result: null });
  });

  it("cancel during the check drops the late result", async () => {
    const context = setup({ manualChecks: true });
    const file = video();
    await context.select([file]);
    context.checks[0].resolve({ ok: true, file, durationSeconds: 24 });
    await allSettled(context.scope);
    context.press();
    expect(context.scope.getState(context.model.outputs.$pending)).toBe(true);
    context.cancel();
    expect(context.scope.getState(context.model.outputs.$pending)).toBe(false);
    context.checks[1].resolve({ ok: true, file, durationSeconds: 24 });
    await allSettled(context.scope);
    expect(context.controlled.calls).toHaveLength(0);
    expect(context.state().check).toEqual({ status: "valid", durationSeconds: 24 });
  });

  it.each(["uploading", "processing"])("cancel during %s aborts the request and ignores its answer", async (stage) => {
    const context = setup();
    const call = await startSearch(context);
    if (stage === "processing") call.request.onUploadComplete?.();
    expect(context.state().stage).toBe(stage);
    context.cancel();
    expect(call.request.signal?.aborted).toBe(true);
    call.resolve(jsonResponse(200, { results: [movie] }));
    await allSettled(context.scope);
    expect(context.state()).toMatchObject({ stage: "idle", result: null, files: [expect.any(File)] });
  });

  it("replacing the file during a check discards the old check", async () => {
    const context = setup({ manualChecks: true });
    const first = video("first.mp4");
    const second = video("second.mp4");
    await context.select([first]);
    await context.select([second]);
    context.checks[1].resolve({ ok: true, file: second, durationSeconds: 10 });
    context.checks[0].resolve({ ok: false, reason: "tooLong" });
    await allSettled(context.scope);
    expect(context.state().check).toEqual({ status: "valid", durationSeconds: 10 });
  });

  it("replacing the file during a request aborts it and hides the old answer", async () => {
    const context = setup();
    const call = await startSearch(context);
    await context.select([video("other.mp4")]);
    expect(call.request.signal?.aborted).toBe(true);
    call.resolve(jsonResponse(200, { results: [movie] }));
    await allSettled(context.scope);
    expect(context.state()).toMatchObject({ stage: "idle", result: null });
    expect(context.state().files[0].name).toBe("other.mp4");
  });

  it("losing access cancels the search and keeps the selected file", async () => {
    const context = setup();
    const call = await startSearch(context);
    scopeBind(context.accessChanged, { scope: context.scope })(false);
    expect(call.request.signal?.aborted).toBe(true);
    expect(context.scope.getState(context.model.outputs.$pending)).toBe(false);
    expect(context.state().files).toHaveLength(1);
  });

  it("removing the file clears the check status", async () => {
    const context = setup();
    await context.select([video()]);
    await context.select([]);
    expect(context.state().check).toEqual({ status: "idle" });
  });
});
