import { useUnit } from "effector-react";
import { KeyRound, LoaderCircle } from "lucide-react";
import { type ChangeEvent, useEffect, useRef } from "react";

import { PASSWORD_MESSAGES } from "@/shared/config/auth-messages";
import { revealElement } from "@/shared/lib/reveal";
import { Alert, Button, FormField, PasswordChecklist } from "@/shared/ui";

import { CHANGE_PASSWORD_TEXTS as TEXTS } from "../config";
import { type ChangePasswordField } from "../lib/validation";
import { type ChangePasswordModel } from "../model";

const AUTOCOMPLETE: Record<ChangePasswordField, string> = {
  current: "current-password",
  password: "new-password",
  confirmation: "new-password",
};

const CardHeading = ({ requiresCurrent, isOpen }: { requiresCurrent: boolean; isOpen: boolean }) => (
  <div className="flex min-w-0 flex-1 items-start gap-4">
    <span className="flex size-12 shrink-0 items-center justify-center bg-header text-brand-gold" aria-hidden="true">
      <KeyRound size={24} strokeWidth={1.75} />
    </span>
    <div className="flex min-w-0 flex-col gap-1">
      <h3 id="change-password-title" className="font-heading text-xl leading-tight font-bold">
        {TEXTS.title}
      </h3>
      <p className="text-sm leading-normal text-muted">
        {isOpen && !requiresCurrent ? TEXTS.noPasswordDescription : TEXTS.description}
      </p>
    </div>
  </div>
);

export const ChangePasswordSection = ({ model }: { model: ChangePasswordModel }) => {
  const {
    isOpen,
    requiresCurrent,
    values,
    errors,
    checks,
    formError,
    isSucceeded,
    pending,
    focusRequest,
    announcement,
    open,
    cancel,
    changeField,
    blurField,
    submit,
  } = useUnit({
    isOpen: model.outputs.$isOpen,
    requiresCurrent: model.outputs.$requiresCurrent,
    values: model.outputs.$values,
    errors: model.outputs.$errors,
    checks: model.outputs.$checks,
    formError: model.outputs.$formError,
    isSucceeded: model.outputs.$isSucceeded,
    pending: model.outputs.$pending,
    focusRequest: model.outputs.$focusRequest,
    announcement: model.outputs.$announcement,
    open: model.inputs.opened,
    cancel: model.inputs.cancelled,
    changeField: model.inputs.fieldChanged,
    blurField: model.inputs.fieldBlurred,
    submit: model.inputs.submitted,
  });

  const inputs = useRef<Partial<Record<ChangePasswordField, HTMLInputElement | null>>>({});
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(isOpen);

  useEffect(() => {
    if (isOpen && !wasOpen.current) inputs.current[requiresCurrent ? "current" : "password"]?.focus();

    if (!isOpen && wasOpen.current) {
      if (isSucceeded) successRef.current?.focus();
      else openButtonRef.current?.focus();
    }

    wasOpen.current = isOpen;
  }, [isOpen, isSucceeded, requiresCurrent]);

  useEffect(() => {
    if (!focusRequest) return;

    const timer = window.setTimeout(() => revealElement(inputs.current[focusRequest.field]), 0);

    return () => window.clearTimeout(timer);
  }, [focusRequest]);

  useEffect(() => {
    if (formError) revealElement(formErrorRef.current);
  }, [formError]);

  const field = (name: ChangePasswordField) => ({
    id: `change-password-${name}`,
    name,
    type: "password",
    autoComplete: AUTOCOMPLETE[name],
    revealable: true,
    appearance: "login" as const,
    value: values[name],
    error: errors[name],
    inputRef: (element: HTMLInputElement | null) => {
      inputs.current[name] = element;
    },
    onChange: (event: ChangeEvent<HTMLInputElement>) => changeField({ field: name, value: event.currentTarget.value }),
    onBlur: () => blurField(name),
  });

  return (
    <div className="flex w-full max-w-150 flex-col gap-8">
      {isSucceeded && (
        <Alert tone="success" alertRef={successRef} className="text-base">
          {PASSWORD_MESSAGES.changed}
        </Alert>
      )}

      <section
        aria-labelledby="change-password-title"
        className="border-2 border-border-strong bg-card p-5 shadow-hard md:p-6"
      >
        {!isOpen ? (
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-4">
            <CardHeading requiresCurrent={requiresCurrent} isOpen={false} />
            <Button
              ref={openButtonRef}
              variant="brand-secondary-small"
              className="w-full shrink-0 md:w-auto"
              onPress={() => open()}
            >
              {TEXTS.open}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col">
            <CardHeading requiresCurrent={requiresCurrent} isOpen />

            <hr className="my-5 border-0 border-t-2 border-dashed border-divider" />

            {formError && (
              <Alert tone="error" alertRef={formErrorRef} className="mb-5">
                {formError}
              </Alert>
            )}

            <form
              noValidate
              aria-labelledby="change-password-title"
              aria-busy={pending}
              className="flex flex-col gap-5"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              {requiresCurrent && <FormField {...field("current")} label={TEXTS.currentLabel} />}
              <FormField
                {...field("password")}
                label={TEXTS.passwordLabel}
                keepHint
                hint={<PasswordChecklist checks={checks} />}
              />
              <p aria-live="polite" className="sr-only">
                {announcement}
              </p>
              <FormField {...field("confirmation")} label={TEXTS.confirmationLabel} />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Button type="submit" variant={pending ? "brand-loading" : "brand"} isDisabled={pending}>
                  {pending && (
                    <LoaderCircle
                      className="motion-safe:animate-spin"
                      size={20}
                      strokeWidth={1.75}
                      aria-hidden="true"
                    />
                  )}
                  {pending ? TEXTS.submitting : TEXTS.submit}
                </Button>
                <Button variant="brand-secondary" onPress={() => cancel()}>
                  {TEXTS.cancel}
                </Button>
              </div>
            </form>
          </div>
        )}
      </section>
    </div>
  );
};
