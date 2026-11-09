import { useUnit } from "effector-react";
import { useEffect } from "react";

import { cn } from "@/shared/lib/cn";

import { getOidcStartUrl, OIDC_PROVIDERS } from "../config/providers";
import { type OidcStartModel } from "../model/oidc-start";

export const OidcButtons = ({ model }: { model: OidcStartModel }) => {
  const { disabled, choose, reset } = useUnit({
    disabled: model.outputs.$disabled,
    choose: model.inputs.providerChosen,
    reset: model.inputs.reset,
  });

  useEffect(() => {
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) reset();
    };

    window.addEventListener("pageshow", restore);

    return () => window.removeEventListener("pageshow", restore);
  }, [reset]);

  return (
    <div className="flex flex-col gap-4">
      <div className="my-2 flex items-center gap-4 text-sm text-muted" aria-hidden="true">
        <span className="h-px flex-1 border-t border-dashed border-divider" />
        или
        <span className="h-px flex-1 border-t border-dashed border-divider" />
      </div>
      {OIDC_PROVIDERS.map(({ id, name }) => (
        <a
          key={id}
          href={getOidcStartUrl(id)}
          aria-disabled={disabled || undefined}
          onClick={(event) => {
            if (disabled) {
              event.preventDefault();

              return;
            }

            if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) choose(id);
          }}
          className={cn(
            "flex min-h-12 items-center justify-center border-2 px-6 text-base font-semibold outline-link focus-visible:outline-2 focus-visible:outline-offset-2",
            disabled
              ? "cursor-default border-border-default bg-disabled-bg text-disabled-text"
              : "border-border-strong bg-card text-ink hover:bg-hover",
          )}
        >
          Продолжить с {name}
        </a>
      ))}
    </div>
  );
};
