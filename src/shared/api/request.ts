import { onAbort } from "@farfetched/core";
import { createEffect, createEvent, sample } from "effector";
import { z } from "zod";

import { JSON_REQUEST_TIMEOUT_MS } from "./config";
import { type ApiError, createClientError, isSessionError, type SessionErrorCode } from "./errors";
import { type ApiResponse, type ErrorMessages, parseResponse, validateResponse } from "./parse-response";
import { TransportError } from "./transport/errors";
import type { Transport, TransportRequest, TransportResponse } from "./transport/types";
import { xhrTransport } from "./transport/xhr";

export type UnauthorizedPolicy = "login" | "guest";

export type ApiRequestConfig = Omit<TransportRequest, "timeouts"> & {
  timeouts?: TransportRequest["timeouts"];
  isSearch?: boolean;
  errorMessages?: ErrorMessages;
  onUnauthorized?: UnauthorizedPolicy;
};

export type ApiRequest<Data> = ApiRequestConfig & {
  schema: z.ZodType<Data>;
};

export const zNoContent = z.unknown().transform(() => undefined);

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

export const requestFx = createEffect<ApiRequestConfig, ApiResponse>(
  async ({ method, path, body, timeouts, signal, onUploadProgress, onUploadComplete, isSearch, errorMessages }) => {
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

    return parseResponse(response, { isSearch, errorMessages });
  },
);

export const sessionRequired = createEvent<ApiError>();

type RequestFailure = { params: ApiRequestConfig; error: unknown };

const isUnauthorizedFailure = (
  failure: RequestFailure,
): failure is RequestFailure & { error: ApiError & { code: SessionErrorCode } } =>
  (failure.params.onUnauthorized ?? "login") === "login" && isSessionError(failure.error);

sample({
  clock: requestFx.fail,
  filter: isUnauthorizedFailure,
  fn: ({ error }) => error,
  target: sessionRequired,
});

export const sendApiRequest = async <Data>({ schema, ...config }: ApiRequest<Data>): Promise<Data> =>
  validateResponse(await requestFx(config), schema);

export const callApi = <Data>(request: ApiRequest<Data>): Promise<Data> => {
  const controller = new AbortController();

  onAbort(() => controller.abort());

  return sendApiRequest({ ...request, signal: controller.signal });
};
