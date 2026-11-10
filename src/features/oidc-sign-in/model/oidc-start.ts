import { type Query } from "@effector/router";
import { createFactory } from "@withease/factories";
import { combine, createEffect, createEvent, createStore, sample, type Store } from "effector";
import { not, readonly } from "patronum";

import { type AuthOidcProvider } from "@/shared/api";
import { router } from "@/shared/routes";

import { type OidcOrigin, saveOidcOrigin, saveOidcReturnPath } from "../lib/return-path";

const AUTH_PATHS = ["/login", "/register", "/auth/oidc", "/confirm-email"];

export const toOidcReturnPath = ({ path, query }: { path: string | null; query: Query }) => {
  if (path !== null && !AUTH_PATHS.includes(path)) {
    const search = new URLSearchParams(
      Object.entries(query).flatMap(([key, value]) =>
        (Array.isArray(value) ? value : [value]).filter((item) => item !== null).map((item) => [key, String(item)]),
      ),
    ).toString();

    return search ? `${path}?${search}` : path;
  }

  return typeof query.redirect === "string" ? query.redirect : "/";
};

export const createOidcStartFactory = createFactory(
  ({ origin = "register", $blocked }: { origin?: OidcOrigin; $blocked?: Store<boolean> } = {}) => {
    const providerChosen = createEvent<AuthOidcProvider>();
    const reset = createEvent();

    const saveReturnPathFx = createEffect(saveOidcReturnPath);
    const saveOriginFx = createEffect(saveOidcOrigin);

    const $pending = createStore(false);

    const $disabled = combine($pending, $blocked ?? createStore(false), (pending, blocked) => pending || blocked);

    const started = sample({ clock: providerChosen, filter: not($disabled) });

    sample({
      clock: started,
      source: { path: router.$path, query: router.$query },
      fn: toOidcReturnPath,
      target: saveReturnPathFx,
    });

    sample({ clock: started, fn: () => origin, target: saveOriginFx });

    sample({ clock: started, fn: () => true, target: $pending });

    sample({ clock: reset, fn: () => false, target: $pending });

    return {
      __: { saveReturnPathFx, saveOriginFx },

      inputs: { providerChosen, reset },

      outputs: { $pending: readonly($pending), $disabled },
    };
  },
);

export type OidcStartModel = ReturnType<typeof createOidcStartFactory>;
