export {
  ApiError,
  type ApiErrorBody,
  CLIENT_ERRORS,
  type ClientErrorCode,
  getErrorDetails,
  isLoginLockedError,
  isNetworkError,
  isRateLimitError,
  isSearchUnavailableError,
  isSessionError,
  isTimeoutError,
  SEARCH_UNAVAILABLE_CODES,
  SESSION_ERROR_CODES,
  type SessionErrorCode,
  toApiError,
} from "./errors";
export type {
  AuthLoginError,
  AuthLoginRequest,
  MovieSearchResult,
  SearchErrorCode,
  SearchResponse,
  SessionInfo,
  UserSummary,
} from "./generated";
export { zAuthLoginError, zSearchResponse, zSessionInfo } from "./generated/zod.gen";
export type { ApiResponse, ErrorMessages } from "./parse-response";
export {
  type ApiRequest,
  type ApiRequestConfig,
  callApi,
  requestFx,
  sendApiRequest,
  sessionRequired,
  transportFx,
  type UnauthorizedPolicy,
  zNoContent,
} from "./request";
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
