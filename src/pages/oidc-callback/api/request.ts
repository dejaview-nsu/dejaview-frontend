import { concurrency, createMutation, createQuery } from "@farfetched/core";

import { type AuthOidcCompleteRequest, callApi, zAuthOidcPending, zSessionInfo } from "@/shared/api";

export const createOidcCallbackApi = () => {
  const pendingQuery = createQuery({
    name: "auth.oidcPending",
    handler: () =>
      callApi({ method: "GET", path: "/auth/oidc/pending", schema: zAuthOidcPending, onUnauthorized: "guest" }),
  });

  const completeMutation = createMutation({
    name: "auth.oidcComplete",
    handler: (body: AuthOidcCompleteRequest) =>
      callApi({ method: "POST", path: "/auth/oidc/complete", body, schema: zSessionInfo, onUnauthorized: "guest" }),
  });

  concurrency(completeMutation, { strategy: "TAKE_FIRST" });

  return { pendingQuery, completeMutation };
};
