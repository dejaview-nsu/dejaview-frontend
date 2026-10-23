import { useUnit } from "effector-react";

import { getOidcStartUrl, OIDC_PROVIDERS } from "../config/providers";
import { type OidcStartModel } from "../model/oidc-start";

export const OidcButtons = ({ model }: { model: OidcStartModel }) => {
  const choose = useUnit(model.inputs.providerChosen);

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
          onClick={() => choose(id)}
          className="flex min-h-12 items-center justify-center border-2 border-border-strong bg-card px-6 text-base font-semibold text-ink outline-link hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Продолжить с {name}
        </a>
      ))}
    </div>
  );
};
