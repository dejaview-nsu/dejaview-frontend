import { allSettled } from "effector";
import { describe, expect, it, vi } from "vitest";

import {
  $$changePassword,
  $$listRemoval,
  $$profile,
  $$profileLists,
  $$signOutDialog,
  $$userProfile,
  tabSelected,
} from "@/pages/profile/model";

import { $$session } from "@/entities/session";

import { type Transport } from "@/shared/api";
import { createMockTransport, MOCK_STORAGE_KEYS, NO_MOCK_DELAYS } from "@/shared/api/mocks";
import { router, routes } from "@/shared/routes";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";
import { createTestMockStorage, setupSessionScope } from "../../session-scope";

const setupProfile = async () => {
  const storage = createTestMockStorage();

  storage.set(MOCK_STORAGE_KEYS.session, "authenticated");

  const transport = createMockTransport({ storage, delays: NO_MOCK_DELAYS });
  const context = await setupSessionScope({ authenticated: true, transport });

  await allSettled(routes.profile.open, { scope: context.scope, params: undefined });

  return context;
};

const { want_to_watch: $$wantToWatch, watched: $$watched } = $$profileLists;

describe("profile route guard", () => {
  it("redirects guest to login with return path and replaces history entry", async () => {
    const { scope, history } = await setupSessionScope();

    await allSettled(routes.profile.open, { scope, params: undefined });

    expect(scope.getState(router.$path)).toBe("/login");
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile" });
    expect(scope.getState($$profile.outputs.readyRoute.$isOpened)).toBe(false);
    expect(history.index).toBe(1);

    await allSettled(router.back, { scope });

    expect(scope.getState(router.$path)).toBe("/");
  });

  it("keeps query of protected page in redirect", async () => {
    const { scope } = await setupSessionScope();

    await allSettled(routes.profile.open, { scope, params: { query: { tab: "watched" } } });

    expect(scope.getState(router.$path)).toBe("/login");
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile?tab=watched" });
  });

  it("opens profile for authenticated user", async () => {
    const { scope } = await setupSessionScope({ authenticated: true });

    await allSettled(routes.profile.open, { scope, params: undefined });

    expect(scope.getState(router.$path)).toBe("/profile");
    expect(scope.getState($$profile.outputs.readyRoute.$isOpened)).toBe(true);
  });

  it("sends user to home after sign out on profile", async () => {
    const { scope } = await setupSessionScope({ authenticated: true });

    await allSettled(routes.profile.open, { scope, params: undefined });
    await allSettled($$session.inputs.signedOut, { scope });

    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState($$profile.outputs.readyRoute.$isOpened)).toBe(false);
  });
});

describe("profile tabs", () => {
  it("keeps list requests running across tab changes and cancels them when the profile closes", async () => {
    const storage = createTestMockStorage();
    storage.set(MOCK_STORAGE_KEYS.session, "authenticated");
    const mock = createMockTransport({ storage, delays: NO_MOCK_DELAYS });
    const lists = createControlledTransport({ ignoreAbort: true });
    const transport: Transport = (request) =>
      request.path.startsWith("/users/me/lists/") ? lists.transport(request) : mock(request);
    const { scope } = await setupSessionScope({ authenticated: true, transport });

    const opening = allSettled(routes.profile.open, { scope, params: undefined });
    await lists.waitForCalls(1);
    const switching = allSettled(tabSelected, { scope, params: "security" });
    await vi.waitFor(() => expect(scope.getState(router.$query)).toEqual({ tab: "security" }));
    expect(lists.calls[0].request.signal?.aborted).toBe(false);
    lists.current().resolve(jsonResponse(200, { movies: [], total: 0 }));
    await Promise.all([opening, switching]);
    expect(scope.getState($$wantToWatch.outputs.$status)).toBe("ready");

    await allSettled(tabSelected, { scope, params: "want_to_watch" });
    expect(lists.calls).toHaveLength(1);
    const watching = allSettled(tabSelected, { scope, params: "watched" });
    await lists.waitForCalls(2);
    const closing = allSettled(routes.home.open, { scope, params: undefined });
    await vi.waitFor(() => expect(lists.current().request.signal?.aborted).toBe(true));
    lists.current().resolve(jsonResponse(200, { movies: [], total: 0 }));
    await Promise.all([watching, closing]);
    expect(scope.getState($$wantToWatch.outputs.$query)).toBeNull();
    expect(scope.getState($$watched.outputs.$query)).toBeNull();
    expect(scope.getState($$watched.outputs.$status)).toBe("idle");
  });
  it("stores the selected tab in the address and returns with back", async () => {
    const { scope, history } = await setupProfile();

    expect(scope.getState($$wantToWatch.outputs.$query)?.list).toBe("want_to_watch");

    await allSettled(tabSelected, { scope, params: "watched" });

    expect(scope.getState(router.$query)).toEqual({ tab: "watched" });
    expect(scope.getState($$watched.outputs.$query)?.list).toBe("watched");
    expect(history.index).toBe(2);

    await allSettled(tabSelected, { scope, params: "want_to_watch" });

    expect(scope.getState(router.$query)).toEqual({});
    expect(history.index).toBe(3);

    await allSettled(router.back, { scope });

    expect(scope.getState(router.$query)).toEqual({ tab: "watched" });
    expect(scope.getState($$watched.outputs.$query)?.list).toBe("watched");
  });

  it("does not add a history entry when the selected tab is pressed again", async () => {
    const { scope, history } = await setupProfile();

    await allSettled(tabSelected, { scope, params: "want_to_watch" });

    expect(history.index).toBe(1);
  });

  it("loads the profile once while switching tabs", async () => {
    const { scope } = await setupProfile();

    expect(scope.getState($$userProfile.outputs.$status)).toBe("ready");

    await allSettled(tabSelected, { scope, params: "watched" });

    expect(scope.getState($$userProfile.outputs.$status)).toBe("ready");
  });

  it("resets profile data when leaving the page", async () => {
    const { scope } = await setupProfile();

    await allSettled(routes.home.open, { scope, params: undefined });

    expect(scope.getState($$userProfile.outputs.$status)).toBe("idle");
    expect(scope.getState($$userProfile.outputs.$profile)).toBeNull();
    expect(scope.getState($$wantToWatch.outputs.$status)).toBe("idle");
    expect(scope.getState($$watched.outputs.$status)).toBe("idle");
    expect(scope.getState($$listRemoval.outputs.$pending)).toEqual([]);
  });

  it.each(["ratings", "reviews", "security"] as const)("preserves the list on the %s tab", async (tab) => {
    const { scope } = await setupProfile();

    expect(scope.getState($$wantToWatch.outputs.$status)).toBe("ready");
    await allSettled($$wantToWatch.inputs.sortSelected, { scope, params: "title_asc" });
    await allSettled($$wantToWatch.inputs.draftChanged, { scope, params: "draft" });

    await allSettled(tabSelected, { scope, params: tab });

    expect(scope.getState(router.$query)).toEqual({ tab });
    expect(scope.getState($$wantToWatch.outputs.$status)).toBe("ready");
    expect(scope.getState($$wantToWatch.outputs.$query)?.sort).toBe("title_asc");

    await allSettled(tabSelected, { scope, params: "watched" });

    expect(scope.getState($$watched.outputs.$status)).toBe("ready");
    expect(scope.getState($$watched.outputs.$query)?.sort).toBe("newest");
    expect(scope.getState($$watched.outputs.$draft)).toBe("");
    await allSettled(tabSelected, { scope, params: "want_to_watch" });
    expect(scope.getState($$wantToWatch.outputs.$draft)).toBe("draft");
  });

  it("resets the password form when the user leaves the security tab", async () => {
    const { scope } = await setupProfile();

    await allSettled(tabSelected, { scope, params: "security" });
    await allSettled($$changePassword.inputs.opened, { scope });
    await allSettled($$changePassword.inputs.fieldChanged, {
      scope,
      params: { field: "password", value: "Kino#2027" },
    });

    await allSettled(tabSelected, { scope, params: "reviews" });

    expect(scope.getState($$changePassword.outputs.$isOpen)).toBe(false);
    expect(scope.getState($$changePassword.outputs.$values).password).toBe("");
  });

  it("closes the sign out dialog and the password form when leaving the page", async () => {
    const { scope } = await setupProfile();

    await allSettled(tabSelected, { scope, params: "security" });
    await allSettled($$changePassword.inputs.opened, { scope });
    await allSettled($$signOutDialog.inputs.opened, { scope });

    await allSettled(routes.home.open, { scope, params: undefined });

    expect(scope.getState($$changePassword.outputs.$isOpen)).toBe(false);
    expect(scope.getState($$signOutDialog.outputs.$isOpen)).toBe(false);
  });
});
