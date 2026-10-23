import { RouterProvider } from "@effector/router-react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { allSettled } from "effector";
import { Provider } from "effector-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { $$registerForm, RegisterPage } from "@/pages/register";

import { type RegisterField } from "@/features/register";

import type { Transport, TransportRequest } from "@/shared/api";
import { router } from "@/shared/routes";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";
import { setupSessionScope } from "../../session-scope";

const registered = jsonResponse(201, { resend_after: 60 });

const filled = {
  username: "anna_k",
  email: "anna@mail.ru",
  birthYear: "2003",
  password: "Kino#2026",
  passwordConfirmation: "Kino#2026",
};

const resendRequests = (transport: ReturnType<typeof vi.fn<Transport>>) =>
  transport.mock.calls.map(([request]) => request).filter(({ path }) => path === "/auth/resend-confirmation");

const renderPage = async (resend: Transport) => {
  const transport = vi.fn<Transport>((request: TransportRequest) =>
    request.path === "/auth/register" ? Promise.resolve(registered) : resend(request),
  );
  const { scope } = await setupSessionScope({ initialEntry: "/register", transport });

  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <RegisterPage />
      </RouterProvider>
    </Provider>,
  );

  return { scope, transport };
};

const setup = async (resend: Transport = async () => jsonResponse(202, { resend_after: 60 })) => {
  const page = await renderPage(resend);
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

  for (const [field, value] of Object.entries(filled) as [RegisterField, string][]) {
    await act(() => allSettled($$registerForm.inputs.fieldChanged, { scope: page.scope, params: { field, value } }));
  }

  await user.click(screen.getByRole("button", { name: "Зарегистрироваться" }));
  await screen.findByRole("heading", { name: "Проверь почту" });

  const button = () => screen.getByRole("button", { name: "Отправить повторно" });
  const wait = (seconds: number) => act(() => vi.advanceTimersByTimeAsync(seconds * 1000));

  return { ...page, user, button, wait };
};

describe("check email screen", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the entered email on /register and starts a 60 second timer", async () => {
    const { scope, button, wait } = await setup();
    const screenRegion = screen.getByRole("region", { name: "Проверь почту" });

    expect(scope.getState(router.$path)).toBe("/register");
    expect(within(screenRegion).getByText("anna@mail.ru")).toBeInTheDocument();
    expect(
      within(screenRegion).getByText("Ссылка действует 24 часа. Не видишь письма — проверь папку «Спам»"),
    ).toBeInTheDocument();
    expect(button()).toBeDisabled();
    expect(screen.getByText(/Можно отправить ещё раз через (1:00|0:59)/)).toBeInTheDocument();

    await wait(15);

    expect(screen.getByText(/Можно отправить ещё раз через 0:4[45]/)).toBeInTheDocument();
    expect(button()).toBeDisabled();

    await wait(46);

    expect(screen.queryByText(/Можно отправить ещё раз/)).not.toBeInTheDocument();
    expect(button()).toBeEnabled();
  });

  it("202 sends the email as login and restarts the timer from resend_after", async () => {
    const { transport, user, button, wait } = await setup(async () => jsonResponse(202, { resend_after: 42 }));

    await wait(61);
    await user.click(button());

    expect(await screen.findByText(/Можно отправить ещё раз через 0:4[12]/)).toBeInTheDocument();
    expect(button()).toBeDisabled();
    expect(resendRequests(transport)).toEqual([
      expect.objectContaining({ method: "POST", path: "/auth/resend-confirmation", body: { login: "anna@mail.ru" } }),
    ]);
  });

  it.each([
    [400, "AUTH_VALIDATION_ERROR", "Введите корректные имя пользователя или email", "login"],
    [429, "RATE_LIMITED", "Слишком много запросов. Попробуйте позже", null],
    [500, "INTERNAL_ERROR", "Произошла ошибка. Попробуйте позже", null],
  ])("%i %s shows the server message without restarting the timer", async (status, code, message, field) => {
    const { user, button, wait } = await setup(async () => jsonResponse(status, { code, message, field }));

    await wait(61);
    await user.click(button());

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText(/Можно отправить ещё раз/)).not.toBeInTheDocument();
    expect(button()).toBeEnabled();
  });

  it("blocks the button while the request runs and sends one request", async () => {
    const held = createControlledTransport();
    const { transport, user, button, wait } = await setup(held.transport);

    await wait(61);
    await user.click(button());
    await held.waitForCalls(1);

    expect(button()).toBeDisabled();

    await user.click(button());

    expect(resendRequests(transport)).toHaveLength(1);

    await act(async () => held.current().resolve(jsonResponse(202, { resend_after: 60 })));

    expect(await screen.findByText(/Можно отправить ещё раз через/)).toBeInTheDocument();
    expect(resendRequests(transport)).toHaveLength(1);
  });

  it("reloading /register shows the registration form again", async () => {
    await setup();
    cleanup();

    await renderPage(async () => jsonResponse(202, { resend_after: 60 }));

    expect(screen.getByRole("form", { name: "Создать аккаунт" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Проверь почту" })).not.toBeInTheDocument();
  });
});
