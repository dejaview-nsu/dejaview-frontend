import { API_BASE_URL } from "../config";
import { createAbortError, TransportError } from "./errors";
import type { Transport } from "./types";

const serializeBody = (body: unknown): { payload: XMLHttpRequestBodyInit | null; isJson: boolean } => {
  if (body === undefined) {
    return { payload: null, isJson: false };
  }

  if (body instanceof FormData) {
    return { payload: body, isJson: false };
  }

  return { payload: JSON.stringify(body), isJson: true };
};

export const xhrTransport: Transport = (request) =>
  new Promise((resolve, reject) => {
    if (request.signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const xhr = new XMLHttpRequest();
    const { payload, isJson } = serializeBody(request.body);
    const { upload: uploadTimeout, response: responseTimeout } = request.timeouts;
    const hasUploadPhase = uploadTimeout !== undefined;
    let isUploaded = !hasUploadPhase;

    const handleTimeout = () => {
      xhr.abort();
      fail(new TransportError("timeout"));
    };

    let timer = setTimeout(handleTimeout, uploadTimeout ?? responseTimeout);

    const cleanup = () => {
      clearTimeout(timer);
      request.signal?.removeEventListener("abort", handleAbort);
    };

    const fail = (error: unknown) => {
      cleanup();
      reject(error);
    };

    function handleAbort() {
      xhr.abort();
      fail(createAbortError());
    }

    const markUploaded = () => {
      if (isUploaded) {
        return;
      }

      isUploaded = true;
      clearTimeout(timer);
      timer = setTimeout(handleTimeout, responseTimeout);
      request.onUploadComplete?.();
    };

    xhr.open(request.method, `${API_BASE_URL}${request.path}`);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");

    if (isJson) {
      xhr.setRequestHeader("Content-Type", "application/json");
    }

    if (hasUploadPhase) {
      xhr.upload.addEventListener("progress", (event) => {
        request.onUploadProgress?.(event.lengthComputable && event.total > 0 ? event.loaded / event.total : null);
      });
      xhr.upload.addEventListener("load", markUploaded);
      xhr.addEventListener("readystatechange", () => {
        if (xhr.readyState >= XMLHttpRequest.HEADERS_RECEIVED) {
          markUploaded();
        }
      });
    }

    xhr.addEventListener("load", () => {
      markUploaded();
      cleanup();
      resolve({
        status: xhr.status,
        bodyText: xhr.responseText,
        getHeader: (name) => xhr.getResponseHeader(name),
      });
    });

    xhr.addEventListener("error", () => fail(new TransportError("network")));

    request.signal?.addEventListener("abort", handleAbort);

    xhr.send(payload);
  });
