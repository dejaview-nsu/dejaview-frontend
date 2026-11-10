import { useUnit } from "effector-react";
import { CircleAlert, LoaderCircle, LockKeyhole } from "lucide-react";

import { INTERNAL_ERROR_MESSAGE } from "@/shared/config/auth-messages";
import { routes } from "@/shared/routes";
import { BackLink, Button } from "@/shared/ui";

import { RESET_PASSWORD_TEXTS as TEXTS } from "../config";
import { type ResetPasswordModel } from "../model";
import { ScreenHeading } from "./screen-heading";

export const ResetLinkChecking = () => (
  <section aria-labelledby="reset-link-checking-title" className="flex flex-col font-body">
    <h1 id="reset-link-checking-title" className="sr-only">
      {TEXTS.title}
    </h1>
    <p role="status" aria-busy="true" className="flex items-center justify-center gap-3 text-base text-ink">
      <LoaderCircle className="shrink-0 motion-safe:animate-spin" size={24} strokeWidth={1.75} aria-hidden="true" />
      {TEXTS.checking}
    </p>
  </section>
);

export const ResetLinkCheckFailed = ({ model }: { model: ResetPasswordModel }) => {
  const retry = useUnit(model.inputs.retryPressed);

  return (
    <section aria-labelledby="reset-link-failed-title" className="flex flex-col font-body text-ink">
      <ScreenHeading id="reset-link-failed-title" icon={LockKeyhole} align="start">
        {TEXTS.title}
      </ScreenHeading>
      <div
        role="alert"
        className="mt-6 flex items-center gap-2.5 border-2 border-error-text bg-error-bg px-3 py-3.5 text-sm leading-normal text-error-text"
      >
        <CircleAlert className="shrink-0" size={24} strokeWidth={1.75} aria-hidden="true" />
        <span>{INTERNAL_ERROR_MESSAGE}</span>
      </div>
      <Button variant="brand" onPress={() => retry()} className="mt-6 w-full tracking-[1.5px]">
        {TEXTS.retry}
      </Button>
      <BackLink to={routes.login} className="mt-2">
        {TEXTS.backToLogin}
      </BackLink>
    </section>
  );
};
