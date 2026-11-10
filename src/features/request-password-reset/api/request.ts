import { createMutation } from "@farfetched/core";

import { callApi, zNoContent } from "@/shared/api";

export const createRequestPasswordResetApi = () => {
  const requestMutation = createMutation({
    name: "auth.passwordReset.request",
    handler: (login: string) =>
      callApi({
        method: "POST",
        path: "/auth/password-reset/request",
        body: { login },
        schema: zNoContent,
        onUnauthorized: "guest",
      }),
  });

  return { requestMutation };
};
