export {
  ApiError,
  type ApiErrorBody,
  CLIENT_ERRORS,
  type ClientErrorCode,
  isLoginLockedError,
  isNetworkError,
  isRateLimitError,
  isSearchUnavailableError,
  isSessionError,
  isTimeoutError,
  SEARCH_UNAVAILABLE_CODES,
  SESSION_ERROR_CODES,
  type SessionErrorCode,
} from "./errors";
export type {
  AuthLoginRequest,
  MovieSearchResult,
  SearchErrorCode,
  SearchResponse,
  SessionInfo,
  UserSummary,
} from "./generated";
export { zSearchResponse, zSessionInfo } from "./generated/zod.gen";
export { type ApiRequest, callApi, requestFx, sessionRequired, transportFx, type UnauthorizedPolicy } from "./request";
export {
  createFileSearchFactory,
  FILE_SEARCH_MODES,
  type FileSearchMode,
  type FileSearchStage,
  searchByFile,
  type SearchByFileParams,
} from "./search";
export { isAbortError } from "./transport/errors";
export type { HttpMethod, Transport, TransportRequest, TransportResponse } from "./transport/types";
export { buildUrl } from "./url";
