import { createFactory } from "@withease/factories";
import { combine, createEvent, createStore, sample } from "effector";
import { interval, readonly } from "patronum";

import { type AuthResendConfirmationRequest, toApiError } from "@/shared/api";

import { createResendConfirmationApi } from "../api/request";

export const formatCountdown = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export const createResendConfirmationFactory = createFactory(() => {
  const { resendMutation } = createResendConfirmationApi();

  const started = createEvent<{ request: AuthResendConfirmationRequest; resendAfter: number }>();
  const resendPressed = createEvent();
  const reset = createEvent();
  const countdownRequested = createEvent<number>();
  const countdownStarted = createEvent();
  const countdownStopped = createEvent();
  const sent = createEvent<number>();

  const $request = createStore<AuthResendConfirmationRequest | null>(null);
  const $secondsLeft = createStore(0);
  const $error = createStore<string | null>(null);
  const $pending = resendMutation.$pending;

  const { tick } = interval({ timeout: 1000, start: countdownStarted, stop: countdownStopped });

  const $canResend = combine(
    $request,
    $secondsLeft,
    $pending,
    (request, seconds, pending) => request !== null && seconds === 0 && !pending,
  );

  const $countdown = $secondsLeft.map((seconds) => (seconds > 0 ? formatCountdown(seconds) : null));

  const resendAccepted = sample({
    clock: resendPressed,
    source: { request: $request, canResend: $canResend },
    filter: ({ canResend }) => canResend,
    fn: ({ request }) => request as AuthResendConfirmationRequest,
  });

  sample({ clock: started, fn: ({ request }) => request, target: $request });

  sample({ clock: started, fn: () => null, target: $error });

  sample({ clock: started, fn: ({ resendAfter }) => resendAfter, target: countdownRequested });

  sample({ clock: countdownRequested, fn: (seconds) => Math.max(seconds, 0), target: $secondsLeft });

  sample({ clock: countdownRequested, filter: (seconds) => seconds > 0, target: countdownStarted });

  sample({ clock: tick, source: $secondsLeft, fn: (seconds) => Math.max(seconds - 1, 0), target: $secondsLeft });

  sample({ clock: $secondsLeft, filter: (seconds) => seconds === 0, target: countdownStopped });

  sample({ clock: resendAccepted, fn: () => null, target: $error });

  sample({ clock: resendAccepted, target: resendMutation.start });

  sample({ clock: resendMutation.finished.success, fn: ({ result }) => result.resend_after, target: sent });

  sample({ clock: sent, target: countdownRequested });

  sample({ clock: resendMutation.finished.failure, fn: ({ error }) => toApiError(error).message, target: $error });

  sample({ clock: reset, fn: () => null, target: [$request, $error] });

  sample({ clock: reset, fn: () => 0, target: $secondsLeft });

  sample({ clock: reset, target: countdownStopped });

  return {
    inputs: { started, resendPressed, reset },

    outputs: {
      $secondsLeft: readonly($secondsLeft),
      $countdown,
      $canResend,
      $pending: readonly($pending),
      $error: readonly($error),
      sent: readonly(sent),
    },
  };
});

export type ResendConfirmationModel = ReturnType<typeof createResendConfirmationFactory>;
