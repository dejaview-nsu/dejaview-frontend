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
  AuthConfirmationSent,
  AuthLoginError,
  AuthLoginRequest,
  AuthOidcCompleteRequest,
  AuthOidcPending,
  AuthOidcProvider,
  AuthRegisterRequest,
  AuthResendConfirmationRequest,
  MovieSearchResult,
  SearchErrorCode,
  SearchResponse,
  SessionInfo,
  UserSummary,
} from "./generated";
export {
  zAuthConfirmationSent,
  zAuthEmail,
  zAuthLoginError,
  zAuthOidcPending,
  zAuthOidcProvider,
  zAuthPassword,
  zAuthUsername,
  zSearchResponse,
  zSessionInfo,
} from "./generated/zod.gen";
export { API_BASE_URL } from "./config";
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
  searchByText,
  type SearchByFileParams,
} from "./search";
export { isAbortError } from "./transport/errors";
export type { HttpMethod, Transport, TransportRequest, TransportResponse } from "./transport/types";
export { buildUrl } from "./url";
