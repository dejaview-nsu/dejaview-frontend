import { concurrency, createMutation } from "@farfetched/core";

import { callApi, zSessionInfo } from "@/shared/api";

export const createConfirmEmailApi = () => {
  const confirmMutation = createMutation({
    name: "auth.confirmEmail",
    handler: (token: string) =>
      callApi({
        method: "POST",
        path: "/auth/confirm-email",
        body: { token },
        schema: zSessionInfo,
        onUnauthorized: "guest",
      }),
  });

  concurrency(confirmMutation, { strategy: "TAKE_FIRST" });

  return { confirmMutation };
};
