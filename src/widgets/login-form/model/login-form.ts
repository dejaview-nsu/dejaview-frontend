import { createFactory, invoke } from "@withease/factories";
import { combine, createEvent, createStore, sample, type Store } from "effector";
import { readonly } from "patronum";

import { createResendConfirmationFactory } from "@/features/resend-confirmation";

import { type $$session, getLoginErrorMessages } from "@/entities/session";

import { type ApiError } from "@/shared/api";

import {
  emptyLoginValues,
  type LoginErrors,
  type LoginField,
  type LoginValues,
  validateLoginForm,
} from "../lib/validation";

export const createLoginFormFactory = createFactory(
  ({ session, $active }: { session: typeof $$session; $active: Store<boolean> }) => {
    const $$resend = invoke(createResendConfirmationFactory);

    const fieldChanged = createEvent<{ field: LoginField; value: string }>();
    const fieldBlurred = createEvent<LoginField>();
    const submitted = createEvent();
    const reset = createEvent();
    const loginFailed = createEvent<ApiError>();
    const focusRequested = createEvent<LoginField>();

    const $values = createStore<LoginValues>(emptyLoginValues);
    const $checked = createStore<LoginField[]>([]);
    const $serverError = createStore<ApiError | null>(null);
    const $submittedLogin = createStore("");
    const $confirmationSent = createStore(false);
    const $focusRequest = createStore<{ field: LoginField; id: number } | null>(null);

    const $pending = session.outputs.$isSigningIn;
    const $clientErrors = $values.map(validateLoginForm);
    const $errors = combine($clientErrors, $checked, (errors, checked): LoginErrors => ({
      login: checked.includes("login") ? errors.login : null,
      password: checked.includes("password") ? errors.password : null,
    }));
    const $messages = combine($serverError, $submittedLogin, (error, login) =>
      error ? getLoginErrorMessages(error, login) : [],
    );
    const $emailNotConfirmed = $serverError.map((error) => error?.code === "AUTH_EMAIL_NOT_CONFIRMED");

    const validated = sample({
      clock: submitted,
      source: { values: $values, active: $active, pending: $pending },
      filter: ({ active, pending }) => active && !pending,
      fn: ({ values }) => ({ values, errors: validateLoginForm(values) }),
    });

    const accepted = sample({
      clock: validated,
      filter: ({ errors }) => errors.login === null && errors.password === null,
      fn: ({ values }) => ({ login: values.login.trim(), password: values.password }),
    });

    sample({
      clock: fieldChanged,
      source: { values: $values, pending: $pending },
      filter: ({ pending }) => !pending,
      fn: ({ values }, { field, value }) => ({ ...values, [field]: value }),
      target: $values,
    });

    sample({
      clock: fieldBlurred,
      source: $checked,
      filter: (checked, field) => !checked.includes(field),
      fn: (checked, field) => [...checked, field],
      target: $checked,
    });

    sample({ clock: validated, fn: () => ["login", "password"] as LoginField[], target: $checked });

    sample({
      clock: validated,
      filter: ({ errors }) => errors.login !== null || errors.password !== null,
      fn: ({ errors }) => (errors.login !== null ? ("login" as const) : ("password" as const)),
      target: focusRequested,
    });

    sample({ clock: accepted, fn: ({ login }) => login, target: $submittedLogin });

    sample({ clock: accepted, fn: () => null, target: $serverError });

    sample({ clock: accepted, fn: () => false, target: $confirmationSent });

    sample({ clock: accepted, target: $$resend.inputs.reset });

    sample({ clock: accepted, target: session.inputs.signedIn });

    sample({
      clock: session.outputs.$loginError,
      source: $active,
      filter: (active, error) => active && error !== null,
      fn: (_, error) => error as ApiError,
      target: loginFailed,
    });

    sample({ clock: loginFailed, target: $serverError });

    sample({ clock: loginFailed, source: $values, fn: (values) => ({ ...values, password: "" }), target: $values });

    sample({
      clock: loginFailed,
      source: $checked,
      fn: (checked) => checked.filter((field) => field !== "password"),
      target: $checked,
    });

    sample({
      clock: loginFailed,
      source: $submittedLogin,
      filter: (_, error) => error.code === "AUTH_EMAIL_NOT_CONFIRMED",
      fn: (login) => ({ request: { login }, resendAfter: 0 }),
      target: $$resend.inputs.started,
    });

    sample({ clock: $$resend.outputs.sent, fn: () => true, target: $confirmationSent });

    sample({
      clock: focusRequested,
      source: $focusRequest,
      fn: (previous, field) => ({ field, id: (previous?.id ?? 0) + 1 }),
      target: $focusRequest,
    });

    sample({ clock: $active, filter: (active) => !active, target: reset });

    sample({ clock: reset, target: session.inputs.signInCancelled });

    sample({ clock: reset, target: $$resend.inputs.reset });

    sample({ clock: reset, fn: () => emptyLoginValues, target: $values });

    sample({ clock: reset, fn: () => [], target: $checked });

    sample({ clock: reset, fn: () => null, target: [$serverError, $focusRequest] });

    sample({ clock: reset, fn: () => "", target: $submittedLogin });

    sample({ clock: reset, fn: () => false, target: $confirmationSent });

    return {
      inputs: { fieldChanged, fieldBlurred, submitted, reset },
      outputs: {
        $$resend,
        $values: readonly($values),
        $errors,
        $messages,
        $pending,
        $emailNotConfirmed,
        $confirmationSent: readonly($confirmationSent),
        $focusRequest: readonly($focusRequest),
      },
    };
  },
);

export type LoginFormModel = ReturnType<typeof createLoginFormFactory>;
