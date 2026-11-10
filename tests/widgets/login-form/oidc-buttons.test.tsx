import { RouterProvider } from "@effector/router-react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { allSettled } from "effector";
import { Provider } from "effector-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Routing } from "@/pages";

import { $$session } from "@/entities/session";

import { type Transport } from "@/shared/api";
import { router } from "@/shared/routes";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";
import { setupApiScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const RETURN_PATH_KEY = "dejaview:oidc-return-path";
const ORIGIN_KEY = "dejaview:oidc-origin";
const PROVIDERS = [
  ["Продолжить с Google", "/api/v1/auth/oidc/google/start"],
  ["Продолжить с Яндекс", "/api/v1/auth/oidc/yandex/start"],
  ["Продолжить с VK", "/api/v1/auth/oidc/vk/start"],
] as const;

const guest = () => jsonResponse(401, { code: "SESSION_REQUIRED", message: "Войдите, чтобы продолжить", field: null });
const movieNotFound = () => jsonResponse(404, { code: "MOVIE_NOT_FOUND", message: "Фильм не найден", field: null });

const setup = async (path: string, { dialog = false } = {}) => {
  const held = createControlledTransport();
  const transport = vi.fn<Transport>((request) => {
    if (request.path === "/auth/session") return Promise.resolve(guest());
    if (request.path.startsWith("/movies/")) return Promise.resolve(movieNotFound());

    return held.transport(request);
  });
  const { scope } = await setupApiScope({ initialEntry: path, transport });

  if (dialog) await allSettled($$session.inputs.loginPressed, { scope });

  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <Routing />
      </RouterProvider>
    </Provider>,
  );

  const form = dialog
    ? within(await screen.findByRole("dialog", { name: "Вход в DejaView" }))
    : within(screen.getByRole("region", { name: "Вход в DejaView" }));
  const link = (name: string) => form.getByRole("link", { name });
  const submit = () => form.getByRole("button", { name: /Войти|Входим/ });

  return { scope, held, form, link, submit, user: userEventSetup() };
};

const choose = async (user: ReturnType<typeof userEventSetup>, link: HTMLElement) => {
  link.addEventListener("click", (event) => event.preventDefault());
  await user.click(link);
};

afterEach(() => {
  sessionStorage.clear();
});

describe("provider buttons on the login form", () => {
  it.each([
    ["the /login page", "/login", false],
    ["the login dialog", "/movies/603", true],
  ])("%s links to every provider start", async (_, path, dialog) => {
    const { link } = await setup(path, { dialog });

    for (const [name, href] of PROVIDERS) {
      expect(link(name)).toHaveAttribute("href", href);
      expect(link(name)).not.toHaveAttribute("aria-disabled");
    }
  });

  it("are reached by Tab after the submit button and before the registration link", async () => {
    const { form, user } = await setup("/movies/603", { dialog: true });

    act(() => form.getByLabelText("Имя пользователя или Email").focus());

    const names: string[] = [];

    for (let step = 0; step < 8; step += 1) {
      await user.tab();
      names.push(document.activeElement?.textContent || document.activeElement?.getAttribute("aria-label") || "");
    }

    expect(names).toEqual([
      "",
      "Показать пароль",
      "Забыли пароль?",
      "Войти",
      "Продолжить с Google",
      "Продолжить с Яндекс",
      "Продолжить с VK",
      "Зарегистрироваться",
    ]);
  });

  it("choosing a provider in the dialog remembers the page and the login form", async () => {
    const { link, user } = await setup("/movies/603", { dialog: true });

    await choose(user, link("Продолжить с Google"));

    expect(sessionStorage.getItem(RETURN_PATH_KEY)).toBe("/movies/603");
    expect(sessionStorage.getItem(ORIGIN_KEY)).toBe("login");
  });

  it("choosing a provider on /login remembers the redirect", async () => {
    const { link, user } = await setup("/login?redirect=%2Fprofile");

    await choose(user, link("Продолжить с VK"));

    expect(sessionStorage.getItem(RETURN_PATH_KEY)).toBe("/profile");
    expect(sessionStorage.getItem(ORIGIN_KEY)).toBe("login");
  });

  it("while the browser leaves for a provider, the submit button and other providers are blocked", async () => {
    const { form, held, link, submit, user } = await setup("/movies/603", { dialog: true });

    await user.type(form.getByLabelText("Имя пользователя или Email"), "movie_fan_42");
    await user.type(form.getByLabelText("Пароль", { selector: "input" }), "Kino#2026");
    await choose(user, link("Продолжить с Google"));

    expect(submit()).toBeDisabled();

    for (const [name] of PROVIDERS) {
      expect(link(name)).toHaveAttribute("aria-disabled", "true");
      expect(link(name)).toHaveClass("bg-disabled-bg", "text-disabled-text");
    }

    expect(fireEvent.click(link("Продолжить с Яндекс"))).toBe(false);
    fireEvent.submit(form.getByRole("form", { name: "Вход в DejaView" }));
    await act(async () => {});

    expect(sessionStorage.getItem(RETURN_PATH_KEY)).toBe("/movies/603");
    expect(held.calls).toHaveLength(0);
  });

  it("while the password login is pending, provider buttons are inactive", async () => {
    const { form, held, link, submit, user } = await setup("/login");

    await user.type(form.getByLabelText("Имя пользователя или Email"), "movie_fan_42");
    await user.type(form.getByLabelText("Пароль", { selector: "input" }), "Kino#2026");
    await user.click(submit());
    await held.waitForCalls(1);

    expect(submit()).toHaveTextContent("Входим...");

    for (const [name] of PROVIDERS) {
      expect(link(name)).toHaveAttribute("aria-disabled", "true");
      expect(fireEvent.click(link(name))).toBe(false);
    }

    expect(sessionStorage.getItem(RETURN_PATH_KEY)).toBeNull();
    expect(sessionStorage.getItem(ORIGIN_KEY)).toBeNull();

    await act(async () => {
      held.current().resolve(jsonResponse(401, { code: "AUTH_INVALID_CREDENTIALS", message: "x", field: null }));
    });

    await waitFor(() => expect(link("Продолжить с Google")).not.toHaveAttribute("aria-disabled"));
  });

  it("a page restored by the Back button unlocks the form", async () => {
    const { link, submit, user } = await setup("/login");

    await choose(user, link("Продолжить с Google"));
    expect(submit()).toBeDisabled();

    act(() => {
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });

    expect(submit()).toBeEnabled();
    expect(link("Продолжить с Google")).not.toHaveAttribute("aria-disabled");
  });

  it("closing the dialog unlocks the form for the next opening", async () => {
    const { scope, link, user } = await setup("/movies/603", { dialog: true });

    await choose(user, link("Продолжить с Google"));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await act(() => allSettled($$session.inputs.loginPressed, { scope }));

    const dialog = within(await screen.findByRole("dialog", { name: "Вход в DejaView" }));

    expect(dialog.getByRole("button", { name: "Войти" })).toBeEnabled();
    expect(dialog.getByRole("link", { name: "Продолжить с Google" })).not.toHaveAttribute("aria-disabled");
  });
});
