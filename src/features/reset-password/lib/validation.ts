import { type ApiError } from "@/shared/api";
import { INTERNAL_ERROR_MESSAGE, PASSWORD_MESSAGES } from "@/shared/config/auth-messages";
import { type PasswordFieldError, validateNewPassword, validatePasswordConfirmation } from "@/shared/lib/password";

export const RESET_PASSWORD_FIELDS = ["password", "confirmation"] as const;

export type ResetPasswordField = (typeof RESET_PASSWORD_FIELDS)[number];

export type ResetPasswordValues = Record<ResetPasswordField, string>;

export type ResetPasswordErrors = Record<ResetPasswordField, PasswordFieldError | null>;

export const emptyResetPasswordValues: ResetPasswordValues = { password: "", confirmation: "" };

export const validateResetPasswordForm = ({ password, confirmation }: ResetPasswordValues): ResetPasswordErrors => ({
  password: validateNewPassword(password),
  confirmation: validatePasswordConfirmation(confirmation, password),
});

export const findFirstInvalidField = (errors: ResetPasswordErrors): ResetPasswordField | null =>
  RESET_PASSWORD_FIELDS.find((field) => errors[field] !== null) ?? null;

export const isLinkExpiredError = (error: ApiError) => error.status === 410;

export const getCompleteErrorMessage = (error: ApiError) =>
  error.code === "AUTH_PASSWORD_SAME_AS_CURRENT" ? PASSWORD_MESSAGES.sameAsCurrent : INTERNAL_ERROR_MESSAGE;
