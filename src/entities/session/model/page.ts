import { invoke } from "@withease/factories";

import { createSessionFactory } from "./session";

export const $$session = invoke(createSessionFactory);
