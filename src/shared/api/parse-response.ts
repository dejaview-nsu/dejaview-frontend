import type { z } from "zod";

import { ApiError, type ClientErrorCode, createClientError } from "./errors";
import { zError } from "./generated/zod.gen";
import type { TransportResponse } from "./transport/types";

export type ParseOptions = {
  isSearch?: boolean;
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

const fallbackCode = (status: number, { isSearch = false }: ParseOptions): ClientErrorCode => {
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

export const parseResponse = <Data>(
  response: TransportResponse,
  schema: z.ZodType<Data> | null,
  options: ParseOptions = {},
): Data | undefined => {
  const { status, bodyText } = response;

  if (status >= 200 && status < 300) {
    if (schema === null) {
      return undefined;
    }

    const result = schema.safeParse(parseJson(bodyText));

    if (!result.success) {
      throw createClientError("INVALID_RESPONSE", status);
    }

    return result.data;
  }

  const retryAfter = parseRetryAfter(response.getHeader("Retry-After"));
  const body = zError.safeParse(parseJson(bodyText));

  if (!body.success) {
    throw createClientError(fallbackCode(status, options), status, retryAfter);
  }

  throw new ApiError({
    status,
    code: body.data.code,
    message: body.data.message,
    field: body.data.field ?? null,
    retryAfter,
  });
};
