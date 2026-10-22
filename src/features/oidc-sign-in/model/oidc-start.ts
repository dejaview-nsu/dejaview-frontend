import { type Query } from "@effector/router";
import { createFactory } from "@withease/factories";
import { createEffect, createEvent, sample } from "effector";

import { type AuthOidcProvider } from "@/shared/api";
import { router } from "@/shared/routes";

import { saveOidcReturnPath } from "../lib/return-path";

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

export const createOidcStartFactory = createFactory(() => {
  const providerChosen = createEvent<AuthOidcProvider>();

  const saveReturnPathFx = createEffect(saveOidcReturnPath);

  sample({
    clock: providerChosen,
    source: { path: router.$path, query: router.$query },
    fn: toOidcReturnPath,
    target: saveReturnPathFx,
  });

  return {
    __: { saveReturnPathFx },

    inputs: { providerChosen },
  };
});

export type OidcStartModel = ReturnType<typeof createOidcStartFactory>;
