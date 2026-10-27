import { historyAdapter } from "@effector/router";
import { allSettled, fork, scopeBind } from "effector";
import { createMemoryHistory } from "history";
import { describe, expect, it, vi } from "vitest";

import "@/pages/profile/model";

import { $$session } from "@/entities/session";

import { sessionRequired, transportFx } from "@/shared/api";
import { TransportError } from "@/shared/api/transport/errors";
import { $$notifications } from "@/shared/lib/notifications";
import { router, routes } from "@/shared/routes";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";
import { sessionInfo, sessionRequiredError, setupSessionScope } from "../../session-scope";

const setupControlled = async ({ ignoreAbort = false, authenticated = true } = {}) => {
  const transport = createControlledTransport({ ignoreAbort });
  const scope = fork({ handlers: [[transportFx, transport.transport]] });

  if (authenticated) await allSettled($$session.inputs.sessionCreated, { scope, params: sessionInfo });

  await allSettled(router.setHistory, {
    scope,
    params: historyAdapter(createMemoryHistory({ initialEntries: ["/about?from=profile"] })),
  });

  const signOut = scopeBind($$session.inputs.signedOut, { scope });

  return { scope, transport, signOut };
};

describe("sign out", () => {
  it.each(["/about", "/profile", "/profile?tab=lists"])("from %s goes home as guest", async (initialEntry) => {
    const { scope } = await setupSessionScope({ initialEntry, authenticated: true });

    await allSettled($$session.inputs.signedOut, { scope });

    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState(router.$query)).toEqual({});
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState(routes.home.$isOpened)).toBe(true);
  });

  it.each([204, 401])("POST /auth/logout returning %s ends the session and clears the query", async (status) => {
    const { scope, transport, signOut } = await setupControlled();

    signOut();
    await transport.waitForCalls(1);

    expect(transport.current().request).toMatchObject({ method: "POST", path: "/auth/logout" });
    expect(transport.current().request.body).toBeUndefined();
    expect(scope.getState($$session.outputs.$isSigningOut)).toBe(true);

    transport.current().resolve(jsonResponse(status, status === 204 ? "" : { code: "SESSION_EXPIRED" }));
    await allSettled(scope);

    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState($$session.outputs.$user)).toBeNull();
    expect(scope.getState($$session.outputs.$isSigningOut)).toBe(false);
    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState(router.$query)).toEqual({});
  });

  it.each(["server", "rate-limit", "network", "timeout"] as const)(
    "%s failure keeps the current session and allows retry",
    async (failure) => {
      const { scope, transport, signOut } = await setupControlled();

      signOut();
      await transport.waitForCalls(1);

      if (failure === "network" || failure === "timeout") {
        transport.current().reject(new TransportError(failure));
      } else {
        transport.current().resolve(
          jsonResponse(failure === "server" ? 500 : 429, {
            code: failure === "server" ? "INTERNAL_ERROR" : "RATE_LIMITED",
            message: "Попробуйте ещё раз",
          }),
        );
      }

      await allSettled(scope);

      expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
      expect(scope.getState($$session.outputs.$user)).toEqual(sessionInfo.user);
      expect(scope.getState($$session.outputs.$isSigningOut)).toBe(false);
      expect(scope.getState(router.$path)).toBe("/about");
      expect(scope.getState(router.$query)).toEqual({ from: "profile" });
      expect(scope.getState($$notifications.outputs.$notification)).toMatchObject({ tone: "error" });

      signOut();
      await transport.waitForCalls(2);
      transport.current().resolve(jsonResponse(204, ""));
      await allSettled(scope);

      expect(scope.getState($$session.outputs.$status)).toBe("guest");
      expect(scope.getState(router.$path)).toBe("/");
    },
  );

  it("ignores duplicate clicks and new auth requests while signing out, then permits another session", async () => {
    const { scope, transport, signOut } = await setupControlled();

    signOut();
    await transport.waitForCalls(1);
    signOut();
    scopeBind($$session.inputs.sessionCheckRequested, { scope })();
    scopeBind($$session.inputs.signedIn, { scope })({ login: "movie_fan_42", password: "Kino#2026" });

    expect(transport.transport).toHaveBeenCalledOnce();

    transport.current().resolve(jsonResponse(204, ""));
    await allSettled(scope);
    await allSettled($$session.inputs.signedOut, { scope });
    expect(transport.transport).toHaveBeenCalledOnce();

    await allSettled($$session.inputs.sessionCreated, { scope, params: sessionInfo });
    signOut();
    await transport.waitForCalls(2);
    transport.current().resolve(jsonResponse(204, ""));
    await allSettled(scope);

    expect(scope.getState($$session.outputs.$status)).toBe("guest");
  });

  it("does not send logout for a guest", async () => {
    const { scope, transport } = await setupControlled({ authenticated: false });

    await allSettled($$session.inputs.signedOut, { scope });

    expect(transport.transport).not.toHaveBeenCalled();
  });

  it.each(["session", "login"] as const)("aborts %s and ignores its late success after logout", async (operation) => {
    const { scope, transport, signOut } = await setupControlled({ ignoreAbort: true });

    if (operation === "session") {
      scopeBind($$session.inputs.sessionCheckRequested, { scope })();
    } else {
      scopeBind($$session.inputs.signedIn, { scope })({ login: "movie_fan_42", password: "Kino#2026" });
    }

    await transport.waitForCalls(1);
    const stale = transport.current();

    signOut();
    await transport.waitForCalls(2);
    expect(stale.request.signal?.aborted).toBe(true);

    transport.current().resolve(jsonResponse(204, ""));
    await vi.waitFor(() => expect(scope.getState($$session.outputs.$status)).toBe("guest"));
    stale.resolve(jsonResponse(200, sessionInfo));
    await allSettled(scope);

    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState($$session.outputs.$user)).toBeNull();
    expect(scope.getState(router.$path)).toBe("/");
    expect(transport.transport).toHaveBeenCalledTimes(2);
  });

  it.each(["session", "login"] as const)(
    "a late cancelled %s failure cannot clear a new session",
    async (operation) => {
      const { scope, transport, signOut } = await setupControlled({ ignoreAbort: true });

      if (operation === "session") {
        scopeBind($$session.inputs.sessionCheckRequested, { scope })();
      } else {
        scopeBind($$session.inputs.signedIn, { scope })({ login: "movie_fan_42", password: "Kino#2026" });
      }

      await transport.waitForCalls(1);
      const stale = transport.current();

      signOut();
      await transport.waitForCalls(2);
      transport.current().resolve(jsonResponse(204, ""));
      await vi.waitFor(() => expect(scope.getState($$session.outputs.$status)).toBe("guest"));

      const nextSession = { ...sessionInfo, user: { ...sessionInfo.user, username: "another_user" } };
      scopeBind($$session.inputs.sessionCreated, { scope })(nextSession);
      stale.resolve(jsonResponse(401, { code: "SESSION_EXPIRED" }));
      await allSettled(scope);

      expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
      expect(scope.getState($$session.outputs.$user)).toEqual(nextSession.user);
      expect(scope.getState($$session.outputs.$loginError)).toBeNull();
      expect(scope.getState(router.$path)).toBe("/");
    },
  );

  it("a protected request expiring during logout does not open login", async () => {
    const { scope, transport, signOut } = await setupControlled();

    signOut();
    await transport.waitForCalls(1);
    scopeBind(sessionRequired, { scope })(sessionRequiredError());
    expect(scope.getState(router.$path)).toBe("/about");

    transport.current().resolve(jsonResponse(401, { code: "SESSION_EXPIRED" }));
    await allSettled(scope);

    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
  });
});
