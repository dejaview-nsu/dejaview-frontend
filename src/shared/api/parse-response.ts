import type { z } from "zod";

import { ApiError, type ClientErrorCode, createClientError } from "./errors";
import { zError } from "./generated/zod.gen";
import type { TransportResponse } from "./transport/types";

export type ErrorMessages = Partial<Record<ClientErrorCode, string>>;

export type ParseOptions = {
  isSearch?: boolean;
  errorMessages?: ErrorMessages;
};

export type ApiResponse = {
  status: number;
  body: unknown;
};

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const parseRetryAfter = (value: string | null): number | null => {
  if (value === null || !/^\d+$/.test(value.trim())) {
    return null;
  }

  return Number(value.trim());
};

const fallbackCode = (status: number, isSearch: boolean): ClientErrorCode => {
  switch (status) {
    case 401: {
      return "SESSION_REQUIRED";
    }
    case 413: {
      return "FILE_TOO_LARGE";
    }
    case 429: {
      return "RATE_LIMITED";
    }
    case 500: {
      return "INTERNAL_ERROR";
    }
    case 502:
    case 503:
    case 504: {
      return isSearch ? "SEARCH_UNAVAILABLE" : "SERVICE_UNAVAILABLE";
    }
    default: {
      return "INVALID_RESPONSE";
    }
  }
};

export const parseResponse = (
  response: TransportResponse,
  { isSearch = false, errorMessages = {} }: ParseOptions = {},
): ApiResponse => {
  const { status, bodyText } = response;
  const body = parseJson(bodyText);

  if (status >= 200 && status < 300) {
    return { status, body };
  }

  const retryAfter = parseRetryAfter(response.getHeader("Retry-After"));
  const error = zError.safeParse(body);

  if (!error.success) {
    const code = fallbackCode(status, isSearch);

    throw createClientError(code, status, { retryAfter, message: errorMessages[code] });
  }

  throw new ApiError({
    status,
    code: error.data.code,
    message: error.data.message,
    field: error.data.field ?? null,
    retryAfter,
    details: body,
  });
};

export const validateResponse = <Data>({ status, body }: ApiResponse, schema: z.ZodType<Data>): Data => {
  const result = schema.safeParse(body);

  if (!result.success) {
    throw createClientError("INVALID_RESPONSE", status);
  }

  return result.data;
};
