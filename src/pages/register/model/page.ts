import { invoke } from "@withease/factories";

import { $$session, createGuestRouteFactory } from "@/entities/session";

import { routes } from "@/shared/routes";

export const $$register = invoke(createGuestRouteFactory, { route: routes.register, session: $$session });
