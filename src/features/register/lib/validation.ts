import { type ApiError, type AuthRegisterRequest, zAuthEmail, zAuthPassword, zAuthUsername } from "@/shared/api";

import { REGISTER_MESSAGES, REGISTER_SERVER_MESSAGES } from "./messages";

export const REGISTER_FIELDS = ["username", "email", "birthYear", "password", "passwordConfirmation"] as const;

export type RegisterField = (typeof REGISTER_FIELDS)[number];

export type RegisterValues = Record<RegisterField, string>;

export type FieldError = { message: string | null };

export type RegisterErrors = Record<RegisterField, FieldError | null>;

export const PASSWORD_MAX_LENGTH = 128;

export const MIN_BIRTH_YEAR = 1900;

export const emptyRegisterValues: RegisterValues = {
  username: "",
  email: "",
  birthYear: "",
  password: "",
  passwordConfirmation: "",
};

export const passwordRules = [
  {
    id: "length",
    label: "Длина от 8 до 128 символов",
    test: (value: string) => value.length >= 8 && value.length <= PASSWORD_MAX_LENGTH,
  },
  { id: "uppercase", label: "Заглавная латинская буква", test: (value: string) => /[A-Z]/.test(value) },
  { id: "lowercase", label: "Строчная латинская буква", test: (value: string) => /[a-z]/.test(value) },
  { id: "digit", label: "Хотя бы одна цифра", test: (value: string) => /[0-9]/.test(value) },
  {
    id: "special",
    label: "Хотя бы один спецсимвол: ! @ # $ % и др.",
    test: (value: string) => /[^\p{L}\p{N}\s]/u.test(value),
  },
] as const;

export type PasswordRuleId = (typeof passwordRules)[number]["id"];

export type PasswordRuleState = "neutral" | "passed" | "failed";

export const checkPassword = (value: string) =>
  passwordRules.map(({ id, label, test }) => ({
    id,
    label,
    state: (value.length === 0 ? "neutral" : test(value) ? "passed" : "failed") as PasswordRuleState,
  }));

const fail = (message: string | null): FieldError => ({ message });

export const validateUsername = (value: string): FieldError | null => {
  if (value.length === 0) return fail(REGISTER_MESSAGES.usernameRequired);

  if (value.length < 3) return fail(REGISTER_MESSAGES.usernameTooShort);

  if (value.length > 30) return fail(REGISTER_MESSAGES.usernameTooLong);

  if (!zAuthUsername.safeParse(value).success) return fail(REGISTER_MESSAGES.usernameInvalid);

  return null;
};

export const validateEmail = (value: string): FieldError | null => {
  const email = value.trim();

  if (email.length === 0) return fail(REGISTER_MESSAGES.emailRequired);

  if (!zAuthEmail.safeParse(email).success) return fail(REGISTER_MESSAGES.emailInvalid);

  return null;
};

export const validateBirthYear = (value: string, currentYear = new Date().getFullYear()): FieldError | null => {
  const year = value.trim();

  if (year.length === 0) return fail(REGISTER_MESSAGES.birthYearRequired);

  if (!/^\d{4}$/.test(year)) return fail(REGISTER_MESSAGES.birthYearFormat);

  if (Number(year) < MIN_BIRTH_YEAR) return fail(REGISTER_MESSAGES.birthYearTooEarly);

  if (Number(year) > currentYear) return fail(REGISTER_MESSAGES.birthYearInFuture);

  return null;
};

export const validatePassword = (value: string): FieldError | null => {
  if (value.length === 0) return fail(REGISTER_MESSAGES.passwordRequired);

  if (!passwordRules.every(({ test }) => test(value)) || !zAuthPassword.safeParse(value).success) return fail(null);

  return null;
};

export const validatePasswordConfirmation = (value: string, password: string): FieldError | null =>
  value === password ? null : fail(REGISTER_MESSAGES.passwordMismatch);

export const validateRegisterForm = (values: RegisterValues): RegisterErrors => ({
  username: validateUsername(values.username),
  email: validateEmail(values.email),
  birthYear: validateBirthYear(values.birthYear),
  password: validatePassword(values.password),
  passwordConfirmation: validatePasswordConfirmation(values.passwordConfirmation, values.password),
});

export const findFirstInvalidField = (errors: RegisterErrors): RegisterField | null =>
  REGISTER_FIELDS.find((field) => errors[field] !== null) ?? null;

export const toRegisterRequest = (values: RegisterValues): AuthRegisterRequest => ({
  username: values.username,
  email: values.email.trim(),
  birth_year: Number(values.birthYear.trim()),
  password: values.password,
});

const SERVER_FIELDS: Record<string, RegisterField> = {
  username: "username",
  email: "email",
  birth_year: "birthYear",
  password: "password",
};

export const toRegisterField = (field: string | null): RegisterField | null =>
  field === null ? null : (SERVER_FIELDS[field] ?? null);

export const getRegisterServerMessage = (error: ApiError): string =>
  REGISTER_SERVER_MESSAGES[error.code] ?? error.message;
