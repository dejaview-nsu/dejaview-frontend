import { validateLogin } from "@/entities/session";

import { LOGIN_MESSAGES } from "@/shared/config/auth-messages";

export type LoginField = "login" | "password";
export type LoginValues = Record<LoginField, string>;
export type LoginErrors = Record<LoginField, { message: string } | null>;

export const emptyLoginValues: LoginValues = { login: "", password: "" };

export const validateLoginForm = ({ login, password }: LoginValues): LoginErrors => ({
  login: validateLogin(login),
  password: password.length === 0 ? { message: LOGIN_MESSAGES.passwordRequired } : null,
});
