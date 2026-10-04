import { allSettled, fork } from "effector";
import { createBrowserHistory } from "history";
import { afterEach, describe, expect, it, vi } from "vitest";

import { $$login } from "@/pages/login/model";
import { $$profile } from "@/pages/profile/model";

import { $$session } from "@/entities/session";

import { appStarted } from "@/shared/config/init";
import { router, routes } from "@/shared/routes";

import { sessionInfo, sessionRequiredError } from "../../session-scope";

vi.mock("history", async (importOriginal) => {
  const actual = await importOriginal<typeof import("history")>();
  return { ...actual, createBrowserHistory: vi.fn(actual.createBrowserHistory) };
});

const frames: HTMLIFrameElement[] = [];

afterEach(() => {
  for (const frame of frames.splice(0)) frame.remove();
  vi.clearAllMocks();
});

const setup = async (initialPath = "/") => {
  // Each browser history needs its own window and native history stack.
  const frame = document.createElement("iframe");
  frame.src = "/";
  document.body.append(frame);
  frames.push(frame);
  const browserWindow = frame.contentWindow!;
  browserWindow.history.replaceState(null, "", initialPath);

  const actual = await vi.importActual<typeof import("history")>("history");
  const history = actual.createBrowserHistory({ window: browserWindow });
  vi.mocked(createBrowserHistory).mockReturnValue(history);
  const block = vi.spyOn(history, "block");
  let hasSession = false;
  const scope = fork({
    handlers: [
      [
        $$session.__.sessionQuery.__.executeFx,
        () => {
          if (!hasSession) throw sessionRequiredError();
          return sessionInfo;
        },
      ],
      [
        $$session.__.signInMutation.__.executeFx,
        () => {
          hasSession = true;
        },
      ],
      [
        $$session.__.signOutMutation.__.executeFx,
        () => {
          hasSession = false;
        },
      ],
    ],
  });

  await allSettled(appStarted, { scope });

  const expectLocation = async (path: string, query = {}) => {
    await vi.waitFor(() => {
      expect(browserWindow.location.pathname).toBe(path);
      expect(history.location.pathname).toBe(path);
      expect(history.location.search).toBe(browserWindow.location.search);
      expect(scope.getState(router.$path)).toBe(path);
      expect(scope.getState(router.$query)).toEqual(query);
      expect(scope.getState(router.$history)?.location.pathname).toBe(path);
    });
  };

  return { scope, history, browserWindow, block, expectLocation };
};

describe("application browser history", () => {
  it("returns from /about and preserves the forward entry", async () => {
    const { scope, browserWindow, block, expectLocation } = await setup();
    await allSettled(routes.about.open, { scope, params: undefined });
    await expectLocation("/about");

    browserWindow.history.back();
    await expectLocation("/");
    expect(scope.getState(routes.about.$isOpened)).toBe(false);
    expect(scope.getState(routes.home.$isOpened)).toBe(true);

    browserWindow.history.forward();
    await expectLocation("/about");
    expect(scope.getState(routes.about.$isOpened)).toBe(true);
    expect(block).not.toHaveBeenCalled();
  });

  it("supports repeated back/forward and multi-entry traversal with params and query", async () => {
    const { scope, browserWindow, expectLocation } = await setup("/about?utm=mail#details");
    await allSettled(routes.movie.open, { scope, params: { params: { movieId: "42" }, query: { q: "film" } } });
    await allSettled(routes.register.open, { scope, params: undefined });

    browserWindow.history.go(-2);
    await expectLocation("/about", { utm: "mail" });
    expect(browserWindow.location.hash).toBe("#details");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      browserWindow.history.forward();
      await expectLocation("/movies/42", { q: "film" });
      expect(scope.getState(routes.movie.$params)).toEqual({ movieId: "42" });
      browserWindow.history.back();
      await expectLocation("/about", { utm: "mail" });
    }
  });

  it("returns home after the guest profile redirect without trapping history", async () => {
    const { scope, browserWindow, expectLocation } = await setup();
    await allSettled(routes.profile.open, { scope, params: undefined });
    await expectLocation("/login", { redirect: "/profile" });
    expect(scope.getState($$profile.outputs.readyRoute.$isOpened)).toBe(false);

    browserWindow.history.back();
    await expectLocation("/");
    browserWindow.history.forward();
    await expectLocation("/login", { redirect: "/profile" });
  });

  it("preserves previous history when login replaces the guarded profile entry", async () => {
    const { scope, browserWindow, expectLocation } = await setup("/about");
    await allSettled(routes.profile.open, { scope, params: { query: { tab: "lists" } } });
    await expectLocation("/login", { redirect: "/profile?tab=lists" });
    await allSettled($$login.inputs.stubLoginPressed, { scope });
    await expectLocation("/profile", { tab: "lists" });
    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
    expect(scope.getState($$profile.outputs.readyRoute.$isOpened)).toBe(true);
    expect(browserWindow.history.length).toBe(2);

    browserWindow.history.back();
    await expectLocation("/about");
    browserWindow.history.forward();
    await expectLocation("/profile", { tab: "lists" });
  });

  it("replaces profile on sign out and supports router back/forward commands", async () => {
    const { scope, browserWindow, expectLocation } = await setup("/about");
    await allSettled($$session.inputs.signedIn, { scope, params: { login: "movie_fan_42", password: "Kino#2026" } });
    await allSettled(routes.profile.open, { scope, params: undefined });
    await expectLocation("/profile");
    expect(scope.getState($$profile.outputs.readyRoute.$isOpened)).toBe(true);

    await allSettled($$session.inputs.signedOut, { scope });
    await expectLocation("/");
    expect(scope.getState($$profile.outputs.readyRoute.$isOpened)).toBe(false);
    expect(browserWindow.history.length).toBe(2);

    await allSettled(router.back, { scope });
    await expectLocation("/about");
    await allSettled(router.forward, { scope });
    await expectLocation("/");
  });
});
