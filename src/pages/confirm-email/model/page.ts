import { invoke } from "@withease/factories";

import { createConfirmEmailPageFactory } from "./confirm-email";

export const $$confirmEmail = invoke(createConfirmEmailPageFactory);
