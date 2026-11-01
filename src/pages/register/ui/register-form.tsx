import { Link } from "@effector/router-react";
import { useUnit } from "effector-react";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { type InputHTMLAttributes, useEffect, useRef } from "react";

import { OidcButtons } from "@/features/oidc-sign-in";
import { PASSWORD_MAX_LENGTH, type RegisterField } from "@/features/register";

import { revealElement } from "@/shared/lib/reveal";
import { routes } from "@/shared/routes";
import { Button, FormField } from "@/shared/ui";

import { $$oidcStart, $$registerForm } from "../model";
import { PasswordChecklist } from "./password-checklist";

const fields: {
  field: RegisterField;
  label: string;
  props: InputHTMLAttributes<HTMLInputElement> & { revealable?: boolean; keepHint?: boolean };
}[] = [
  { field: "username", label: "Имя пользователя", props: { type: "text", autoComplete: "username" } },
  { field: "email", label: "Email", props: { type: "email", autoComplete: "email" } },
  {
    field: "birthYear",
    label: "Год рождения",
    props: {
      type: "text",
      inputMode: "numeric",
      autoComplete: "bday-year",
      maxLength: 4,
      placeholder: "ГГГГ",
      className: "max-w-45",
    },
  },
  {
    field: "password",
    label: "Пароль",
    props: {
      type: "password",
      autoComplete: "new-password",
      maxLength: PASSWORD_MAX_LENGTH,
      revealable: true,
      keepHint: true,
    },
  },
  {
    field: "passwordConfirmation",
    label: "Подтверждение пароля",
    props: { type: "password", autoComplete: "new-password", maxLength: PASSWORD_MAX_LENGTH, revealable: true },
  },
];

export const RegisterForm = () => {
  const {
    values,
    errors,
    formError,
    formErrorHasField,
    passwordChecks,
    pending,
    focusRequest,
    changeField,
    blurField,
    submit,
  } = useUnit({
    values: $$registerForm.outputs.$values,
    errors: $$registerForm.outputs.$errors,
    formError: $$registerForm.outputs.$formError,
    formErrorHasField: $$registerForm.outputs.$formErrorHasField,
    passwordChecks: $$registerForm.outputs.$passwordChecks,
    pending: $$registerForm.outputs.$pending,
    focusRequest: $$registerForm.outputs.$focusRequest,
    changeField: $$registerForm.inputs.fieldChanged,
    blurField: $$registerForm.inputs.fieldBlurred,
    submit: $$registerForm.inputs.submitted,
  });

  const inputs = useRef<Partial<Record<RegisterField, HTMLInputElement | null>>>({});
  const formErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusRequest) revealElement(inputs.current[focusRequest.field]);
  }, [focusRequest]);

  useEffect(() => {
    if (formError && !formErrorHasField) revealElement(formErrorRef.current);
  }, [formError, formErrorHasField]);

  return (
    <section aria-labelledby="register-title" className="flex flex-col gap-6">
      <h1
        id="register-title"
        className="text-center font-heading text-mobile-heading-2 font-extrabold desktop:text-left"
      >
        Создать аккаунт
      </h1>

      {formError && (
        <div
          ref={formErrorRef}
          role="alert"
          tabIndex={-1}
          className="flex scroll-mt-6 items-start gap-2.5 border-2 border-error-text bg-error-bg px-4 py-3 text-sm leading-normal text-error-text outline-link focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <CircleAlert className="mt-px shrink-0" size={20} strokeWidth={1.75} aria-hidden="true" />
          <span>{formError}</span>
        </div>
      )}

      <form
        noValidate
        aria-labelledby="register-title"
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {fields.map(({ field, label, props }) => (
          <FormField
            key={field}
            id={`register-${field}`}
            name={field}
            label={label}
            value={values[field]}
            error={errors[field]}
            inputRef={(element) => {
              inputs.current[field] = element;
            }}
            onChange={(event) => changeField({ field, value: event.currentTarget.value })}
            onBlur={() => blurField(field)}
            hint={
              field === "username" ? (
                "От 3 до 30 символов: латинские буквы, цифры и _"
              ) : field === "password" ? (
                <PasswordChecklist checks={passwordChecks} />
              ) : undefined
            }
            {...props}
          />
        ))}

        <Button type="submit" variant="brand" isDisabled={pending} aria-busy={pending} className="w-full">
          {pending && (
            <LoaderCircle className="motion-safe:animate-spin" size={20} strokeWidth={1.75} aria-hidden="true" />
          )}
          {pending ? "Регистрируем…" : "Зарегистрироваться"}
        </Button>
      </form>

      <OidcButtons model={$$oidcStart} />

      <div className="flex flex-col items-center text-base">
        <p className="flex flex-wrap items-center justify-center gap-x-1">
          Уже есть аккаунт?{" "}
          <Link
            to={routes.login}
            query={{}}
            className="inline-flex min-h-11 items-center font-bold text-link outline-link hover:underline focus-visible:outline-2"
          >
            Войти
          </Link>
        </p>
      </div>
    </section>
  );
};
