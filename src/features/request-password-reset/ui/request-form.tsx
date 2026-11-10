import { useUnit } from "effector-react";
import { CircleAlert, KeyRound, LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";

import { revealElement } from "@/shared/lib/reveal";
import { routes } from "@/shared/routes";
import { BackLink, Button, FormField, IconTile } from "@/shared/ui";

import { REQUEST_PASSWORD_RESET_TEXTS as TEXTS } from "../config";
import { type RequestPasswordResetModel } from "../model";

export const RequestPasswordResetForm = ({ model }: { model: RequestPasswordResetModel }) => {
  const { value, fieldError, formError, pending, focusRequest, change, blur, submit } = useUnit({
    value: model.outputs.$value,
    fieldError: model.outputs.$fieldError,
    formError: model.outputs.$formError,
    pending: model.outputs.$pending,
    focusRequest: model.outputs.$focusRequest,
    change: model.inputs.changed,
    blur: model.inputs.blurred,
    submit: model.inputs.submitted,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusRequest) return;

    const timer = window.setTimeout(() => revealElement(inputRef.current), 0);

    return () => window.clearTimeout(timer);
  }, [focusRequest]);

  useEffect(() => {
    if (formError) revealElement(formErrorRef.current);
  }, [formError]);

  return (
    <section aria-labelledby="forgot-password-title" className="flex flex-col font-body text-ink">
      <IconTile>
        <KeyRound size={32} strokeWidth={1.75} />
      </IconTile>
      <h1
        id="forgot-password-title"
        className="mt-4 font-heading text-mobile-heading-2 font-extrabold text-black md:text-heading-2"
      >
        {TEXTS.title}
      </h1>
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
        aria-label={TEXTS.formLabel}
        aria-busy={pending}
        className="mt-6 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <FormField
          appearance="login"
          id="forgot-password-login"
          name="login"
          label={TEXTS.loginLabel}
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={fieldError ? undefined : TEXTS.loginPlaceholder}
          value={value}
          error={fieldError}
          inputRef={inputRef}
          onChange={(event) => change(event.currentTarget.value)}
          onBlur={() => blur()}
        />
        <Button
          type="submit"
          variant={pending ? "brand-loading" : "brand"}
          isDisabled={pending}
          aria-busy={pending}
          className="w-full tracking-[1.5px]"
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
