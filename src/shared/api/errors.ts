export type ApiErrorBody = {
  code: string;
  message: string;
  field: string | null;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field: string | null;

  constructor({ status, code, message, field }: ApiErrorBody & { status: number }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export const SESSION_ERROR_CODES = ["SESSION_REQUIRED", "SESSION_EXPIRED"] as const;

export type SessionErrorCode = (typeof SESSION_ERROR_CODES)[number];

export const isSessionError = (error: unknown): error is ApiError & { code: SessionErrorCode } =>
  error instanceof ApiError && (SESSION_ERROR_CODES as readonly string[]).includes(error.code);
