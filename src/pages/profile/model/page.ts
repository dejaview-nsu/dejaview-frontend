import { invoke } from "@withease/factories";

import { $$session, createAuthorizedRouteFactory } from "@/entities/session";

import { routes } from "@/shared/routes";

export const $$profile = invoke(createAuthorizedRouteFactory, { route: routes.profile, session: $$session });
