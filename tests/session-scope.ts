import { historyAdapter } from "@effector/router";
import { allSettled, fork } from "effector";
import { createMemoryHistory } from "history";

import { $$session } from "@/entities/session";

import { ApiError, type Transport, transportFx } from "@/shared/api";
import { createMockStorage, createMockTransport, type MockStorage, NO_MOCK_DELAYS } from "@/shared/api/mocks";
import { router } from "@/shared/routes";

export const sessionInfo = {
  user: { username: "movie_fan_42", avatar_url: null, has_password: true },
  expires_at: "2026-09-28T12:00:00Z",
};

export const sessionRequiredError = () =>
  new ApiError({ status: 401, code: "SESSION_REQUIRED", message: "Войдите, чтобы продолжить", field: null });

export const executeFx = (unit: unknown) => (unit as { __: { executeFx: never } }).__.executeFx;

const unexpectedRequest: Transport = async () => {
  throw new Error("Unexpected API request");
};

export const setupSessionScope = async ({
  initialEntry = "/",
  authenticated = false,
  transport = unexpectedRequest,
}: {
  initialEntry?: string;
  authenticated?: boolean;
  transport?: Transport;
} = {}) => {
  let isSignedIn = authenticated;

  const scope = fork({
    handlers: [
      [transportFx, transport],
      [
        executeFx($$session.__.sessionQuery),
        () => {
          if (!isSignedIn) {
            throw sessionRequiredError();
          }

          return sessionInfo;
        },
      ],
      [
        executeFx($$session.__.signInMutation),
        () => {
          isSignedIn = true;
        },
      ],
      [
        executeFx($$session.__.signOutMutation),
        () => {
          isSignedIn = false;
        },
      ],
    ],
  });

  const history = createMemoryHistory({ initialEntries: [initialEntry] });

  await allSettled(router.setHistory, { scope, params: historyAdapter(history) });
  await allSettled($$session.inputs.sessionCheckRequested, { scope });

  return { scope, history };
};

export const setupApiScope = async ({
  initialEntry = "/",
  transport,
}: {
  initialEntry?: string;
  transport: Transport;
}) => {
  const scope = fork({ handlers: [[transportFx, transport]] });
  const history = createMemoryHistory({ initialEntries: [initialEntry] });

  await allSettled(router.setHistory, { scope, params: historyAdapter(history) });
  await allSettled($$session.inputs.sessionCheckRequested, { scope });

  return { scope, history };
};

export const createTestMockStorage = () => createMockStorage(() => null);

export const setupMockApiScope = async ({
  initialEntry = "/",
  storage = createTestMockStorage(),
}: { initialEntry?: string; storage?: MockStorage } = {}) => {
  const transport = createMockTransport({ storage, delays: NO_MOCK_DELAYS });
  const { scope, history } = await setupApiScope({ initialEntry, transport });

  return { scope, history, storage };
};
