import { createMutation } from "@farfetched/core";

import { type AuthPasswordResetCompleteRequest, callApi, zNoContent, zSessionInfo } from "@/shared/api";

export const createResetPasswordApi = () => {
  const checkMutation = createMutation({
    name: "auth.passwordReset.check",
    handler: (token: string) =>
      callApi({
        method: "POST",
        path: "/auth/password-reset/check",
        body: { token },
        schema: zNoContent,
        onUnauthorized: "guest",
      }),
  });

  const completeMutation = createMutation({
    name: "auth.passwordReset.complete",
    handler: (body: AuthPasswordResetCompleteRequest) =>
      callApi({
        method: "POST",
        path: "/auth/password-reset/complete",
        body,
        schema: zSessionInfo,
        onUnauthorized: "guest",
      }),
  });

  return { checkMutation, completeMutation };
};
