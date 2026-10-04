import { historyAdapter } from "@effector/router";
import { allSettled, fork } from "effector";
import { createMemoryHistory } from "history";
import { describe, expect, it } from "vitest";

import { $$login, $$loginRoute } from "@/pages/login/model";

import { $$session } from "@/entities/session";

import { transportFx } from "@/shared/api";
import { createMockTransport, NO_MOCK_DELAYS } from "@/shared/api/mocks";
import { router, routes } from "@/shared/routes";

import { createTestMockStorage } from "../../session-scope";

describe("login page model", () => {
  it("stub login authenticates user and opens home", async () => {
    const transport = createMockTransport({ storage: createTestMockStorage(), delays: NO_MOCK_DELAYS });
    const scope = fork({ handlers: [[transportFx, transport]] });
    const history = createMemoryHistory({ initialEntries: ["/"] });

    await allSettled(router.setHistory, { scope, params: historyAdapter(history) });
    await allSettled($$session.inputs.sessionCheckRequested, { scope });
    await allSettled(routes.login.open, { scope, params: undefined });

    expect(scope.getState($$loginRoute.outputs.readyRoute.$isOpened)).toBe(true);

    await allSettled($$login.inputs.stubLoginPressed, { scope });

    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
    expect(scope.getState(router.$path)).toBe("/");
  });
});
