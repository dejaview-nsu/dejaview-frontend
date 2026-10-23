import { useUnit } from "effector-react";
import { CircleAlert, LoaderCircle, Lock } from "lucide-react";

import { AuthShell } from "@/layouts/auth";

import { LOGIN_MESSAGES } from "@/shared/config/auth-messages";
import { IconTile, Panel } from "@/shared/ui";

import { $$oidcCallback } from "../model";
import { CompleteRegistration } from "./complete-registration";
import { LinkAccount } from "./link-account";

export const OidcCallbackPage = () => {
  const { screen, providerName, error } = useUnit({
    screen: $$oidcCallback.outputs.$screen,
    providerName: $$oidcCallback.outputs.$providerName,
    error: $$oidcCallback.outputs.$error,
  });

  return (
    <AuthShell>
      <Panel>
        {screen === "pending" && (
          <div aria-busy="true" className="flex justify-center">
            <LoaderCircle className="motion-safe:animate-spin" size={32} strokeWidth={1.75} aria-hidden="true" />
          </div>
        )}

        {screen === "registration" && <CompleteRegistration />}

        {screen === "link" && providerName && <LinkAccount providerName={providerName} />}

        {screen === "blocked" && (
          <section aria-labelledby="oidc-blocked-title" className="flex flex-col items-center gap-4 text-center">
            <IconTile>
              <Lock size={32} strokeWidth={1.75} />
            </IconTile>
            <h1 id="oidc-blocked-title" className="font-heading text-mobile-heading-3 font-extrabold md:text-heading-3">
              {LOGIN_MESSAGES.accountBlocked}
            </h1>
          </section>
        )}

        {screen === "unavailable" && error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 border-2 border-error-text bg-error-bg px-4 py-3 text-sm leading-normal text-error-text"
          >
            <CircleAlert className="mt-px shrink-0" size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </Panel>
    </AuthShell>
  );
};
