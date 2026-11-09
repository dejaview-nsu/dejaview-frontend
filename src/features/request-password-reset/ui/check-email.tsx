import { Link } from "@effector/router-react";
import { useUnit } from "effector-react";
import { ArrowLeft, CircleAlert, LoaderCircle, Mail, MousePointer2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "react-aria-components";

import { cn } from "@/shared/lib/cn";
import { routes } from "@/shared/routes";
import { buttonVariants, IconTile } from "@/shared/ui";

import { REQUEST_PASSWORD_RESET_TEXTS as TEXTS } from "../config";
import { type RequestPasswordResetModel } from "../model";

export const PasswordResetSent = ({ model }: { model: RequestPasswordResetModel }) => {
  const { formError, pending, canResend, countdown, resend } = useUnit({
    formError: model.outputs.$formError,
    pending: model.outputs.$pending,
    canResend: model.outputs.$canResend,
    countdown: model.outputs.$countdown,
    resend: model.inputs.resendPressed,
  });

  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section aria-labelledby="password-reset-sent-title" className="flex flex-col items-center text-center font-body">
      <IconTile>
        <Mail size={32} strokeWidth={1.75} />
      </IconTile>
      <h1
        id="password-reset-sent-title"
        ref={headingRef}
        tabIndex={-1}
        className="mt-5 font-heading text-mobile-heading-2 font-extrabold text-black outline-link focus-visible:outline-2 md:text-heading-2"
      >
        {TEXTS.sentTitle}
      </h1>
      <p className="mt-4 flex w-full items-center gap-3 border-l-4 border-brand-gold bg-warning-bg px-4 py-3.5 text-left text-[15px] leading-normal font-medium text-ink">
        <MousePointer2 className="shrink-0" size={24} strokeWidth={1.75} aria-hidden="true" />
        <span>
          {TEXTS.sentHintBefore}
          <strong className="font-semibold">{TEXTS.sentHintBrand}</strong>
          {TEXTS.sentHintAfter}
        </span>
      </p>
      <p className="mt-5 text-base leading-normal text-ink md:text-sm md:text-muted">{TEXTS.sent}</p>
      <p className="mt-4 text-sm leading-normal text-muted">{TEXTS.sentNote}</p>

      {formError && (
        <div
          role="alert"
          className="mt-4 flex w-full items-center gap-2.5 border-2 border-error-text bg-error-bg px-3 py-3.5 text-left text-sm leading-normal text-error-text"
        >
          <CircleAlert className="shrink-0" size={24} strokeWidth={1.75} aria-hidden="true" />
          <span>{formError}</span>
        </div>
      )}

      <div className="mt-4 flex w-full flex-col items-center gap-3 border-t border-dashed border-divider pt-4">
        <Link
          to={routes.login}
          query={{}}
          className={cn(buttonVariants({ variant: "brand-secondary" }), "w-full md:w-auto")}
        >
          <ArrowLeft size={20} strokeWidth={1.75} aria-hidden="true" />
          {TEXTS.backToLogin}
        </Link>
        <Button
          isDisabled={!canResend}
          aria-busy={pending}
          aria-describedby={countdown ? "password-reset-countdown" : undefined}
          onPress={() => resend()}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm leading-normal font-semibold text-link outline-link hover:underline focus-visible:outline-2 disabled:cursor-default disabled:text-disabled-text disabled:no-underline"
        >
          {pending && (
            <LoaderCircle className="motion-safe:animate-spin" size={16} strokeWidth={1.75} aria-hidden="true" />
          )}
          {TEXTS.resend}
        </Button>
        {countdown && (
          <p id="password-reset-countdown" className="-mt-2 text-sm leading-normal text-muted">
            {TEXTS.resendCountdown(countdown)}
          </p>
        )}
      </div>
    </section>
  );
};
