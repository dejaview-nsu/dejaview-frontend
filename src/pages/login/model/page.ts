import { invoke } from "@withease/factories";

import { $$session } from "@/entities/session";

import { routes } from "@/shared/routes";

import { createLoginPageFactory } from "./login";

export const $$login = invoke(createLoginPageFactory, { route: routes.login, session: $$session });
