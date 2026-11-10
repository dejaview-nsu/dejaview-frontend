import { concurrency } from "@farfetched/core";
import { createFactory } from "@withease/factories";
import { combine, createEvent, createStore, merge, sample } from "effector";
import { debounce, readonly } from "patronum";

import { type SessionInfo, toApiError } from "@/shared/api";
import { announcePasswordRules, checkPasswordRules, NEW_PASSWORD_RULES } from "@/shared/lib/password";

import { createResetPasswordApi } from "../api/request";
import { ANNOUNCEMENT_DELAY_MS } from "../config";
import {
  emptyResetPasswordValues,
  findFirstInvalidField,
  getCompleteErrorMessage,
  isLinkExpiredError,
  RESET_PASSWORD_FIELDS,
  type ResetPasswordErrors,
  type ResetPasswordField,
  type ResetPasswordValues,
  validateResetPasswordForm,
} from "../lib/validation";

export type ResetPasswordScreen = "checking" | "form" | "expired" | "failed";

export type ResetPasswordFocusRequest = { field: ResetPasswordField; id: number };

export const createResetPasswordFactory = createFactory(() => {
  const { checkMutation, completeMutation } = createResetPasswordApi();

  const tokenReceived = createEvent<string | null>();
  const fieldChanged = createEvent<{ field: ResetPasswordField; value: string }>();
  const fieldBlurred = createEvent<ResetPasswordField>();
  const submitted = createEvent();
  const retryPressed = createEvent();
  const reset = createEvent();
  const checkRequested = createEvent<string>();
  const focusRequested = createEvent<ResetPasswordField>();
  const announced = createEvent();
  const completed = createEvent<SessionInfo>();

  const operationsCancelled = merge([reset, tokenReceived]);

  const $token = createStore<string | null>(null);
  const $screen = createStore<ResetPasswordScreen>("checking");
  const $values = createStore<ResetPasswordValues>(emptyResetPasswordValues);
  const $checked = createStore<ResetPasswordField[]>([]);
  const $formError = createStore<string | null>(null);
  const $focusRequest = createStore<ResetPasswordFocusRequest | null>(null);
  const $announcement = createStore("");
  const $pending = completeMutation.$pending;

  concurrency(checkMutation, { strategy: "TAKE_LATEST", abortAll: operationsCancelled });

  concurrency(completeMutation, { strategy: "TAKE_LATEST", abortAll: operationsCancelled });

  const $clientErrors = $values.map(validateResetPasswordForm);
  const $errors = combine(
    $clientErrors,
    $checked,
    (errors, checked) =>
      Object.fromEntries(
        RESET_PASSWORD_FIELDS.map((field) => [field, checked.includes(field) ? errors[field] : null]),
      ) as ResetPasswordErrors,
  );
  const $checks = combine($values, $checked, ({ password }, checked) =>
    checkPasswordRules(NEW_PASSWORD_RULES, password, { showFailures: checked.includes("password") }),
  );

  const passwordTyped = sample({ clock: fieldChanged, filter: ({ field }) => field === "password" });

  const validated = sample({
    clock: submitted,
    source: { values: $values, screen: $screen, pending: $pending },
    filter: ({ screen, pending }) => screen === "form" && !pending,
    fn: ({ values }) => ({ values, invalidField: findFirstInvalidField(validateResetPasswordForm(values)) }),
  });

  sample({ clock: tokenReceived, target: $token });

  sample({ clock: tokenReceived, fn: () => emptyResetPasswordValues, target: $values });

  sample({ clock: tokenReceived, fn: () => [], target: $checked });

  sample({ clock: tokenReceived, fn: () => null, target: [$formError, $focusRequest] });

  sample({ clock: tokenReceived, fn: () => "", target: $announcement });

  sample({ clock: tokenReceived, filter: (token) => token === null, fn: () => "expired" as const, target: $screen });

  sample({
    clock: tokenReceived,
    filter: (token): token is string => token !== null,
    target: checkRequested,
  });

  sample({
    clock: retryPressed,
    source: { token: $token, screen: $screen },
    filter: ({ token, screen }) => token !== null && screen === "failed",
    fn: ({ token }) => token as string,
    target: checkRequested,
  });

  sample({ clock: checkRequested, fn: () => "checking" as const, target: $screen });

  sample({ clock: checkRequested, target: checkMutation.start });

  sample({ clock: checkMutation.finished.success, fn: () => "form" as const, target: $screen });

  sample({
    clock: checkMutation.finished.failure,
    fn: ({ error }) => (isLinkExpiredError(toApiError(error)) ? ("expired" as const) : ("failed" as const)),
    target: $screen,
  });

  sample({
    clock: fieldChanged,
    source: $values,
    fn: (values, { field, value }) => ({ ...values, [field]: value }),
    target: $values,
  });

  sample({
    clock: fieldBlurred,
    source: $checked,
    filter: (checked, field) => !checked.includes(field),
    fn: (checked, field) => [...checked, field],
    target: $checked,
  });

  sample({ clock: validated, fn: () => [...RESET_PASSWORD_FIELDS], target: $checked });

  sample({ clock: validated, fn: () => null, target: $formError });

  sample({
    clock: validated,
    filter: ({ invalidField }) => invalidField !== null,
    fn: ({ invalidField }) => invalidField as ResetPasswordField,
    target: focusRequested,
  });

  sample({ clock: debounce(passwordTyped, ANNOUNCEMENT_DELAY_MS), target: announced });

  sample({ clock: fieldBlurred, filter: (field) => field === "password", target: announced });

  sample({
    clock: validated,
    filter: ({ values }) => validateResetPasswordForm(values).password !== null,
    target: announced,
  });

  sample({
    clock: announced,
    source: { values: $values, screen: $screen },
    filter: ({ screen }) => screen === "form",
    fn: ({ values }) => announcePasswordRules(values.password),
    target: $announcement,
  });

  sample({
    clock: validated,
    source: $token,
    filter: (token, { invalidField }) => token !== null && invalidField === null,
    fn: (token, { values }) => ({ token: token as string, new_password: values.password }),
    target: completeMutation.start,
  });

  sample({ clock: completeMutation.finished.success, fn: ({ result }) => result, target: completed });

  const completeFailed = completeMutation.finished.failure.map(({ error }) => toApiError(error));

  sample({
    clock: completeFailed,
    filter: isLinkExpiredError,
    fn: () => "expired" as const,
    target: $screen,
  });

  sample({
    clock: completeFailed,
    filter: (error) => !isLinkExpiredError(error),
    fn: getCompleteErrorMessage,
    target: $formError,
  });

  sample({
    clock: focusRequested,
    source: $focusRequest,
    fn: (previous, field) => ({ field, id: (previous?.id ?? 0) + 1 }),
    target: $focusRequest,
  });

  sample({ clock: reset, fn: () => null, target: [$token, $formError, $focusRequest] });

  sample({ clock: reset, fn: () => "checking" as const, target: $screen });

  sample({ clock: reset, fn: () => emptyResetPasswordValues, target: $values });

  sample({ clock: reset, fn: () => [], target: $checked });

  sample({ clock: reset, fn: () => "", target: $announcement });

  return {
    inputs: { tokenReceived, fieldChanged, fieldBlurred, submitted, retryPressed, reset },

    outputs: {
      $screen: readonly($screen),
      $values: readonly($values),
      $errors,
      $checks,
      $formError: readonly($formError),
      $pending: readonly($pending),
      $focusRequest: readonly($focusRequest),
      $announcement: readonly($announcement),
      completed: readonly(completed),
    },

    __: { checkMutation, completeMutation },
  };
});

export type ResetPasswordModel = ReturnType<typeof createResetPasswordFactory>;
