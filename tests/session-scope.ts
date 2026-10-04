import { historyAdapter } from "@effector/router";
import { allSettled, fork } from "effector";
import { createMemoryHistory } from "history";

import { $$session } from "@/entities/session";

import { ApiError, transportFx, type TransportRequest, type TransportResponse } from "@/shared/api";
import { router } from "@/shared/routes";

export const sessionInfo = {
  user: { username: "movie_fan_42", avatar_url: null, has_password: true },
  expires_at: "2026-09-28T12:00:00Z",
};

export const sessionRequiredError = () =>
  new ApiError({ status: 401, code: "SESSION_REQUIRED", message: "Войдите, чтобы продолжить", field: null });

export const executeFx = (unit: unknown) => (unit as { __: { executeFx: never } }).__.executeFx;

export const setupSessionScope = async ({
  initialEntry = "/",
  authenticated = false,
  transport = async () => {
    throw new Error("Unexpected API request");
  },
}: {
  initialEntry?: string;
  authenticated?: boolean;
  transport?: (request: TransportRequest) => Promise<TransportResponse>;
} = {}) => {
  let hasSession = authenticated;

  const scope = fork({
    handlers: [
      [transportFx, transport],
      [
        executeFx($$session.__.sessionQuery),
        () => {
          if (!hasSession) {
            throw sessionRequiredError();
          }

          return sessionInfo;
        },
      ],
      [
        executeFx($$session.__.signInMutation),
        () => {
          hasSession = true;
        },
      ],
      [
        executeFx($$session.__.signOutMutation),
        () => {
          hasSession = false;
        },
      ],
    ],
  });

  const history = createMemoryHistory({ initialEntries: [initialEntry] });

  await allSettled(router.setHistory, { scope, params: historyAdapter(history) });
  await allSettled($$session.inputs.sessionCheckRequested, { scope });

  return { scope, history };
};
