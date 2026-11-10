import { concurrency } from "@farfetched/core";
import { createFactory } from "@withease/factories";
import { combine, createEvent, createStore, sample } from "effector";
import { interval, readonly } from "patronum";

import { type LoginFieldError, normalizeLogin, validateLogin } from "@/entities/session";

import { toApiError } from "@/shared/api";
import { INTERNAL_ERROR_MESSAGE, LOGIN_MESSAGES } from "@/shared/config/auth-messages";
import { formatCountdown } from "@/shared/lib/countdown";

import { createRequestPasswordResetApi } from "../api/request";
import { RESEND_AFTER_SECONDS } from "../config";

export type FocusRequest = { id: number };

export const createRequestPasswordResetFactory = createFactory(() => {
  const { requestMutation } = createRequestPasswordResetApi();

  const changed = createEvent<string>();
  const blurred = createEvent();
  const submitted = createEvent();
  const resendPressed = createEvent();
  const reset = createEvent();
  const requested = createEvent<string>();
  const focusRequested = createEvent();
  const countdownStarted = createEvent();
  const countdownStopped = createEvent();

  const $value = createStore("");
  const $checked = createStore(false);
  const $serverFieldError = createStore<LoginFieldError | null>(null);
  const $formError = createStore<string | null>(null);
  const $sentLogin = createStore<string | null>(null);
  const $focusRequest = createStore<FocusRequest | null>(null);
  const $secondsLeft = createStore(0);
  const $pending = requestMutation.$pending;

  concurrency(requestMutation, { strategy: "TAKE_LATEST", abortAll: reset });

  const { tick } = interval({ timeout: 1000, start: countdownStarted, stop: countdownStopped });

  const $clientError = $value.map(validateLogin);
  const $fieldError = combine($clientError, $checked, $serverFieldError, (client, checked, server) =>
    checked && client !== null ? client : server,
  );
  const $isSent = $sentLogin.map((login) => login !== null);
  const $countdown = $secondsLeft.map((seconds) => (seconds > 0 ? formatCountdown(seconds) : null));
  const $canResend = combine(
    $isSent,
    $secondsLeft,
    $pending,
    (sent, seconds, pending) => sent && seconds === 0 && !pending,
  );

  const validated = sample({
    clock: submitted,
    source: { value: $value, pending: $pending, sent: $isSent },
    filter: ({ pending, sent }) => !pending && !sent,
    fn: ({ value }) => ({ login: normalizeLogin(value), error: validateLogin(value) }),
  });

  sample({ clock: changed, target: $value });

  sample({ clock: changed, fn: () => null, target: $serverFieldError });

  sample({ clock: blurred, fn: () => true, target: $checked });

  sample({ clock: validated, fn: () => true, target: $checked });

  sample({ clock: validated, fn: () => null, target: [$formError, $serverFieldError] });

  sample({ clock: validated, filter: ({ error }) => error !== null, target: focusRequested });

  sample({ clock: validated, filter: ({ error }) => error === null, fn: ({ login }) => login, target: requested });

  sample({
    clock: resendPressed,
    source: { login: $sentLogin, canResend: $canResend },
    filter: ({ canResend }) => canResend,
    fn: ({ login }) => login as string,
    target: requested,
  });

  sample({ clock: requested, fn: () => null, target: $formError });

  sample({ clock: requested, target: requestMutation.start });

  sample({ clock: requestMutation.finished.success, fn: ({ params }) => params, target: $sentLogin });

  sample({ clock: requestMutation.finished.success, fn: () => RESEND_AFTER_SECONDS, target: $secondsLeft });

  sample({ clock: requestMutation.finished.success, target: countdownStarted });

  const failed = sample({
    clock: requestMutation.finished.failure,
    source: $isSent,
    fn: (sent, { error }) => ({ sent, error: toApiError(error) }),
  });

  const fieldRejected = sample({
    clock: failed,
    filter: ({ sent, error }) => !sent && error.status === 400 && error.field === "login",
  });

  sample({ clock: fieldRejected, fn: () => ({ message: LOGIN_MESSAGES.loginInvalid }), target: $serverFieldError });

  sample({ clock: fieldRejected, target: focusRequested });

  sample({
    clock: failed,
    filter: ({ sent, error }) => sent || error.status !== 400 || error.field !== "login",
    fn: () => INTERNAL_ERROR_MESSAGE,
    target: $formError,
  });

  sample({ clock: tick, source: $secondsLeft, fn: (seconds) => Math.max(seconds - 1, 0), target: $secondsLeft });

  sample({ clock: $secondsLeft, filter: (seconds) => seconds === 0, target: countdownStopped });

  sample({
    clock: focusRequested,
    source: $focusRequest,
    fn: (previous) => ({ id: (previous?.id ?? 0) + 1 }),
    target: $focusRequest,
  });

  sample({ clock: reset, fn: () => "", target: $value });

  sample({ clock: reset, fn: () => false, target: $checked });

  sample({ clock: reset, fn: () => null, target: [$serverFieldError, $formError, $sentLogin, $focusRequest] });

  sample({ clock: reset, fn: () => 0, target: $secondsLeft });

  sample({ clock: reset, target: countdownStopped });

  return {
    inputs: { changed, blurred, submitted, resendPressed, reset },

    outputs: {
      $value: readonly($value),
      $fieldError,
      $formError: readonly($formError),
      $pending: readonly($pending),
      $isSent,
      $canResend,
      $countdown,
      $focusRequest: readonly($focusRequest),
    },

    __: { requestMutation },
  };
});

export type RequestPasswordResetModel = ReturnType<typeof createRequestPasswordResetFactory>;
