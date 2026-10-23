import { RouterProvider } from "@effector/router-react";
import { act, render, screen } from "@testing-library/react";
import { allSettled } from "effector";
import { Provider } from "effector-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OidcCallbackPage } from "@/pages/oidc-callback";
import { $$registerForm, RegisterPage } from "@/pages/register";

import { type RegisterField } from "@/features/register";

import { MOCK_STORAGE_KEYS } from "@/shared/api/mocks";
import { revealElement } from "@/shared/lib/reveal";
import { router } from "@/shared/routes";

import { createTestMockStorage, setupMockApiScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const scrollIntoView = vi.fn();

const offscreen = () =>
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top: 2000,
    bottom: 2048,
    left: 0,
    right: 100,
    width: 100,
    height: 48,
    x: 0,
    y: 2000,
    toJSON: () => ({}),
  });

const reducedMotion = (reduce: boolean) =>
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: reduce && query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as MediaQueryList,
  );

const scrolledElements = () => scrollIntoView.mock.contexts as HTMLElement[];

const filled: Record<RegisterField, string> = {
  username: "anna_k",
  email: "anna@mail.ru",
  birthYear: "2003",
  password: "Kino#2026",
  passwordConfirmation: "Kino#2026",
};

const openRegister = async (scenario?: string, values: Partial<Record<RegisterField, string>> = filled) => {
  const storage = createTestMockStorage();

  if (scenario) storage.set(MOCK_STORAGE_KEYS.authScenario, scenario);

  const { scope } = await setupMockApiScope({ initialEntry: "/register", storage });

  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <RegisterPage />
      </RouterProvider>
    </Provider>,
  );

  for (const [field, value] of Object.entries(values) as [RegisterField, string][]) {
    await act(() => allSettled($$registerForm.inputs.fieldChanged, { scope, params: { field, value } }));
  }

  await userEventSetup().click(screen.getByRole("button", { name: "Зарегистрироваться" }));
};

const input = (label: string) => screen.getByLabelText(label, { selector: "input" });

beforeEach(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
  scrollIntoView.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("scroll to the registration error", () => {
  it("a server error without a field scrolls to the message block and focuses it", async () => {
    offscreen();
    reducedMotion(false);

    await openRegister("register_server_error");

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent("Произошла ошибка. Попробуйте позже");
    expect(alert).toHaveFocus();
    expect(scrolledElements()).toEqual([alert]);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(alert).toHaveClass("scroll-mt-6");
  });

  it("a server error with a field scrolls to that field and focuses it", async () => {
    offscreen();
    reducedMotion(false);

    await openRegister("register_username_taken");

    await screen.findByRole("alert");

    expect(input("Имя пользователя")).toHaveFocus();
    expect(scrolledElements()).toEqual([input("Имя пользователя")]);
    expect(input("Имя пользователя")).toHaveClass("scroll-mt-16");
  });

  it("with reduced motion the page jumps without animation", async () => {
    offscreen();
    reducedMotion(true);

    await openRegister("register_rate_limited");

    await screen.findByRole("alert");

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
  });

  it("an empty submit scrolls to the first invalid field", async () => {
    offscreen();
    reducedMotion(false);

    await openRegister(undefined, {});

    expect(input("Имя пользователя")).toHaveFocus();
    expect(scrolledElements()).toEqual([input("Имя пользователя")]);
  });

  it("a visible element is focused without scrolling", () => {
    const element = document.createElement("button");

    document.body.append(element);
    revealElement(element);

    expect(element).toHaveFocus();
    expect(scrollIntoView).not.toHaveBeenCalled();
    element.remove();
  });
});

describe("scroll to the error on the OIDC completion screen", () => {
  const openCompletion = async (completeScenario: string) => {
    const storage = createTestMockStorage();

    storage.set(MOCK_STORAGE_KEYS.authScenario, `oidc_pending_registration,${completeScenario}`);

    const { scope } = await act(() =>
      setupMockApiScope({ initialEntry: "/auth/oidc?provider=google&result=registration_required", storage }),
    );

    render(
      <Provider value={scope}>
        <RouterProvider router={router}>
          <OidcCallbackPage />
        </RouterProvider>
      </Provider>,
    );

    const user = userEventSetup();

    await user.type(input("Год рождения"), "1998");
    await user.click(screen.getByRole("button", { name: "Продолжить" }));
  };

  it("AUTH_EMAIL_TAKEN without a field scrolls to the message block", async () => {
    offscreen();
    reducedMotion(false);

    await openCompletion("oidc_complete_email_taken");

    const alert = await screen.findByRole("alert");

    expect(alert).toHaveTextContent("Пользователь с таким email уже существует");
    expect(alert).toHaveFocus();
    expect(scrolledElements().at(-1)).toBe(alert);
  });

  it("AUTH_USERNAME_TAKEN scrolls to the username field", async () => {
    offscreen();
    reducedMotion(false);

    await openCompletion("oidc_complete_username_taken");

    await screen.findByRole("alert");

    expect(input("Имя пользователя")).toHaveFocus();
    expect(scrolledElements().at(-1)).toBe(input("Имя пользователя"));
  });
});
