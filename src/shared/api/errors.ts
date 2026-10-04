export type ApiErrorBody = {
  code: string;
  message: string;
  field: string | null;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field: string | null;
  readonly retryAfter: number | null;

  constructor({
    status,
    code,
    message,
    field,
    retryAfter = null,
  }: ApiErrorBody & { status: number; retryAfter?: number | null }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.field = field;
    this.retryAfter = retryAfter;
  }
}

export const CLIENT_ERRORS = {
  NETWORK_ERROR: "Не удалось связаться с сервером. Проверьте подключение к интернету и попробуйте ещё раз",
  TIMEOUT: "Сервер слишком долго не отвечает. Попробуйте ещё раз",
  INVALID_RESPONSE: "Произошла ошибка. Попробуйте позже",
  SESSION_REQUIRED: "Войдите, чтобы продолжить",
  FILE_TOO_LARGE: "Файл слишком большой",
  RATE_LIMITED: "Слишком много запросов. Попробуйте позже",
  INTERNAL_ERROR: "Произошла ошибка. Попробуйте позже",
  SEARCH_UNAVAILABLE: "Поиск временно недоступен. Попробуйте позже",
  SERVICE_UNAVAILABLE: "Сервис временно недоступен. Попробуйте позже",
} as const;

export type ClientErrorCode = keyof typeof CLIENT_ERRORS;

export const createClientError = (code: ClientErrorCode, status: number, retryAfter: number | null = null) =>
  new ApiError({ status, code, message: CLIENT_ERRORS[code], field: null, retryAfter });

export const SESSION_ERROR_CODES = ["SESSION_REQUIRED", "SESSION_EXPIRED"] as const;

export type SessionErrorCode = (typeof SESSION_ERROR_CODES)[number];

export const SEARCH_UNAVAILABLE_CODES = ["SEARCH_UNAVAILABLE", "SERVER_BUSY"] as const;

const hasCode = (error: unknown, codes: readonly string[]): error is ApiError =>
  error instanceof ApiError && codes.includes(error.code);

export const isSessionError = (error: unknown): error is ApiError & { code: SessionErrorCode } =>
  hasCode(error, SESSION_ERROR_CODES);

export const isSearchUnavailableError = (error: unknown): error is ApiError => hasCode(error, SEARCH_UNAVAILABLE_CODES);

export const isLoginLockedError = (error: unknown): error is ApiError => hasCode(error, ["AUTH_LOGIN_LOCKED"]);

export const isRateLimitError = (error: unknown): error is ApiError =>
  error instanceof ApiError && error.status === 429 && !isLoginLockedError(error);

export const isNetworkError = (error: unknown): error is ApiError => hasCode(error, ["NETWORK_ERROR"]);

export const isTimeoutError = (error: unknown): error is ApiError => hasCode(error, ["TIMEOUT"]);
