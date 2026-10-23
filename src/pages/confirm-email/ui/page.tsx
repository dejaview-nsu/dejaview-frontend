import { useUnit } from "effector-react";
import { CircleAlert, LoaderCircle, Unlink } from "lucide-react";

import { AuthShell } from "@/layouts/auth";

import { CheckEmail, ResendControls } from "@/features/resend-confirmation";

import { CONFIRMATION_MESSAGES } from "@/shared/config/auth-messages";
import { Button, IconTile, Panel } from "@/shared/ui";

import { $$confirmEmail } from "../model";

const $$resend = $$confirmEmail.outputs.$$resend;

const LinkExpired = () => (
  <section aria-labelledby="link-expired-title" className="flex flex-col items-center gap-4 text-center">
    <IconTile>
      <Unlink size={32} strokeWidth={1.75} />
    </IconTile>
    <h1 id="link-expired-title" className="font-heading text-mobile-heading-2 font-extrabold md:text-heading-2">
      {CONFIRMATION_MESSAGES.linkExpired}
    </h1>
    <p className="text-base leading-normal">Ссылка для подтверждения действует 24 часа. Запросите новую.</p>
    <ResendControls model={$$resend} label={CONFIRMATION_MESSAGES.sendNewLink} variant="brand" />
  </section>
);

export const ConfirmEmailPage = () => {
  const { screen, error, pending, retry } = useUnit({
    screen: $$confirmEmail.outputs.$screen,
    error: $$confirmEmail.outputs.$error,
    pending: $$confirmEmail.outputs.$pending,
    retry: $$confirmEmail.inputs.retryPressed,
  });

  return (
    <AuthShell>
      <Panel>
        {screen === "pending" && (
          <p role="status" aria-busy="true" className="flex items-center justify-center gap-3 text-base">
            <LoaderCircle
              className="shrink-0 motion-safe:animate-spin"
              size={24}
              strokeWidth={1.75}
              aria-hidden="true"
            />
            Подтверждаем email…
          </p>
        )}

        {screen === "failed" && (
          <section aria-label="Подтверждение email" className="flex flex-col items-center gap-5 text-center">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2.5 border-2 border-error-text bg-error-bg px-4 py-3 text-left text-sm leading-normal text-error-text"
              >
                <CircleAlert className="mt-px shrink-0" size={20} strokeWidth={1.75} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}
            <Button variant="brand" isDisabled={pending} aria-busy={pending} onPress={() => retry()}>
              {pending && (
                <LoaderCircle className="motion-safe:animate-spin" size={20} strokeWidth={1.75} aria-hidden="true" />
              )}
              Повторить
            </Button>
          </section>
        )}

        {screen === "expired" && <LinkExpired />}

        {screen === "sent" && <CheckEmail model={$$resend} email={null} />}
      </Panel>
    </AuthShell>
  );
};
