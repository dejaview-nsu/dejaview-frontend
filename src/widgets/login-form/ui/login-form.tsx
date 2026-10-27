import { Link } from "@effector/router-react";
import { useUnit } from "effector-react";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";

import { ResendControls } from "@/features/resend-confirmation";

import { CONFIRMATION_MESSAGES, LOGIN_MESSAGES } from "@/shared/config/auth-messages";
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
  const { values, errors, messages, pending, focusRequest, emailNotConfirmed, confirmationSent, change, blur, submit } =
    useUnit({
      values: model.outputs.$values,
      errors: model.outputs.$errors,
      messages: model.outputs.$messages,
      pending: model.outputs.$pending,
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
    if (focusRequest) revealElement(inputs.current[focusRequest.field]);
  }, [focusRequest]);

  useEffect(() => {
    if (messages.length > 0) revealElement(messageRef.current);
  }, [messages]);

  return (
    <div className="flex min-w-0 flex-col gap-6 font-body text-ink">
      {messages.length > 0 && (
        <div
          ref={messageRef}
          role="alert"
          tabIndex={-1}
          className="flex scroll-mt-6 items-start gap-2.5 border-2 border-error-text bg-error-bg px-4 py-3 text-sm leading-normal text-error-text outline-link"
        >
          <CircleAlert className="mt-px shrink-0" size={20} strokeWidth={1.75} aria-hidden="true" />
          <div className="flex min-w-0 flex-col gap-2">
            {messages.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
        </div>
      )}

      <form
        noValidate
        aria-label="Вход в DejaView"
        aria-busy={pending}
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <FormField
          id={`${id}-login`}
          name="login"
          label="Имя пользователя или Email"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="anna_k или anna@mail.ru"
          value={values.login}
          disabled={pending}
          error={errors.login}
          inputRef={(element) => {
            inputs.current.login = element;
          }}
          onChange={(event) => change({ field: "login", value: event.currentTarget.value })}
          onBlur={() => blur("login")}
        />
        <FormField
          id={`${id}-password`}
          name="password"
          label="Пароль"
          type="password"
          autoComplete="current-password"
          revealable
          value={values.password}
          disabled={pending}
          error={errors.password}
          inputRef={(element) => {
            inputs.current.password = element;
          }}
          onChange={(event) => change({ field: "password", value: event.currentTarget.value })}
          onBlur={() => blur("password")}
        />
        <Button type="submit" variant="brand" isDisabled={pending} aria-busy={pending} className="w-full">
          {pending && (
            <LoaderCircle className="motion-safe:animate-spin" size={20} strokeWidth={1.75} aria-hidden="true" />
          )}
          {pending ? "Входим…" : "Войти"}
        </Button>
      </form>

      {emailNotConfirmed && (
        <div className="flex flex-col gap-3">
          {confirmationSent && (
            <p role="status" className="text-sm leading-normal text-success-text">
              {CONFIRMATION_MESSAGES.sentWithoutEmail}
            </p>
          )}
          <ResendControls model={model.outputs.$$resend} label={LOGIN_MESSAGES.sendNewLink} />
        </div>
      )}

      <p className="flex flex-wrap items-center justify-center gap-x-1 text-center text-sm leading-normal">
        Нет аккаунта?{" "}
        <Link
          to={routes.register}
          query={registerPath ? { redirect: registerPath } : {}}
          className="inline-flex min-h-11 items-center font-semibold text-link outline-link hover:underline focus-visible:outline-2"
        >
          Зарегистрироваться
        </Link>
      </p>
    </div>
  );
};
