import { historyAdapter } from "@effector/router";
import { invoke } from "@withease/factories";
import { allSettled, createWatch, fork, type Scope, scopeBind } from "effector";
import { createMemoryHistory } from "history";
import { describe, expect, it, vi } from "vitest";

import { $$login } from "@/pages/login/model";
import "@/pages/profile/model";

import { $$session } from "@/entities/session";

import { createFileSearchFactory, type FileSearchMode, sessionRequired, transportFx, zNoContent } from "@/shared/api";
import { loginRedirectRequested, router, routes } from "@/shared/routes";

import { sendApiRequestFx } from "../../api-request";
import { createControlledTransport, jsonResponse } from "../../controlled-transport";
import { setupSessionScope } from "../../session-scope";

const sessionError = (code: string) =>
  jsonResponse(401, {
    code,
    message: code === "SESSION_EXPIRED" ? "Сессия истекла. Войдите снова" : "Войдите, чтобы продолжить",
    field: null,
  });

const searchFile = () => new File(["image"], "frame.jpg", { type: "image/jpeg" });

const watchCalls = (scope: Scope) => {
  const redirects = vi.fn();
  const required = vi.fn();

  createWatch({ unit: loginRedirectRequested, scope, fn: redirects });
  createWatch({ unit: sessionRequired, scope, fn: required });

  return { redirects, required };
};

const runSearch = async (scope: Scope, mode: FileSearchMode = "image") => {
  const $$search = invoke(createFileSearchFactory, { mode });

  scopeBind($$search.inputs.started, { scope })(searchFile());
  await allSettled(scope);

  return $$search;
};

describe("401 on a user action", () => {
  it.each(["SESSION_REQUIRED", "SESSION_EXPIRED"])(
    "%s on search makes user a guest and opens login with push",
    async (code) => {
      const { scope, history } = await setupSessionScope({
        authenticated: true,
        transport: async () => sessionError(code),
      });
      const { redirects } = watchCalls(scope);

      expect(scope.getState($$session.outputs.$status)).toBe("authenticated");

      const $$search = await runSearch(scope);

      expect(scope.getState($$session.outputs.$status)).toBe("guest");
      expect(scope.getState($$session.outputs.$user)).toBeNull();
      expect(scope.getState(router.$path)).toBe("/login");
      expect(scope.getState(router.$query)).toEqual({ redirect: "/" });
      expect(redirects).toHaveBeenCalledWith({ path: "/", replace: false });
      expect(history.index).toBe(1);
      expect(scope.getState($$search.outputs.$stage)).toBe("idle");
      expect(scope.getState($$search.outputs.$error)).toBeNull();

      await allSettled(router.back, { scope });

      expect(scope.getState(router.$path)).toBe("/");
    },
  );

  it("keeps query of the current page in redirect", async () => {
    const { scope } = await setupSessionScope({
      initialEntry: "/about?ref=main&tab=2",
      authenticated: true,
      transport: async () => sessionError("SESSION_EXPIRED"),
    });

    await runSearch(scope);

    expect(scope.getState(router.$path)).toBe("/login");
    expect(scope.getState(router.$query)).toEqual({ redirect: "/about?ref=main&tab=2" });
  });

  it("replaces history entry on a protected page", async () => {
    const { scope, history } = await setupSessionScope({
      authenticated: true,
      transport: async () => sessionError("SESSION_EXPIRED"),
    });

    await allSettled(routes.profile.open, { scope, params: undefined });
    expect(scope.getState(router.$path)).toBe("/profile");
    expect(history.index).toBe(1);

    const { redirects } = watchCalls(scope);
    await runSearch(scope);

    expect(redirects).toHaveBeenCalledWith({ path: "/profile", replace: true });
    expect(scope.getState(router.$path)).toBe("/login");
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile" });
    expect(history.index).toBe(1);

    await allSettled(router.back, { scope });

    expect(scope.getState(router.$path)).toBe("/");
  });

  it("does not navigate when user is already on /login", async () => {
    const { scope } = await setupSessionScope({
      initialEntry: "/login",
      transport: async () => sessionError("SESSION_REQUIRED"),
    });
    const { redirects } = watchCalls(scope);

    await runSearch(scope);

    expect(redirects).not.toHaveBeenCalled();
    expect(scope.getState(router.$path)).toBe("/login");
    expect(scope.getState(router.$query)).toEqual({});
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
  });

  it("does not navigate when user is on /register", async () => {
    const { scope } = await setupSessionScope({
      initialEntry: "/register",
      transport: async () => sessionError("SESSION_REQUIRED"),
    });
    const { redirects } = watchCalls(scope);

    await runSearch(scope);

    expect(redirects).not.toHaveBeenCalled();
    expect(scope.getState(router.$path)).toBe("/register");
  });

  it("several 401 at once give exactly one redirect", async () => {
    const controlled = createControlledTransport();
    const { scope, history } = await setupSessionScope({ authenticated: true, transport: controlled.transport });
    const { redirects, required } = watchCalls(scope);
    const $$image = invoke(createFileSearchFactory, { mode: "image" });
    const $$video = invoke(createFileSearchFactory, { mode: "video" });

    scopeBind($$image.inputs.started, { scope })(searchFile());
    scopeBind($$video.inputs.started, { scope })(searchFile());
    await controlled.waitForCalls(2);

    controlled.calls[0].resolve(sessionError("SESSION_EXPIRED"));
    controlled.calls[1].resolve(sessionError("SESSION_EXPIRED"));
    await allSettled(scope);

    expect(required).toHaveBeenCalledTimes(2);
    expect(redirects).toHaveBeenCalledTimes(1);
    expect(history.index).toBe(1);
    expect(scope.getState(router.$path)).toBe("/login");
  });

  it("401 during the start session check on /profile gives exactly one redirect", async () => {
    const controlled = createControlledTransport();
    const scope = fork({ handlers: [[transportFx, controlled.transport]] });
    const history = createMemoryHistory({ initialEntries: ["/profile"] });
    const { redirects } = watchCalls(scope);

    await allSettled(router.setHistory, { scope, params: historyAdapter(history) });
    scopeBind($$session.inputs.sessionCheckRequested, { scope })();
    await controlled.waitForCalls(1);

    expect(controlled.calls[0].request.path).toBe("/auth/session");
    expect(scope.getState($$session.outputs.$status)).toBe("unknown");

    const $$search = invoke(createFileSearchFactory, { mode: "image" });

    scopeBind($$search.inputs.started, { scope })(searchFile());
    await controlled.waitForCalls(2);
    controlled.calls[1].resolve(sessionError("SESSION_EXPIRED"));
    await vi.waitFor(() => expect(redirects).toHaveBeenCalled());

    controlled.calls[0].resolve(sessionError("SESSION_REQUIRED"));
    await allSettled(scope);

    expect(redirects).toHaveBeenCalledTimes(1);
    expect(redirects).toHaveBeenCalledWith({ path: "/profile", replace: true });
    expect(scope.getState(router.$path)).toBe("/login");
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile" });
    expect(history.index).toBe(0);
    expect(scope.getState($$session.outputs.$status)).toBe("guest");
  });

  it("returns to the original page with query after login", async () => {
    const { scope } = await setupSessionScope({
      initialEntry: "/about?ref=main",
      authenticated: true,
      transport: async () => sessionError("SESSION_EXPIRED"),
    });

    await runSearch(scope);
    expect(scope.getState(router.$path)).toBe("/login");

    await allSettled($$login.inputs.stubLoginPressed, { scope });

    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
    expect(scope.getState(router.$path)).toBe("/about");
    expect(scope.getState(router.$query)).toEqual({ ref: "main" });
  });

  it("cancelled search does not raise sessionRequired", async () => {
    const controlled = createControlledTransport();
    const { scope } = await setupSessionScope({ authenticated: true, transport: controlled.transport });
    const { redirects, required } = watchCalls(scope);
    const $$search = invoke(createFileSearchFactory, { mode: "video" });

    scopeBind($$search.inputs.started, { scope })(searchFile());
    await controlled.waitForCalls(1);

    scopeBind($$search.inputs.cancelled, { scope })();
    await allSettled(scope);

    expect(required).not.toHaveBeenCalled();
    expect(redirects).not.toHaveBeenCalled();
    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
  });
});

describe("401 on guest requests", () => {
  it.each([
    ["GET", "/auth/session"],
    ["POST", "/auth/logout"],
  ] as const)("%s %s with onUnauthorized guest does not raise sessionRequired", async (method, path) => {
    const { scope } = await setupSessionScope({
      initialEntry: "/about",
      authenticated: true,
      transport: async () => sessionError("SESSION_EXPIRED"),
    });
    const { redirects, required } = watchCalls(scope);

    const result = await allSettled(sendApiRequestFx, {
      scope,
      params: { method, path, schema: zNoContent, onUnauthorized: "guest" },
    });

    expect(result.status).toBe("fail");
    expect(required).not.toHaveBeenCalled();
    expect(redirects).not.toHaveBeenCalled();
    expect(scope.getState(router.$path)).toBe("/about");
  });

  it("failed session check on start makes user a guest without opening login", async () => {
    const { scope } = await setupSessionScope({ initialEntry: "/about" });

    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState(router.$path)).toBe("/about");
  });

  it("sign out still goes home as guest", async () => {
    const { scope } = await setupSessionScope({ initialEntry: "/about", authenticated: true });

    await allSettled($$session.inputs.signedOut, { scope });

    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState(router.$path)).toBe("/");
  });
});
