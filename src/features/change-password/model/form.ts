import { concurrency, createMutation } from "@farfetched/core";
import { createFactory } from "@withease/factories";
import { combine, createEvent, createStore, merge, sample, type Store } from "effector";
import { debounce, not, readonly } from "patronum";

import { toApiError, type UserPasswordChangeRequest } from "@/shared/api";
import { announcePasswordRules, checkPasswordRules, NEW_PASSWORD_RULES } from "@/shared/lib/password";

import { changePassword } from "../api/request";
import { ANNOUNCEMENT_DELAY_MS } from "../config";
import {
  CHANGE_PASSWORD_FIELDS,
  type ChangePasswordErrors,
  type ChangePasswordFailure,
  type ChangePasswordField,
  type ChangePasswordValues,
  describeChangePasswordFailure,
  emptyChangePasswordValues,
  findFirstInvalidField,
  type ServerFieldErrors,
  validateChangePasswordForm,
  visibleFields,
} from "../lib/validation";

export type ChangePasswordFocusRequest = { field: ChangePasswordField; id: number };

type Request = { body: UserPasswordChangeRequest; revision: number };
type FormFailure = Extract<ChangePasswordFailure, { kind: "form" }>;
type FieldFailure = Extract<ChangePasswordFailure, { kind: "field" }>;

export const createChangePasswordFactory = createFactory(({ $hasPassword }: { $hasPassword: Store<boolean> }) => {
  const opened = createEvent();
  const cancelled = createEvent();
  const reset = createEvent();
  const fieldChanged = createEvent<{ field: ChangePasswordField; value: string }>();
  const fieldBlurred = createEvent<ChangePasswordField>();
  const submitted = createEvent();
  const focusRequested = createEvent<ChangePasswordField>();
  const announced = createEvent();
  const submitStarted = createEvent<Request>();
  const succeeded = createEvent();

  const closed = merge([cancelled, reset]);

  const changeMutation = createMutation({
    name: "profile.changePassword",
    handler: ({ body }: Request) => changePassword(body),
  });

  const $isOpen = createStore(false);
  const $requiresCurrent = createStore(true);
  const $values = createStore<ChangePasswordValues>(emptyChangePasswordValues);
  const $checked = createStore<ChangePasswordField[]>([]);
  const $serverErrors = createStore<ServerFieldErrors>({});
  const $formError = createStore<string | null>(null);
  const $isSucceeded = createStore(false);
  const $revision = createStore(0);
  const $pending = createStore(false);
  const $focusRequest = createStore<ChangePasswordFocusRequest | null>(null);
  const $announcement = createStore("");

  concurrency(changeMutation, { strategy: "TAKE_LATEST", abortAll: closed });

  const $clientErrors = combine($values, $requiresCurrent, validateChangePasswordForm);

  const $errors = combine(
    { errors: $clientErrors, checked: $checked, server: $serverErrors, requiresCurrent: $requiresCurrent },
    ({ errors, checked, server, requiresCurrent }) => {
      const fields = visibleFields(requiresCurrent);

      return Object.fromEntries(
        CHANGE_PASSWORD_FIELDS.map((field) => {
          const serverMessage = server[field];

          if (!fields.includes(field)) return [field, null];
          if (serverMessage) return [field, { message: serverMessage }];

          return [field, checked.includes(field) ? errors[field] : null];
        }),
      ) as ChangePasswordErrors;
    },
  );

  const $checks = combine($values, $checked, ({ password }, checked) =>
    checkPasswordRules(NEW_PASSWORD_RULES, password, { showFailures: checked.includes("password") }),
  );

  const openStarted = sample({ clock: opened, filter: not($isOpen) });

  const formCleared = merge([openStarted, closed]);

  sample({ clock: openStarted, fn: () => true, target: $isOpen });

  sample({ clock: openStarted, source: $hasPassword, target: $requiresCurrent });

  sample({ clock: openStarted, fn: () => false, target: $isSucceeded });

  sample({ clock: formCleared, fn: () => emptyChangePasswordValues, target: $values });

  sample({ clock: formCleared, fn: () => [], target: $checked });

  sample({ clock: formCleared, fn: () => ({}), target: $serverErrors });

  sample({ clock: formCleared, fn: () => null, target: [$formError, $focusRequest] });

  sample({ clock: formCleared, fn: () => "", target: $announcement });

  sample({ clock: closed, fn: () => false, target: [$isOpen, $pending] });

  sample({ clock: reset, fn: () => false, target: $isSucceeded });

  sample({ clock: closed, source: $revision, fn: (revision) => revision + 1, target: $revision });

  sample({
    clock: fieldChanged,
    source: $values,
    fn: (values, { field, value }) => ({ ...values, [field]: value }),
    target: $values,
  });

  sample({
    clock: fieldChanged,
    source: $serverErrors,
    filter: (errors, { field }) => field in errors,
    fn: (errors, { field }) => Object.fromEntries(Object.entries(errors).filter(([key]) => key !== field)),
    target: $serverErrors,
  });

  sample({
    clock: fieldBlurred,
    source: $checked,
    filter: (checked, field) => !checked.includes(field),
    fn: (checked, field) => [...checked, field],
    target: $checked,
  });

  const validated = sample({
    clock: submitted,
    source: { values: $values, requiresCurrent: $requiresCurrent, isOpen: $isOpen, pending: $pending },
    filter: ({ isOpen, pending }) => isOpen && !pending,
    fn: ({ values, requiresCurrent }) => ({
      values,
      requiresCurrent,
      invalidField: findFirstInvalidField(validateChangePasswordForm(values, requiresCurrent)),
    }),
  });

  sample({ clock: validated, fn: () => [...CHANGE_PASSWORD_FIELDS], target: $checked });

  sample({ clock: validated, fn: () => null, target: $formError });

  sample({ clock: validated, fn: () => ({}), target: $serverErrors });

  sample({
    clock: validated,
    filter: ({ invalidField }) => invalidField !== null,
    fn: ({ invalidField }) => invalidField as ChangePasswordField,
    target: focusRequested,
  });

  sample({
    clock: validated,
    source: $revision,
    filter: (_, { invalidField }) => invalidField === null,
    fn: (revision, { values, requiresCurrent }) => ({
      body: requiresCurrent
        ? { current_password: values.current, new_password: values.password }
        : { new_password: values.password },
      revision: revision + 1,
    }),
    target: submitStarted,
  });

  sample({ clock: submitStarted, fn: ({ revision }) => revision, target: $revision });

  sample({ clock: submitStarted, fn: () => true, target: $pending });

  sample({ clock: submitStarted, target: changeMutation.start });

  const finished = sample({
    clock: changeMutation.finished.finally,
    source: $revision,
    filter: (revision, { params }) => revision === params.revision,
  });

  sample({ clock: finished, fn: () => false, target: $pending });

  const changed = sample({
    clock: changeMutation.finished.success,
    source: $revision,
    filter: (revision, { params }) => revision === params.revision,
  });

  sample({ clock: changed, fn: () => false, target: $isOpen });

  sample({ clock: changed, fn: () => true, target: $isSucceeded });

  sample({ clock: changed, fn: () => emptyChangePasswordValues, target: $values });

  sample({ clock: changed, fn: () => [], target: $checked });

  sample({ clock: changed, target: succeeded });

  const failure = sample({
    clock: changeMutation.finished.failure,
    source: $revision,
    filter: (revision, { params }) => revision === params.revision,
    fn: (_, { error }) => describeChangePasswordFailure(toApiError(error)),
  });

  const formFailure = sample({ clock: failure, filter: (value): value is FormFailure => value.kind === "form" });

  sample({ clock: formFailure, fn: ({ message }) => message, target: $formError });

  const fieldFailure = sample({
    clock: failure,
    filter: (value): value is FieldFailure => value.kind === "field",
  });

  sample({ clock: fieldFailure, fn: ({ field, message }) => ({ [field]: message }), target: $serverErrors });

  sample({ clock: fieldFailure, fn: ({ field }) => field, target: focusRequested });

  const passwordTyped = sample({ clock: fieldChanged, filter: ({ field }) => field === "password" });

  sample({ clock: debounce(passwordTyped, ANNOUNCEMENT_DELAY_MS), target: announced });

  sample({ clock: fieldBlurred, filter: (field) => field === "password", target: announced });

  sample({
    clock: validated,
    filter: ({ values, requiresCurrent }) => validateChangePasswordForm(values, requiresCurrent).password !== null,
    target: announced,
  });

  sample({
    clock: announced,
    source: { values: $values, isOpen: $isOpen },
    filter: ({ isOpen }) => isOpen,
    fn: ({ values }) => announcePasswordRules(values.password),
    target: $announcement,
  });

  sample({
    clock: focusRequested,
    source: $focusRequest,
    fn: (previous, field) => ({ field, id: (previous?.id ?? 0) + 1 }),
    target: $focusRequest,
  });

  return {
    inputs: { opened, cancelled, reset, fieldChanged, fieldBlurred, submitted },

    outputs: {
      $isOpen: readonly($isOpen),
      $requiresCurrent: readonly($requiresCurrent),
      $values: readonly($values),
      $errors,
      $checks,
      $formError: readonly($formError),
      $isSucceeded: readonly($isSucceeded),
      $pending: readonly($pending),
      $focusRequest: readonly($focusRequest),
      $announcement: readonly($announcement),
      succeeded: readonly(succeeded),
    },

    __: { changeMutation },
  };
});

export type ChangePasswordModel = ReturnType<typeof createChangePasswordFactory>;
