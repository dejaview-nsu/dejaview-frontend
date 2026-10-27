import { invoke } from "@withease/factories";

import { $$session } from "@/entities/session";

import { createLoginFormFactory } from "./login-form";

export const $$loginDialog = invoke(createLoginFormFactory, {
  session: $$session,
  $active: $$session.outputs.$isLoginDialogOpened,
});
