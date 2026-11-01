import { createFactory, invoke } from "@withease/factories";
import { combine, createEvent, createStore, sample } from "effector";
import { readonly } from "patronum";

import { createResendConfirmationFactory } from "@/features/resend-confirmation";

import { $$session, getLoginErrorMessages } from "@/entities/session";

import { type ApiError } from "@/shared/api";
import { LOGIN_MESSAGES } from "@/shared/config/auth-messages";

export const createOidcLinkFactory = createFactory(() => {
  const $$resend = invoke(createResendConfirmationFactory);

  const emailReceived = createEvent<string>();
  const passwordChanged = createEvent<string>();
  const passwordBlurred = createEvent();
  const submitted = createEvent();
  const reset = createEvent();
  const loginFailed = createEvent<ApiError>();
  const expired = createEvent();

  const $email = createStore("");
  const $password = createStore("");
  const $passwordChecked = createStore(false);
  const $active = createStore(false);
  const $serverMessages = createStore<string[]>([]);
  const $emailNotConfirmed = createStore(false);
  const $focusRequest = createStore(0);
  const $pending = $$session.outputs.$isSigningIn;

  const $passwordError = combine($password, $passwordChecked, (password, checked) =>
    checked && password.length === 0 ? LOGIN_MESSAGES.passwordRequired : null,
  );

  const accepted = sample({
    clock: submitted,
    source: { email: $email, password: $password, pending: $pending },
    filter: ({ password, pending }) => !pending && password.length > 0,
    fn: ({ email, password }) => ({ login: email, password }),
  });

  sample({ clock: emailReceived, target: $email });

  sample({ clock: emailReceived, fn: () => true, target: $active });

  sample({ clock: passwordChanged, target: $password });

  sample({ clock: [passwordBlurred, submitted], fn: () => true, target: $passwordChecked });

  sample({
    clock: submitted,
    source: { password: $password, focus: $focusRequest },
    filter: ({ password }) => password.length === 0,
    fn: ({ focus }) => focus + 1,
    target: $focusRequest,
  });

  sample({ clock: accepted, fn: () => [], target: $serverMessages });

  sample({ clock: accepted, fn: () => false, target: $emailNotConfirmed });

  sample({ clock: accepted, target: $$session.inputs.signedIn });

  sample({ clock: accepted, target: $$resend.inputs.reset });

  sample({
    clock: $$session.outputs.$loginError,
    source: $active,
    filter: (active, error) => active && error !== null,
    fn: (_, error) => error as ApiError,
    target: loginFailed,
  });

  sample({ clock: loginFailed, filter: (error) => error.code === "AUTH_OIDC_EXPIRED", target: expired });

  sample({
    clock: loginFailed,
    filter: (error) => error.code !== "AUTH_OIDC_EXPIRED",
    fn: (error) => getLoginErrorMessages(error),
    target: $serverMessages,
  });

  sample({ clock: loginFailed, fn: () => "", target: $password });

  sample({ clock: loginFailed, fn: () => false, target: $passwordChecked });

  sample({
    clock: loginFailed,
    fn: (error) => error.code === "AUTH_EMAIL_NOT_CONFIRMED",
    target: $emailNotConfirmed,
  });

  sample({
    clock: loginFailed,
    source: $email,
    filter: (_, error) => error.code === "AUTH_EMAIL_NOT_CONFIRMED",
    fn: (email) => ({ request: { login: email }, resendAfter: 0 }),
    target: $$resend.inputs.started,
  });

  sample({ clock: loginFailed, source: $focusRequest, fn: (id) => id + 1, target: $focusRequest });

  sample({ clock: reset, fn: () => "", target: [$email, $password] });

  sample({ clock: reset, fn: () => false, target: [$active, $passwordChecked, $emailNotConfirmed] });

  sample({ clock: reset, fn: () => [], target: $serverMessages });

  sample({ clock: reset, target: $$resend.inputs.reset });

  return {
    inputs: { emailReceived, passwordChanged, passwordBlurred, submitted, reset },

    outputs: {
      $$resend,
      $email: readonly($email),
      $password: readonly($password),
      $passwordError,
      $serverMessages: readonly($serverMessages),
      $emailNotConfirmed: readonly($emailNotConfirmed),
      $pending: readonly($pending),
      $focusRequest: readonly($focusRequest),
      expired: readonly(expired),
    },
  };
});

export type OidcLinkModel = ReturnType<typeof createOidcLinkFactory>;
