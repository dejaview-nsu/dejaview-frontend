import { createFactory } from "@withease/factories";
import { combine, createEvent, createStore, sample } from "effector";
import { readonly } from "patronum";

import { type ApiError, toApiError } from "@/shared/api";

import { createRegisterApi } from "../api/request";
import {
  checkPassword,
  emptyRegisterValues,
  findFirstInvalidField,
  getRegisterServerMessage,
  REGISTER_FIELDS,
  type RegisterErrors,
  type RegisterField,
  type RegisterValues,
  toRegisterField,
  toRegisterRequest,
  validateRegisterForm,
} from "../lib/validation";

export type RegisterConfirmation = { email: string; resendAfter: number };

export type FocusRequest = { field: RegisterField; id: number };

export const createRegisterFactory = createFactory(() => {
  const { registerMutation } = createRegisterApi();

  const fieldChanged = createEvent<{ field: RegisterField; value: string }>();
  const fieldBlurred = createEvent<RegisterField>();
  const submitted = createEvent();
  const reset = createEvent();
  const focusRequested = createEvent<RegisterField>();

  const $values = createStore<RegisterValues>(emptyRegisterValues);
  const $checked = createStore<RegisterField[]>([]);
  const $serverError = createStore<ApiError | null>(null);
  const $confirmation = createStore<RegisterConfirmation | null>(null);
  const $focusRequest = createStore<FocusRequest | null>(null);
  const $pending = registerMutation.$pending;

  const $clientErrors = $values.map(validateRegisterForm);
  const $serverField = $serverError.map((error) => toRegisterField(error?.field ?? null));

  const $errors = combine(
    $clientErrors,
    $checked,
    $serverField,
    (client, checked, serverField) =>
      Object.fromEntries(
        REGISTER_FIELDS.map((field) => [
          field,
          checked.includes(field) && client[field] !== null
            ? client[field]
            : serverField === field
              ? { message: null }
              : null,
        ]),
      ) as RegisterErrors,
  );

  const $formError = $serverError.map((error) => (error ? getRegisterServerMessage(error) : null));

  const $formErrorHasField = $serverField.map((field) => field !== null);

  const $passwordChecks = $values.map(({ password }) => checkPassword(password));

  const validated = sample({
    clock: submitted,
    source: { values: $values, pending: $pending },
    filter: ({ pending }) => !pending,
    fn: ({ values }) => ({ values, invalidField: findFirstInvalidField(validateRegisterForm(values)) }),
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

  sample({ clock: validated, fn: () => [...REGISTER_FIELDS], target: $checked });

  sample({ clock: validated, fn: () => null, target: $serverError });

  sample({
    clock: validated,
    filter: ({ invalidField }) => invalidField !== null,
    fn: ({ invalidField }) => invalidField as RegisterField,
    target: focusRequested,
  });

  sample({
    clock: validated,
    filter: ({ invalidField }) => invalidField === null,
    fn: ({ values }) => toRegisterRequest(values),
    target: registerMutation.start,
  });

  sample({
    clock: registerMutation.finished.success,
    fn: ({ params, result }) => ({ email: params.email, resendAfter: result.resend_after }),
    target: $confirmation,
  });

  sample({ clock: registerMutation.finished.failure, fn: ({ error }) => toApiError(error), target: $serverError });

  sample({
    clock: registerMutation.finished.failure,
    filter: ({ error }) => toRegisterField(toApiError(error).field) !== null,
    fn: ({ error }) => toRegisterField(toApiError(error).field) as RegisterField,
    target: focusRequested,
  });

  sample({
    clock: focusRequested,
    source: $focusRequest,
    fn: (previous, field) => ({ field, id: (previous?.id ?? 0) + 1 }),
    target: $focusRequest,
  });

  sample({ clock: reset, fn: () => emptyRegisterValues, target: $values });

  sample({ clock: reset, fn: () => [], target: $checked });

  sample({ clock: reset, fn: () => null, target: [$serverError, $confirmation, $focusRequest] });

  return {
    inputs: { fieldChanged, fieldBlurred, submitted, reset },

    outputs: {
      $values: readonly($values),
      $errors,
      $formError,
      $formErrorHasField,
      $passwordChecks,
      $pending: readonly($pending),
      $confirmation: readonly($confirmation),
      $focusRequest: readonly($focusRequest),
    },
  };
});

export type RegisterModel = ReturnType<typeof createRegisterFactory>;
