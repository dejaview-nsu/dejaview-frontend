import { useUnit } from "effector-react";
import { CircleAlert, LoaderCircle, LockKeyhole } from "lucide-react";
import { type ChangeEvent, useEffect, useRef } from "react";

import { revealElement } from "@/shared/lib/reveal";
import { routes } from "@/shared/routes";
import { BackLink, Button, FormField, PasswordChecklist } from "@/shared/ui";

import { RESET_PASSWORD_TEXTS as TEXTS } from "../config";
import { type ResetPasswordField } from "../lib/validation";
import { type ResetPasswordModel } from "../model";
import { ScreenHeading } from "./screen-heading";

export const NewPasswordForm = ({ model }: { model: ResetPasswordModel }) => {
  const { values, errors, checks, formError, pending, focusRequest, announcement, changeField, blurField, submit } =
    useUnit({
      values: model.outputs.$values,
      errors: model.outputs.$errors,
      checks: model.outputs.$checks,
      formError: model.outputs.$formError,
      pending: model.outputs.$pending,
      focusRequest: model.outputs.$focusRequest,
      announcement: model.outputs.$announcement,
      changeField: model.inputs.fieldChanged,
      blurField: model.inputs.fieldBlurred,
      submit: model.inputs.submitted,
    });

  const inputs = useRef<Partial<Record<ResetPasswordField, HTMLInputElement | null>>>({});
  const formErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusRequest) return;

    const timer = window.setTimeout(() => revealElement(inputs.current[focusRequest.field]), 0);

    return () => window.clearTimeout(timer);
  }, [focusRequest]);

  useEffect(() => {
    if (formError) revealElement(formErrorRef.current);
  }, [formError]);

  const field = (name: ResetPasswordField) => ({
    id: `reset-password-${name}`,
    name,
    type: "password",
    autoComplete: "new-password",
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
    <section aria-labelledby="reset-password-title" className="flex flex-col font-body text-ink">
      <ScreenHeading id="reset-password-title" icon={LockKeyhole} align="start">
        {TEXTS.title}
      </ScreenHeading>
      <p className="mt-4 text-base leading-[1.55] text-muted">{TEXTS.subtitle}</p>

      {formError && (
        <div
          ref={formErrorRef}
          role="alert"
          tabIndex={-1}
          className="mt-6 flex scroll-mt-6 items-center gap-2.5 border-2 border-error-text bg-error-bg px-3 py-3.5 text-sm leading-normal text-error-text outline-link focus-visible:outline-2"
        >
          <CircleAlert className="shrink-0" size={24} strokeWidth={1.75} aria-hidden="true" />
          <span>{formError}</span>
        </div>
      )}

      <form
        noValidate
        aria-labelledby="reset-password-title"
        aria-busy={pending}
        className="mt-6 flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
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
        <Button
          type="submit"
          variant={pending ? "brand-loading" : "brand"}
          isDisabled={pending}
          aria-busy={pending}
          className="-mt-1 w-full tracking-[1.5px]"
        >
          {pending && (
            <LoaderCircle className="motion-safe:animate-spin" size={20} strokeWidth={1.75} aria-hidden="true" />
          )}
          {pending ? TEXTS.submitting : TEXTS.submit}
        </Button>
      </form>

      <BackLink to={routes.login} className="mt-2">
        {TEXTS.backToLogin}
      </BackLink>
    </section>
  );
};
