import { historyAdapter } from "@effector/router";
import { allSettled, fork } from "effector";
import { createMemoryHistory } from "history";
import { describe, expect, it } from "vitest";

import { $$login, $$loginRoute } from "@/pages/login/model";

import { $$session } from "@/entities/session";

import { router, routes } from "@/shared/routes";

describe("login page model", () => {
  it("stub login authenticates user and opens home", async () => {
    const scope = fork();
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
