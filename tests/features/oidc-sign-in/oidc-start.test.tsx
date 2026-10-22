import { historyAdapter } from "@effector/router";
import { render, screen } from "@testing-library/react";
import { invoke } from "@withease/factories";
import { allSettled, fork } from "effector";
import { Provider } from "effector-react";
import { createMemoryHistory } from "history";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createOidcStartFactory,
  getOidcProviderName,
  OidcButtons,
  saveOidcReturnPath,
  takeOidcReturnPath,
  toOidcReturnPath,
} from "@/features/oidc-sign-in";

import { router } from "@/shared/routes";

import { userEventSetup } from "../../test-utils";

const $$oidcStart = invoke(createOidcStartFactory);

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("OIDC buttons", () => {
  it("are browser links to the start endpoints", () => {
    render(
      <Provider value={fork()}>
        <OidcButtons model={$$oidcStart} />
      </Provider>,
    );

    expect(screen.getByRole("link", { name: "Продолжить с Google" })).toHaveAttribute(
      "href",
      "/api/v1/auth/oidc/google/start",
    );
    expect(screen.getByRole("link", { name: "Продолжить с Яндекс" })).toHaveAttribute(
      "href",
      "/api/v1/auth/oidc/yandex/start",
    );
    expect(screen.getByRole("link", { name: "Продолжить с VK" })).toHaveAttribute("href", "/api/v1/auth/oidc/vk/start");
  });

  it("saves the return path before the browser leaves", async () => {
    const scope = fork();

    await allSettled(router.setHistory, {
      scope,
      params: historyAdapter(createMemoryHistory({ initialEntries: ["/movies/603?from=search"] })),
    });

    render(
      <Provider value={scope}>
        <OidcButtons model={$$oidcStart} />
      </Provider>,
    );

    const link = screen.getByRole("link", { name: "Продолжить с Google" });

    link.addEventListener("click", (event) => event.preventDefault());
    await userEventSetup().click(link);

    expect(sessionStorage.getItem("dejaview:oidc-return-path")).toBe("/movies/603?from=search");
  });
});

describe("return path", () => {
  it.each([
    [{ path: "/movies/603", query: {} }, "/movies/603"],
    [{ path: "/about", query: { tab: "team" } }, "/about?tab=team"],
    [{ path: "/register", query: {} }, "/"],
    [{ path: "/login", query: { redirect: "/profile" } }, "/profile"],
    [{ path: null, query: {} }, "/"],
  ])("%j returns to %j", (location, expected) => {
    expect(toOidcReturnPath(location)).toBe(expected);
  });

  it("is read once", () => {
    saveOidcReturnPath("/movies/603");

    expect(takeOidcReturnPath()).toBe("/movies/603");
    expect(takeOidcReturnPath()).toBeNull();
  });

  it("works without sessionStorage", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(() => saveOidcReturnPath("/movies/603")).not.toThrow();
    expect(takeOidcReturnPath()).toBeNull();
  });
});

describe("provider names", () => {
  it.each([
    ["google", "Google"],
    ["yandex", "Яндекс"],
    ["vk", "VK"],
    ["github", null],
    [undefined, null],
  ])("%s → %s", (provider, name) => {
    expect(getOidcProviderName(provider)).toBe(name);
  });
});
