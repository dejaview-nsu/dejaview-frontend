import { concurrency, createMutation } from "@farfetched/core";

import { type AuthRegisterRequest, callApi, zAuthConfirmationSent } from "@/shared/api";

export const createRegisterApi = () => {
  const registerMutation = createMutation({
    name: "auth.register",
    handler: (body: AuthRegisterRequest) =>
      callApi({ method: "POST", path: "/auth/register", body, schema: zAuthConfirmationSent, onUnauthorized: "guest" }),
  });

  concurrency(registerMutation, { strategy: "TAKE_FIRST" });

  return { registerMutation };
};
