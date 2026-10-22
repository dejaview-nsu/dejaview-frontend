import { type ApiError } from "@/shared/api";
import { INTERNAL_ERROR_MESSAGE, LOGIN_MESSAGES } from "@/shared/config/auth-messages";

import { getLoginErrorDetails } from "../api";

export const getLoginErrorMessages = (error: ApiError): string[] => {
  switch (error.code) {
    case "AUTH_INVALID_CREDENTIALS": {
      const captchaRequired = getLoginErrorDetails(error)?.captcha_required === true;

      return captchaRequired
        ? [LOGIN_MESSAGES.invalidEmailCredentials, LOGIN_MESSAGES.captchaRequired]
        : [LOGIN_MESSAGES.invalidEmailCredentials];
    }
    case "AUTH_CAPTCHA_REQUIRED": {
      return [LOGIN_MESSAGES.captchaRequired];
    }
    case "AUTH_CAPTCHA_INVALID": {
      return [LOGIN_MESSAGES.captchaInvalid];
    }
    case "AUTH_EMAIL_NOT_CONFIRMED": {
      return [LOGIN_MESSAGES.emailNotConfirmed];
    }
    case "AUTH_ACCOUNT_BLOCKED": {
      return [LOGIN_MESSAGES.accountBlocked];
    }
    case "AUTH_LOGIN_LOCKED": {
      return [error.retryAfter === null ? error.message : LOGIN_MESSAGES.locked(Math.ceil(error.retryAfter / 60))];
    }
    case "INTERNAL_ERROR": {
      return [INTERNAL_ERROR_MESSAGE];
    }
    default: {
      return [error.message];
    }
  }
};
