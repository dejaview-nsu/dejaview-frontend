import { zAuthLogin } from "@/shared/api";
import { LOGIN_MESSAGES } from "@/shared/config/auth-messages";

export type LoginFieldError = { message: string };

export const normalizeLogin = (value: string) => value.trim();

export const validateLogin = (value: string): LoginFieldError | null => {
  const login = normalizeLogin(value);

  if (login.length === 0) return { message: LOGIN_MESSAGES.loginRequired };

  if (!zAuthLogin.safeParse(login).success) return { message: LOGIN_MESSAGES.loginInvalid };

  return null;
};
