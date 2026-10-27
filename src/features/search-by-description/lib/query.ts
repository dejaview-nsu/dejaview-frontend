import { type ApiError } from "@/shared/api";

import { QUERY_MAX_LENGTH, QUERY_MIN_LENGTH, type QueryErrorCode } from "../config";

export type TextSearchError = { kind: "query"; code: QueryErrorCode } | { kind: "unavailable" };

const EDGE_WHITESPACE = /^\p{White_Space}+|\p{White_Space}+$/gu;

const QUERY_ERROR_CODES: readonly string[] = ["QUERY_EMPTY", "QUERY_TOO_SHORT", "QUERY_TOO_LONG", "QUERY_NOT_ALLOWED"];

const VALIDATION_STATUSES = [400, 422];

export const countCharacters = (text: string) => [...text].length;

export const normalizeQuery = (text: string) => text.replaceAll(EDGE_WHITESPACE, "");

export const checkQuery = (query: string): QueryErrorCode | null => {
  const length = countCharacters(query);

  if (length === 0) return "QUERY_EMPTY";
  if (length < QUERY_MIN_LENGTH) return "QUERY_TOO_SHORT";
  if (length > QUERY_MAX_LENGTH) return "QUERY_TOO_LONG";

  return null;
};

export const toTextSearchError = (error: ApiError): TextSearchError => {
  if (QUERY_ERROR_CODES.includes(error.code)) return { kind: "query", code: error.code as QueryErrorCode };
  if (VALIDATION_STATUSES.includes(error.status)) return { kind: "query", code: "QUERY_NOT_ALLOWED" };

  return { kind: "unavailable" };
};
