import { Link } from "@effector/router-react";
import { useUnit } from "effector-react";
import { CircleAlert, Info, Link2, LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";

import { ResendControls } from "@/features/resend-confirmation";

import { LOGIN_MESSAGES, OIDC_MESSAGES } from "@/shared/config/auth-messages";
import { routes } from "@/shared/routes";
import { Button, FormField, IconTile } from "@/shared/ui";

import { $$oidcCallback } from "../model";

const $$link = $$oidcCallback.outputs.$$link;

export const LinkAccount = ({ providerName }: { providerName: string }) => {
  const {
    email,
    password,
    passwordError,
    serverMessages,
    emailNotConfirmed,
    pending,
    focusRequest,
    changePassword,
    blurPassword,
    submit,
  } = useUnit({
    email: $$link.outputs.$email,
    password: $$link.outputs.$password,
    passwordError: $$link.outputs.$passwordError,
    serverMessages: $$link.outputs.$serverMessages,
    emailNotConfirmed: $$link.outputs.$emailNotConfirmed,
    pending: $$link.outputs.$pending,
    focusRequest: $$link.outputs.$focusRequest,
    changePassword: $$link.inputs.passwordChanged,
    blurPassword: $$link.inputs.passwordBlurred,
    submit: $$link.inputs.submitted,
  });

  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusRequest > 0) passwordRef.current?.focus();
  }, [focusRequest]);

  return (
    <section aria-labelledby="oidc-link-title" className="flex flex-col gap-5">
      <IconTile>
        <Link2 size={32} strokeWidth={1.75} />
      </IconTile>
      <p className="flex items-start gap-2.5 border-2 border-border-default bg-warning-bg px-4 py-3 text-sm leading-normal text-warning-text">
        <Info className="mt-0.5 shrink-0" size={20} strokeWidth={1.75} aria-hidden="true" />
        <span id="oidc-link-title">{OIDC_MESSAGES.accountExists({ email, provider: providerName })}</span>
      </p>

      {serverMessages.length > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2.5 border-2 border-error-text bg-error-bg px-4 py-3 text-sm leading-normal text-error-text"
        >
          <CircleAlert className="mt-0.5 shrink-0" size={20} strokeWidth={1.75} aria-hidden="true" />
          <div>
            {serverMessages.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        </div>
      )}

      {emailNotConfirmed && <ResendControls model={$$link.outputs.$$resend} label={LOGIN_MESSAGES.sendNewLink} />}

      <form
        noValidate
        aria-labelledby="oidc-link-title"
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <FormField
          id="oidc-link-email"
          name="login"
          label="Email"
          type="email"
          value={email}
          readOnly
          error={null}
          inputRef={null}
          className="border-transparent bg-disabled-bg"
        />
        <FormField
          id="oidc-link-password"
          name="password"
          label="Пароль"
          type="password"
          revealable
          autoComplete="current-password"
          value={password}
          error={passwordError ? { message: passwordError } : null}
          inputRef={passwordRef}
          onChange={(event) => changePassword(event.currentTarget.value)}
          onBlur={() => blurPassword()}
        />
        <Link
          to={routes.login}
          query={{}}
          className="-mt-4 inline-flex min-h-11 items-center self-start text-sm font-semibold text-link outline-link hover:underline focus-visible:outline-2"
        >
          Забыли пароль?
        </Link>
        <Button type="submit" variant="brand" isDisabled={pending} aria-busy={pending} className="w-full">
          {pending && (
            <LoaderCircle className="motion-safe:animate-spin" size={20} strokeWidth={1.75} aria-hidden="true" />
          )}
          Войти
        </Button>
      </form>
    </section>
  );
};
