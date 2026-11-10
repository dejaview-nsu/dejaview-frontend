import { historyAdapter } from "@effector/router";
import { fireEvent, render, screen } from "@testing-library/react";
import { invoke } from "@withease/factories";
import { allSettled, createStore, fork } from "effector";
import { Provider } from "effector-react";
import { createMemoryHistory } from "history";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createOidcStartFactory, OidcButtons, takeOidcOrigin } from "@/features/oidc-sign-in";

import { router } from "@/shared/routes";

import { userEventSetup } from "../../test-utils";

const $loginPending = createStore(false);
const $$registerStart = invoke(createOidcStartFactory);
const $$loginStart = invoke(createOidcStartFactory, { origin: "login", $blocked: $loginPending });

const setup = async (path = "/movies/603", save?: (path: string) => void) => {
  const scope = fork({ handlers: save ? [[$$registerStart.__.saveReturnPathFx, save]] : [] });

  await allSettled(router.setHistory, {
    scope,
    params: historyAdapter(createMemoryHistory({ initialEntries: [path] })),
  });

  return scope;
};

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe("OIDC start model", () => {
  it("starts once and ignores repeated choices until reset", async () => {
    const save = vi.fn();
    const scope = await setup("/movies/603", save);

    await allSettled($$registerStart.inputs.providerChosen, { scope, params: "google" });
    await allSettled($$registerStart.inputs.providerChosen, { scope, params: "vk" });

    expect(save).toHaveBeenCalledTimes(1);
    expect(scope.getState($$registerStart.outputs.$pending)).toBe(true);

    await allSettled($$registerStart.inputs.reset, { scope });

    expect(scope.getState($$registerStart.outputs.$pending)).toBe(false);

    await allSettled($$registerStart.inputs.providerChosen, { scope, params: "vk" });

    expect(save).toHaveBeenCalledTimes(2);
  });

  it("remembers registration as the origin by default", async () => {
    const scope = await setup();

    await allSettled($$registerStart.inputs.providerChosen, { scope, params: "google" });

    expect(sessionStorage.getItem("dejaview:oidc-origin")).toBe("register");
    expect(takeOidcOrigin()).toBe("register");
  });

  it("does not start while the blocking store is on", async () => {
    const scope = fork({ values: [[$loginPending, true]] });

    await allSettled($$loginStart.inputs.providerChosen, { scope, params: "google" });

    expect(scope.getState($$loginStart.outputs.$disabled)).toBe(true);
    expect(scope.getState($$loginStart.outputs.$pending)).toBe(false);
    expect(sessionStorage.getItem("dejaview:oidc-origin")).toBeNull();
  });

  it("an unknown or missing origin is treated as registration", () => {
    sessionStorage.setItem("dejaview:oidc-origin", "profile");

    expect(takeOidcOrigin()).toBe("register");
    expect(takeOidcOrigin()).toBe("register");
  });
});

describe("OIDC buttons while starting", () => {
  it("a second click right after the first one does not leave the page again", async () => {
    const scope = await setup();
    const user = userEventSetup();

    render(
      <Provider value={scope}>
        <OidcButtons model={$$loginStart} />
      </Provider>,
    );

    const google = screen.getByRole("link", { name: "Продолжить с Google" });

    google.addEventListener("click", (event) => event.preventDefault());
    await user.click(google);

    expect(fireEvent.click(screen.getByRole("link", { name: "Продолжить с VK" }))).toBe(false);
    expect(sessionStorage.getItem("dejaview:oidc-origin")).toBe("login");
    expect(sessionStorage.getItem("dejaview:oidc-return-path")).toBe("/movies/603");
  });

  it("a click with a modifier opens a new tab without locking this page", async () => {
    const scope = await setup();

    render(
      <Provider value={scope}>
        <OidcButtons model={$$loginStart} />
      </Provider>,
    );

    const google = screen.getByRole("link", { name: "Продолжить с Google" });

    google.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(google, { ctrlKey: true });

    expect(scope.getState($$loginStart.outputs.$pending)).toBe(false);
    expect(google).not.toHaveAttribute("aria-disabled");
  });
});
