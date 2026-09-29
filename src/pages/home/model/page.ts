import { invoke } from "@withease/factories";

import { routes } from "@/shared/routes";

import { createHomePageFactory } from "./home";

export const $$home = invoke(createHomePageFactory, { route: routes.home });
