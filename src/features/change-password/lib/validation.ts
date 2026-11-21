import { type ApiError, isSessionError } from "@/shared/api";
import { INTERNAL_ERROR_MESSAGE, PASSWORD_MESSAGES } from "@/shared/config/auth-messages";
import { type PasswordFieldError, validateNewPassword, validatePasswordConfirmation } from "@/shared/lib/password";

export const CHANGE_PASSWORD_FIELDS = ["current", "password", "confirmation"] as const;

export type ChangePasswordField = (typeof CHANGE_PASSWORD_FIELDS)[number];

export type ChangePasswordValues = Record<ChangePasswordField, string>;

export type ChangePasswordErrors = Record<ChangePasswordField, PasswordFieldError | null>;

export type ServerFieldErrors = Partial<Record<ChangePasswordField, string>>;

export type ChangePasswordFailure =
  | { kind: "form"; message: string }
  | { kind: "field"; field: ChangePasswordField; message: string }
  | { kind: "session" };

export const emptyChangePasswordValues: ChangePasswordValues = { current: "", password: "", confirmation: "" };

export const visibleFields = (requiresCurrent: boolean): ChangePasswordField[] =>
  requiresCurrent ? [...CHANGE_PASSWORD_FIELDS] : ["password", "confirmation"];

export const validateChangePasswordForm = (
  { current, password, confirmation }: ChangePasswordValues,
  requiresCurrent: boolean,
): ChangePasswordErrors => ({
  current: requiresCurrent && current.length === 0 ? { message: PASSWORD_MESSAGES.currentPasswordRequired } : null,
  password: validateNewPassword(password),
  confirmation: validatePasswordConfirmation(confirmation, password),
});

export const findFirstInvalidField = (errors: ChangePasswordErrors): ChangePasswordField | null =>
  CHANGE_PASSWORD_FIELDS.find((field) => errors[field] !== null) ?? null;

const SERVER_FIELDS: Record<string, ChangePasswordField> = {
  current_password: "current",
  new_password: "password",
};

export const describeChangePasswordFailure = (error: ApiError): ChangePasswordFailure => {
  if (isSessionError(error)) return { kind: "session" };

  if (error.code === "AUTH_CURRENT_PASSWORD_INVALID")
    return { kind: "form", message: PASSWORD_MESSAGES.currentPasswordInvalid };

  if (error.code === "AUTH_PASSWORD_SAME_AS_CURRENT") return { kind: "form", message: PASSWORD_MESSAGES.sameAsCurrent };

  const field = error.field === null ? undefined : SERVER_FIELDS[error.field];

  if (error.status === 400 && error.code === "AUTH_VALIDATION_ERROR" && field)
    return { kind: "field", field, message: error.message };

  return { kind: "form", message: INTERNAL_ERROR_MESSAGE };
};
