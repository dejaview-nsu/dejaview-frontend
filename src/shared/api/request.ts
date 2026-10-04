import { onAbort } from "@farfetched/core";
import { createEffect, createEvent, sample } from "effector";
import type { z } from "zod";

import { JSON_REQUEST_TIMEOUT_MS } from "./config";
import { ApiError, createClientError, isSessionError } from "./errors";
import { parseResponse } from "./parse-response";
import { TransportError } from "./transport/errors";
import type { Transport, TransportRequest, TransportResponse } from "./transport/types";
import { xhrTransport } from "./transport/xhr";

export type UnauthorizedPolicy = "login" | "guest";

export type ApiRequest<Data> = Omit<TransportRequest, "timeouts"> & {
  timeouts?: TransportRequest["timeouts"];
  schema: z.ZodType<Data> | null;
  isSearch?: boolean;
  onUnauthorized?: UnauthorizedPolicy;
};

const resolveTransport = (): Promise<Transport> =>
  import.meta.env.VITE_API_MOCKS === "true"
    ? import("./mocks").then(({ mockTransport }) => mockTransport)
    : Promise.resolve(xhrTransport);

const toClientError = (error: unknown): unknown => {
  if (error instanceof TransportError) {
    return createClientError(error.kind === "timeout" ? "TIMEOUT" : "NETWORK_ERROR", 0);
  }

  return error;
};

export const transportFx = createEffect<TransportRequest, TransportResponse>(async (request) => {
  const transport = await resolveTransport();

  return transport(request);
});

export const requestFx = createEffect<ApiRequest<unknown>, unknown>(
  async ({ method, path, body, timeouts, signal, onUploadProgress, onUploadComplete, schema, isSearch }) => {
    const response = await transportFx({
      method,
      path,
      body,
      timeouts: timeouts ?? { response: JSON_REQUEST_TIMEOUT_MS },
      signal,
      onUploadProgress,
      onUploadComplete,
    }).catch((error: unknown) => {
      throw toClientError(error);
    });

    return parseResponse(response, schema, { isSearch });
  },
);

export const sessionRequired = createEvent<ApiError>();

sample({
  clock: requestFx.fail,
  filter: ({ params, error }) => (params.onUnauthorized ?? "login") === "login" && isSessionError(error),
  fn: ({ error }) => error as ApiError,
  target: sessionRequired,
});

export const callApi = <Data>(request: ApiRequest<Data>): Promise<Data> => {
  const controller = new AbortController();

  onAbort(() => controller.abort());

  return requestFx({ ...request, signal: controller.signal }) as Promise<Data>;
};
