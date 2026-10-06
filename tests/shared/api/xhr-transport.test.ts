import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TransportError } from "@/shared/api/transport/errors";
import { xhrTransport } from "@/shared/api/transport/xhr";

import { FakeXMLHttpRequest } from "../../fake-xhr";

beforeEach(() => {
  FakeXMLHttpRequest.reset();
  vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("xhr transport", () => {
  it("sends GET to /api/v1 with credentials and Accept header", async () => {
    const promise = xhrTransport({ method: "GET", path: "/auth/session", timeouts: { response: 1000 } });
    const xhr = FakeXMLHttpRequest.last();

    expect(xhr.method).toBe("GET");
    expect(xhr.url).toBe("/api/v1/auth/session");
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.requestHeaders).toEqual({ Accept: "application/json" });
    expect(xhr.body).toBeNull();

    xhr.respond(200, '{"ok":true}', { "Retry-After": "5" });
    const response = await promise;

    expect(response.status).toBe(200);
    expect(response.bodyText).toBe('{"ok":true}');
    expect(response.getHeader("retry-after")).toBe("5");
  });

  it("sends JSON body with Content-Type", async () => {
    const promise = xhrTransport({
      method: "POST",
      path: "/auth/login",
      body: { login: "movie_fan_42", password: "Kino#2026" },
      timeouts: { response: 1000 },
    });
    const xhr = FakeXMLHttpRequest.last();

    expect(xhr.requestHeaders["Content-Type"]).toBe("application/json");
    expect(xhr.body).toBe('{"login":"movie_fan_42","password":"Kino#2026"}');

    xhr.respond(204, "");

    await expect(promise).resolves.toMatchObject({ status: 204 });
  });

  it("sends FormData as is without Content-Type", async () => {
    const formData = new FormData();
    formData.append("file", new File(["x"], "frame.jpg", { type: "image/jpeg" }));

    const promise = xhrTransport({
      method: "POST",
      path: "/search/image",
      body: formData,
      timeouts: { response: 1000 },
    });
    const xhr = FakeXMLHttpRequest.last();

    expect(xhr.body).toBe(formData);
    expect(xhr.requestHeaders["Content-Type"]).toBeUndefined();

    xhr.respond(200, '{"results":[]}');
    await promise;
  });

  it("returns error statuses as a response", async () => {
    const promise = xhrTransport({ method: "GET", path: "/auth/session", timeouts: { response: 1000 } });

    FakeXMLHttpRequest.last().respond(401, '{"code":"SESSION_REQUIRED","message":"Войдите, чтобы продолжить"}');

    await expect(promise).resolves.toMatchObject({ status: 401 });
  });

  it("rejects with network TransportError", async () => {
    const promise = xhrTransport({ method: "GET", path: "/auth/session", timeouts: { response: 1000 } });

    FakeXMLHttpRequest.last().failNetwork();

    await expect(promise).rejects.toEqual(new TransportError("network"));
  });

  it("rejects with timeout TransportError and aborts xhr", async () => {
    vi.useFakeTimers();
    const promise = xhrTransport({ method: "GET", path: "/auth/session", timeouts: { response: 1000 } });
    const xhr = FakeXMLHttpRequest.last();

    vi.advanceTimersByTime(1000);

    await expect(promise).rejects.toMatchObject({ name: "TransportError", kind: "timeout" });
    expect(xhr.aborted).toBe(true);
  });

  it("reports upload progress as a fraction or null when size is unknown", async () => {
    const onUploadProgress = vi.fn();
    const promise = xhrTransport({
      method: "POST",
      path: "/search/video",
      body: new FormData(),
      timeouts: { upload: 1000, response: 1000 },
      onUploadProgress,
    });
    const xhr = FakeXMLHttpRequest.last();

    xhr.progressUpload(25, 100);
    xhr.progressUpload(0, 0, false);
    xhr.respond(200, '{"results":[]}');
    await promise;

    expect(onUploadProgress.mock.calls).toEqual([[0.25], [null]]);
  });

  it("calls onUploadComplete once when the body is sent", async () => {
    const onUploadComplete = vi.fn();
    const promise = xhrTransport({
      method: "POST",
      path: "/search/video",
      body: new FormData(),
      timeouts: { upload: 1000, response: 1000 },
      onUploadComplete,
    });
    const xhr = FakeXMLHttpRequest.last();

    xhr.finishUpload();
    xhr.receiveHeaders();
    xhr.respond(200, '{"results":[]}');
    await promise;

    expect(onUploadComplete).toHaveBeenCalledTimes(1);
  });

  it("treats received headers as the end of upload if upload load did not fire", async () => {
    const onUploadComplete = vi.fn();
    const promise = xhrTransport({
      method: "POST",
      path: "/search/image",
      body: new FormData(),
      timeouts: { upload: 1000, response: 1000 },
      onUploadComplete,
    });

    FakeXMLHttpRequest.last().receiveHeaders();

    expect(onUploadComplete).toHaveBeenCalledTimes(1);

    FakeXMLHttpRequest.last().respond(200, '{"results":[]}');
    await promise;
  });

  it("does not subscribe to upload events for requests without upload phase", async () => {
    const promise = xhrTransport({ method: "GET", path: "/auth/session", timeouts: { response: 1000 } });
    const xhr = FakeXMLHttpRequest.last();

    xhr.respond(200, "{}");
    await promise;

    expect(xhr.upload.listenedTypes).toEqual([]);
  });

  it("times out during upload by the upload timeout", async () => {
    vi.useFakeTimers();
    const promise = xhrTransport({
      method: "POST",
      path: "/search/video",
      body: new FormData(),
      timeouts: { upload: 1000, response: 5000 },
    });
    const xhr = FakeXMLHttpRequest.last();

    vi.advanceTimersByTime(1000);

    await expect(promise).rejects.toMatchObject({ kind: "timeout" });
    expect(xhr.aborted).toBe(true);
  });

  it("starts the response timeout after upload", async () => {
    vi.useFakeTimers();
    const onRejected = vi.fn();
    const promise = xhrTransport({
      method: "POST",
      path: "/search/video",
      body: new FormData(),
      timeouts: { upload: 1000, response: 5000 },
    });
    promise.catch(onRejected);
    const xhr = FakeXMLHttpRequest.last();

    vi.advanceTimersByTime(900);
    xhr.finishUpload();
    vi.advanceTimersByTime(4900);
    await Promise.resolve();

    expect(onRejected).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    await expect(promise).rejects.toMatchObject({ kind: "timeout" });
  });

  describe("failure during upload is not the end of upload", () => {
    const startUpload = (signal?: AbortSignal) => {
      const onUploadComplete = vi.fn();
      const promise = xhrTransport({
        method: "POST",
        path: "/search/video",
        body: new FormData(),
        timeouts: { upload: 1000, response: 5000 },
        signal,
        onUploadComplete,
      });
      const xhr = FakeXMLHttpRequest.last();

      xhr.progressUpload(40, 100);

      return { promise, xhr, onUploadComplete };
    };

    it("upload timeout", async () => {
      vi.useFakeTimers();
      const { promise, onUploadComplete } = startUpload();

      vi.advanceTimersByTime(1000);

      await expect(promise).rejects.toMatchObject({ kind: "timeout" });
      expect(onUploadComplete).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it("network failure", async () => {
      vi.useFakeTimers();
      const { promise, xhr, onUploadComplete } = startUpload();

      xhr.failNetwork();

      await expect(promise).rejects.toMatchObject({ kind: "network" });
      expect(onUploadComplete).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });

    it("abort", async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const { promise, onUploadComplete } = startUpload(controller.signal);

      controller.abort();

      await expect(promise).rejects.toMatchObject({ name: "AbortError" });
      expect(onUploadComplete).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  it("treats the final readystatechange of a response as the end of upload", async () => {
    const onUploadComplete = vi.fn();
    const promise = xhrTransport({
      method: "POST",
      path: "/search/image",
      body: new FormData(),
      timeouts: { upload: 1000, response: 1000 },
      onUploadComplete,
    });

    FakeXMLHttpRequest.last().respond(413, '{"code":"FILE_TOO_LARGE","message":"x"}');
    await promise;

    expect(onUploadComplete).toHaveBeenCalledTimes(1);
  });

  it("aborts xhr on signal", async () => {
    const controller = new AbortController();
    const promise = xhrTransport({
      method: "GET",
      path: "/auth/session",
      timeouts: { response: 1000 },
      signal: controller.signal,
    });

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeXMLHttpRequest.last().aborted).toBe(true);
  });
});
