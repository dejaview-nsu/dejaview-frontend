import { createFactory } from "@withease/factories";
import { combine, createEvent, createStore, sample } from "effector";
import { readonly } from "patronum";

import { getRegisterServerMessage, toRegisterField, validateBirthYear, validateUsername } from "@/features/register";

import { type ApiError, type AuthOidcCompleteRequest, type SessionInfo, toApiError } from "@/shared/api";

import { type createOidcCallbackApi } from "../api/request";

export type CompletionField = "username" | "birthYear";

const COMPLETION_FIELDS: CompletionField[] = ["username", "birthYear"];

type CompletionValues = Record<CompletionField, string>;

const emptyValues: CompletionValues = { username: "", birthYear: "" };

const validate = (values: CompletionValues) => ({
  username: validateUsername(values.username),
  birthYear: validateBirthYear(values.birthYear),
});

export const createOidcCompletionFactory = createFactory(
  ({ completeMutation }: Pick<ReturnType<typeof createOidcCallbackApi>, "completeMutation">) => {
    const prefilled = createEvent<string>();
    const fieldChanged = createEvent<{ field: CompletionField; value: string }>();
    const fieldBlurred = createEvent<CompletionField>();
    const submitted = createEvent();
    const reset = createEvent();
    const completed = createEvent<SessionInfo>();
    const expired = createEvent();
    const focusRequested = createEvent<CompletionField>();

    const $values = createStore<CompletionValues>(emptyValues);
    const $checked = createStore<CompletionField[]>([]);
    const $serverError = createStore<ApiError | null>(null);
    const $focusRequest = createStore<{ field: CompletionField; id: number } | null>(null);
    const $pending = completeMutation.$pending;

    const $serverField = $serverError.map((error) => {
      const field = toRegisterField(error?.field ?? null);

      return field === "username" || field === "birthYear" ? field : null;
    });

    const $errors = combine($values, $checked, $serverField, (values, checked, serverField) => {
      const client = validate(values);

      return Object.fromEntries(
        COMPLETION_FIELDS.map((field) => [
          field,
          checked.includes(field) && client[field] !== null
            ? client[field]
            : serverField === field
              ? { message: null }
              : null,
        ]),
      ) as Record<CompletionField, { message: string | null } | null>;
    });

    const $formError = $serverError.map((error) => (error ? getRegisterServerMessage(error) : null));

    const $formErrorHasField = $serverField.map((field) => field !== null);

    const validated = sample({
      clock: submitted,
      source: { values: $values, pending: $pending },
      filter: ({ pending }) => !pending,
      fn: ({ values }) => {
        const errors = validate(values);

        return { values, invalidField: COMPLETION_FIELDS.find((field) => errors[field] !== null) ?? null };
      },
    });

    sample({ clock: prefilled, fn: (username) => ({ username, birthYear: "" }), target: $values });

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

    sample({ clock: validated, fn: () => [...COMPLETION_FIELDS], target: $checked });

    sample({ clock: validated, fn: () => null, target: $serverError });

    sample({
      clock: validated,
      filter: ({ invalidField }) => invalidField !== null,
      fn: ({ invalidField }) => invalidField as CompletionField,
      target: focusRequested,
    });

    sample({
      clock: validated,
      filter: ({ invalidField }) => invalidField === null,
      fn: ({ values }): AuthOidcCompleteRequest => ({
        username: values.username,
        birth_year: Number(values.birthYear.trim()),
      }),
      target: completeMutation.start,
    });

    sample({ clock: completeMutation.finished.success, fn: ({ result }) => result, target: completed });

    sample({
      clock: completeMutation.finished.failure,
      filter: ({ error }) => toApiError(error).code === "AUTH_OIDC_EXPIRED",
      target: expired,
    });

    sample({
      clock: completeMutation.finished.failure,
      filter: ({ error }) => toApiError(error).code !== "AUTH_OIDC_EXPIRED",
      fn: ({ error }) => toApiError(error),
      target: $serverError,
    });

    sample({
      clock: $serverField,
      filter: (field): field is CompletionField => field !== null,
      target: focusRequested,
    });

    sample({
      clock: focusRequested,
      source: $focusRequest,
      fn: (previous, field) => ({ field, id: (previous?.id ?? 0) + 1 }),
      target: $focusRequest,
    });

    sample({ clock: [reset, prefilled], fn: () => [], target: $checked });

    sample({ clock: [reset, prefilled], fn: () => null, target: [$serverError, $focusRequest] });

    sample({ clock: reset, fn: () => emptyValues, target: $values });

    return {
      inputs: { prefilled, fieldChanged, fieldBlurred, submitted, reset },

      outputs: {
        $values: readonly($values),
        $errors,
        $formError,
        $formErrorHasField,
        $pending: readonly($pending),
        $focusRequest: readonly($focusRequest),
        completed: readonly(completed),
        expired: readonly(expired),
      },
    };
  },
);

export type OidcCompletionModel = ReturnType<typeof createOidcCompletionFactory>;
