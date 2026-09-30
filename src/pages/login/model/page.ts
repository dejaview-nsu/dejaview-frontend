import { invoke } from "@withease/factories";

import { $$session, createGuestRouteFactory } from "@/entities/session";

import { routes } from "@/shared/routes";

import { createLoginPageFactory } from "./login";

export const $$loginRoute = invoke(createGuestRouteFactory, { route: routes.login, session: $$session });

export const $$login = invoke(createLoginPageFactory, {
  route: $$loginRoute.outputs.readyRoute,
  session: $$session,
});
