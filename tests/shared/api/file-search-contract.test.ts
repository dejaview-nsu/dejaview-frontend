import { invoke } from "@withease/factories";
import { allSettled, createWatch, fork } from "effector";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFileSearchFactory, sessionRequired, transportFx } from "@/shared/api";
import { xhrTransport } from "@/shared/api/transport/xhr";

import { FakeXMLHttpRequest } from "../../fake-xhr";
import contract from "./fixtures/file-search-contract.json";

beforeEach(() => {
  FakeXMLHttpRequest.reset();
  vi.stubGlobal("XMLHttpRequest", FakeXMLHttpRequest);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each(["image", "video"] as const)("%s search API contract", (mode) => {
  const { path, responses } = contract[mode];

  it.each(responses)("handles $status $name through the HTTP transport", async (example) => {
    const $$request = invoke(createFileSearchFactory, { mode });
    const scope = fork({ handlers: [[transportFx, xhrTransport]] });
    const requireLogin = vi.fn();
    createWatch({ unit: sessionRequired, scope, fn: requireLogin });
    const file = new File(["media"], mode === "image" ? "frame.jpg" : "scene.mp4", {
      type: contract[mode].mimeTypes[0],
    });

    const completed = allSettled($$request.inputs.started, { scope, params: file });
    await vi.waitFor(() => expect(FakeXMLHttpRequest.instances).toHaveLength(1));
    const xhr = FakeXMLHttpRequest.last();

    expect(xhr.method).toBe("POST");
    expect(xhr.url).toBe(`/api/v1${path}`);
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.requestHeaders).toEqual({ Accept: "application/json" });
    expect(xhr.body).toBeInstanceOf(FormData);
    expect([...(xhr.body as FormData).keys()]).toEqual(["file"]);
    expect((xhr.body as FormData).getAll("file")).toEqual([file]);

    xhr.finishUpload();
    expect(scope.getState($$request.outputs.$stage)).toBe("processing");
    xhr.respond(example.status, JSON.stringify(example.body), "headers" in example ? example.headers : undefined);
    await completed;

    if (example.status === 200 && "results" in example.body) {
      expect(scope.getState($$request.outputs.$stage)).toBe("done");
      expect(scope.getState($$request.outputs.$results)).toEqual(example.body.results);
      expect(scope.getState($$request.outputs.$isEmpty)).toBe(example.body.results?.length === 0);
      expect(scope.getState($$request.outputs.$error)).toBeNull();
    } else if (example.status === 401) {
      expect(scope.getState($$request.outputs.$stage)).toBe("idle");
      expect(scope.getState($$request.outputs.$error)).toBeNull();
      expect(scope.getState($$request.outputs.$results)).toBeNull();
      expect(requireLogin).toHaveBeenCalledExactlyOnceWith(expect.objectContaining(example.body));
    } else {
      expect(scope.getState($$request.outputs.$stage)).toBe("failed");
      expect(scope.getState($$request.outputs.$results)).toBeNull();
      expect(scope.getState($$request.outputs.$error)).toMatchObject({ status: example.status, ...example.body });

      if ("headers" in example && example.headers) {
        expect(scope.getState($$request.outputs.$error)?.retryAfter).toBe(Number(example.headers["Retry-After"]));
      }
    }
  });
});
