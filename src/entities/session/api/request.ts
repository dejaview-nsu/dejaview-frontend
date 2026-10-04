import { concurrency, createMutation, createQuery } from "@farfetched/core";

import { type AuthLoginRequest, callApi, zNoContent, zSessionInfo } from "@/shared/api";

export const createSessionApi = () => {
  const sessionQuery = createQuery({
    name: "session.get",
    handler: () => callApi({ method: "GET", path: "/auth/session", schema: zSessionInfo, onUnauthorized: "guest" }),
  });

  const signInMutation = createMutation({
    name: "session.login",
    handler: (credentials: AuthLoginRequest) =>
      callApi({ method: "POST", path: "/auth/login", body: credentials, schema: zSessionInfo }),
  });

  concurrency(signInMutation, { strategy: "TAKE_FIRST" });

  const signOutMutation = createMutation({
    name: "session.logout",
    handler: () => callApi({ method: "POST", path: "/auth/logout", schema: zNoContent, onUnauthorized: "guest" }),
  });

  return { sessionQuery, signInMutation, signOutMutation };
};
