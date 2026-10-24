import { Mail } from "lucide-react";
import { useEffect, useRef } from "react";

import { CONFIRMATION_MESSAGES } from "@/shared/config/auth-messages";
import { IconTile } from "@/shared/ui";

import { type ResendConfirmationModel } from "../model";
import { ResendControls } from "./resend-controls";

export const CheckEmail = ({ model, email }: { model: ResendConfirmationModel; email: string | null }) => {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby="check-email-title" className="flex flex-col items-center gap-4 text-center">
      <IconTile>
        <Mail size={32} strokeWidth={1.75} />
      </IconTile>
      <h1
        id="check-email-title"
        ref={headingRef}
        tabIndex={-1}
        className="font-heading text-mobile-heading-2 font-extrabold outline-link focus-visible:outline-2 md:text-heading-2"
      >
        Проверь почту
      </h1>
      {email ? (
        <p className="text-base leading-normal">
          На адрес <strong className="font-semibold underline underline-offset-3">{email}</strong> отправлено письмо.
          Перейдите по ссылке в письме для завершения регистрации
        </p>
      ) : (
        <p className="text-base leading-normal">{CONFIRMATION_MESSAGES.sentWithoutEmail}</p>
      )}
      <p className="text-sm leading-normal text-muted">
        Ссылка действует 24 часа. Не видишь письма — проверь папку «Спам»
      </p>

      <ResendControls model={model} label={CONFIRMATION_MESSAGES.resend} />
    </section>
  );
};
