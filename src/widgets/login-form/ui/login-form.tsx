import { Link } from "@effector/router-react";
import { useUnit } from "effector-react";
import { CircleAlert, LoaderCircle, LockKeyhole, RotateCwClock, TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";

import { ResendControls } from "@/features/resend-confirmation";

import { CONFIRMATION_MESSAGES, LOGIN_MESSAGES } from "@/shared/config/auth-messages";
import { cn } from "@/shared/lib/cn";
import { revealElement } from "@/shared/lib/reveal";
import { routes } from "@/shared/routes";
import { Button, FormField } from "@/shared/ui";

import { type LoginField } from "../lib/validation";
import { type LoginFormModel } from "../model/login-form";

export const LoginForm = ({
  model,
  id,
  registerPath,
}: {
  model: LoginFormModel;
  id: string;
  registerPath?: string | null;
}) => {
  const {
    values,
    errors,
    messages,
    pending,
    locked,
    accountBlocked,
    focusRequest,
    emailNotConfirmed,
    confirmationSent,
    change,
    blur,
    submit,
  } = useUnit({
    values: model.outputs.$values,
    errors: model.outputs.$errors,
    messages: model.outputs.$messages,
    pending: model.outputs.$pending,
    locked: model.outputs.$locked,
    accountBlocked: model.outputs.$accountBlocked,
    focusRequest: model.outputs.$focusRequest,
    emailNotConfirmed: model.outputs.$emailNotConfirmed,
    confirmationSent: model.outputs.$confirmationSent,
    change: model.inputs.fieldChanged,
    blur: model.inputs.fieldBlurred,
    submit: model.inputs.submitted,
  });

  const inputs = useRef<Partial<Record<LoginField, HTMLInputElement | null>>>({});
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focusRequest) return;

    // React Aria finishes focusing the pressed button after synchronous submit handlers.
    const timer = window.setTimeout(() => revealElement(inputs.current[focusRequest.field]), 0);

    return () => window.clearTimeout(timer);
  }, [focusRequest]);

  useEffect(() => {
    if (messages.length > 0) revealElement(messageRef.current);
  }, [messages]);

  return (
    <div className="flex min-w-0 flex-col gap-4.5 font-body text-ink">
      {messages.length > 0 && (
        <div
          ref={messageRef}
          role="alert"
          tabIndex={-1}
          className={cn(
            "flex scroll-mt-6 gap-2.5 border-2 px-3 py-3.5 text-sm leading-normal outline-link",
            emailNotConfirmed
              ? "items-start border-border-default bg-warning-bg text-warning-text"
              : "items-center border-error-text bg-error-bg text-error-text",
          )}
        >
          {emailNotConfirmed ? (
            <TriangleAlert className="shrink-0" size={24} strokeWidth={1.75} aria-hidden="true" />
          ) : locked ? (
            <RotateCwClock className="shrink-0" size={24} strokeWidth={1.75} aria-hidden="true" />
          ) : accountBlocked ? (
            <LockKeyhole className="shrink-0" size={24} strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <CircleAlert className="shrink-0" size={24} strokeWidth={1.75} aria-hidden="true" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            {messages.map((message) => (
              <p key={message}>{message}</p>
            ))}
            {emailNotConfirmed && (
              <>
                {confirmationSent && (
                  <p role="status" className="text-success-text">
                    {CONFIRMATION_MESSAGES.sentWithoutEmail}
                  </p>
                )}
                <ResendControls model={model.outputs.$$resend} label={LOGIN_MESSAGES.sendNewLink} compact />
              </>
            )}
          </div>
        </div>
      )}

      <form
        noValidate
        aria-label="Вход в DejaView"
        aria-busy={pending}
        className="flex flex-col gap-4.5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <FormField
          appearance="login"
          id={`${id}-login`}
          name="login"
          label="Имя пользователя или Email"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={errors.login ? undefined : "anna_k или anna@mail.ru"}
          value={values.login}
          disabled={pending || locked}
          muted={locked}
          error={errors.login}
          inputRef={(element) => {
            inputs.current.login = element;
          }}
          onChange={(event) => change({ field: "login", value: event.currentTarget.value })}
          onBlur={() => blur("login")}
        />
        <FormField
          appearance="login"
          id={`${id}-password`}
          name="password"
          label="Пароль"
          type="password"
          autoComplete="current-password"
          revealable={!locked}
          value={values.password}
          disabled={pending || locked}
          muted={locked}
          error={errors.password}
          inputRef={(element) => {
            inputs.current.password = element;
          }}
          onChange={(event) => change({ field: "password", value: event.currentTarget.value })}
          onBlur={() => blur("password")}
        />
        <Button
          type="submit"
          variant={pending ? "brand-loading" : "brand"}
          isDisabled={pending || locked}
          aria-busy={pending}
          className="w-full tracking-[1.5px]"
        >
          {pending && (
            <LoaderCircle className="motion-safe:animate-spin" size={20} strokeWidth={1.75} aria-hidden="true" />
          )}
          {pending ? "Входим..." : "Войти"}
        </Button>
      </form>

      <p className="-mx-2 text-center text-base leading-[1.55] whitespace-nowrap">
        Нет аккаунта?{" "}
        <Link
          to={routes.register}
          query={registerPath ? { redirect: registerPath } : {}}
          className="relative font-bold text-link outline-link after:absolute after:inset-x-0 after:-inset-y-2 hover:underline focus-visible:outline-2"
        >
          Зарегистрироваться
        </Link>
      </p>
    </div>
  );
};
