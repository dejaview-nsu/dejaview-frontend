import { createMutation, createQuery } from "@farfetched/core";
import { createEffect } from "effector";

import { ApiError } from "@/shared/api";
import { zodContract } from "@/shared/lib/contracts";

import { type SessionInfo, sessionInfoSchema } from "./schema";

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export const createSessionStub = () => {
  let hasSession = false;

  const sessionQuery = createQuery({
    effect: createEffect(async (): Promise<SessionInfo> => {
      if (!hasSession) {
        throw new ApiError({
          status: 401,
          code: "SESSION_REQUIRED",
          message: "Войдите, чтобы продолжить",
          field: null,
        });
      }

      return {
        user: { username: "demo_user", avatar_url: null, has_password: true },
        expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      };
    }),
    contract: zodContract(sessionInfoSchema),
  });

  const signInMutation = createMutation({
    handler: async () => {
      hasSession = true;
    },
  });

  const signOutMutation = createMutation({
    handler: async () => {
      hasSession = false;
    },
  });

  return { sessionQuery, signInMutation, signOutMutation };
};
