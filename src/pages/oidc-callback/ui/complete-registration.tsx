import { useUnit } from "effector-react";
import { CircleAlert, LoaderCircle, UserCheck } from "lucide-react";
import { useEffect, useRef } from "react";

import { revealElement } from "@/shared/lib/reveal";
import { Button, FormField, IconTile } from "@/shared/ui";

import { $$oidcCallback } from "../model";

const $$completion = $$oidcCallback.outputs.$$completion;

export const CompleteRegistration = () => {
  const { values, errors, formError, formErrorHasField, pending, focusRequest, changeField, blurField, submit } =
    useUnit({
      values: $$completion.outputs.$values,
      errors: $$completion.outputs.$errors,
      formError: $$completion.outputs.$formError,
      formErrorHasField: $$completion.outputs.$formErrorHasField,
      pending: $$completion.outputs.$pending,
      focusRequest: $$completion.outputs.$focusRequest,
      changeField: $$completion.inputs.fieldChanged,
      blurField: $$completion.inputs.fieldBlurred,
      submit: $$completion.inputs.submitted,
    });

  const username = useRef<HTMLInputElement>(null);
  const birthYear = useRef<HTMLInputElement>(null);
  const formErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusRequest) revealElement((focusRequest.field === "username" ? username : birthYear).current);
  }, [focusRequest]);

  useEffect(() => {
    if (formError && !formErrorHasField) revealElement(formErrorRef.current);
  }, [formError, formErrorHasField]);

  return (
    <section aria-labelledby="oidc-complete-title" className="flex flex-col gap-5">
      <IconTile>
        <UserCheck size={32} strokeWidth={1.75} />
      </IconTile>
      <h1 id="oidc-complete-title" className="font-heading text-mobile-heading-2 font-extrabold md:text-heading-2">
        Завершение регистрации
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
        aria-labelledby="oidc-complete-title"
        className="flex flex-col gap-6"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <FormField
          id="oidc-username"
          name="username"
          label="Имя пользователя"
          autoComplete="username"
          value={values.username}
          error={errors.username}
          inputRef={username}
          onChange={(event) => changeField({ field: "username", value: event.currentTarget.value })}
          onBlur={() => blurField("username")}
        />
        <FormField
          id="oidc-birth-year"
          name="birthYear"
          label="Год рождения"
          inputMode="numeric"
          autoComplete="bday-year"
          maxLength={4}
          placeholder="ГГГГ"
          className="max-w-45"
          value={values.birthYear}
          error={errors.birthYear}
          inputRef={birthYear}
          onChange={(event) => changeField({ field: "birthYear", value: event.currentTarget.value })}
          onBlur={() => blurField("birthYear")}
        />
        <Button type="submit" variant="brand" isDisabled={pending} aria-busy={pending} className="w-full">
          {pending && (
            <LoaderCircle className="motion-safe:animate-spin" size={20} strokeWidth={1.75} aria-hidden="true" />
          )}
          Продолжить
        </Button>
      </form>
    </section>
  );
};
