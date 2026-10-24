import { concurrency, createMutation } from "@farfetched/core";

import { type AuthResendConfirmationRequest, callApi, zAuthConfirmationSent } from "@/shared/api";

export const createResendConfirmationApi = () => {
  const resendMutation = createMutation({
    name: "auth.resendConfirmation",
    handler: (body: AuthResendConfirmationRequest) =>
      callApi({
        method: "POST",
        path: "/auth/resend-confirmation",
        body,
        schema: zAuthConfirmationSent,
        onUnauthorized: "guest",
      }),
  });

  concurrency(resendMutation, { strategy: "TAKE_FIRST" });

  return { resendMutation };
};
