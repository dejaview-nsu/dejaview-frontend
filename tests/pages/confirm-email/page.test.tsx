import { historyAdapter } from "@effector/router";
import { RouterProvider } from "@effector/router-react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { allSettled, fork, scopeBind } from "effector";
import { Provider } from "effector-react";
import { createMemoryHistory } from "history";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmEmailPage } from "@/pages/confirm-email";

import { BaseLayout } from "@/layouts/base";

import { $$session } from "@/entities/session";

import { type Transport, transportFx, type TransportResponse } from "@/shared/api";
import { router } from "@/shared/routes";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";
import { sessionInfo } from "../../session-scope";

const guestSession = () =>
  jsonResponse(401, { code: "SESSION_REQUIRED", message: "Войдите, чтобы продолжить", field: null });

const expiredLink = () =>
  jsonResponse(410, { code: "AUTH_CONFIRMATION_LINK_EXPIRED", message: "Срок действия ссылки истёк", field: null });

const failure =
  (status: number, code: string, message: string, field: string | null = null) =>
  async () =>
    jsonResponse(status, { code, message, field });

type Handlers = {
  path?: string;
  session?: () => TransportResponse;
  confirm?: Transport;
  resend?: Transport;
  settle?: boolean;
};

const setup = async ({
  path = "/confirm-email?token=abc",
  session = guestSession,
  confirm = async () => jsonResponse(200, sessionInfo),
  resend = async () => jsonResponse(202, { resend_after: 60 }),
  settle = true,
}: Handlers = {}) => {
  const transport = vi.fn<Transport>(async (request) => {
    const route = `${request.method} ${request.path}`;

    if (route === "GET /auth/session") return session();

    if (route === "POST /auth/confirm-email") return confirm(request);

    if (route === "POST /auth/resend-confirmation") return resend(request);

    throw new Error(`Unexpected request ${route}`);
  });
  const scope = fork({ handlers: [[transportFx, transport]] });

  render(
    <StrictMode>
      <Provider value={scope}>
        <RouterProvider router={router}>
          <BaseLayout>
            <ConfirmEmailPage />
          </BaseLayout>
        </RouterProvider>
      </Provider>
    </StrictMode>,
  );

  await act(async () => {
    await allSettled(router.setHistory, {
      scope,
      params: historyAdapter(createMemoryHistory({ initialEntries: [path] })),
    });
    if (settle) await allSettled($$session.inputs.sessionCheckRequested, { scope });
    else scopeBind($$session.inputs.sessionCheckRequested, { scope })();
  });

  const requests = (requestPath: string) =>
    transport.mock.calls.map(([request]) => request).filter((request) => request.path === requestPath);
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const wait = (seconds: number) => act(() => vi.advanceTimersByTimeAsync(seconds * 1000));

  return { scope, transport, requests, user, wait };
};

describe("confirm email page", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends exactly one confirmation with the token from the address in StrictMode", async () => {
    const { requests } = await setup();

    expect(requests("/auth/confirm-email")).toEqual([
      expect.objectContaining({ method: "POST", path: "/auth/confirm-email", body: { token: "abc" } }),
    ]);
  });

  it("200 signs the user in, opens the home page and shows the notification", async () => {
    const { scope, user } = await setup();

    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
    expect(screen.getByRole("button", { name: "Меню пользователя movie_fan_42" })).toBeInTheDocument();
    expect(screen.getByText("Email подтверждён. Добро пожаловать в DejaView!").closest("[role=status]")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Закрыть" }));

    expect(screen.queryByText("Email подтверждён. Добро пожаловать в DejaView!")).not.toBeInTheDocument();
  });

  it("the notification disappears by itself", async () => {
    const { wait } = await setup();

    expect(screen.getByText("Email подтверждён. Добро пожаловать в DejaView!")).toBeInTheDocument();

    await wait(6);

    expect(screen.queryByText("Email подтверждён. Добро пожаловать в DejaView!")).not.toBeInTheDocument();
  });

  it("a signed in user can confirm another account", async () => {
    const { scope, requests } = await setup({ session: () => jsonResponse(200, sessionInfo) });

    expect(requests("/auth/confirm-email")).toHaveLength(1);
    expect(scope.getState(router.$path)).toBe("/");
  });

  it("without a token sends nothing and opens the login page", async () => {
    const { scope, requests } = await setup({ path: "/confirm-email" });

    expect(requests("/auth/confirm-email")).toHaveLength(0);
    expect(scope.getState(router.$path)).toBe("/login");
  });

  it("shows a progress indicator while the confirmation runs", async () => {
    const held = createControlledTransport();
    const { requests } = await setup({ confirm: held.transport, settle: false });
    await held.waitForCalls(1);

    expect(screen.getByText("Подтверждаем email…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Повторить" })).not.toBeInTheDocument();
    expect(requests("/auth/confirm-email")).toHaveLength(1);
  });

  it("410 shows the expired link screen and resends with the same token", async () => {
    const { requests, user } = await setup({ confirm: async () => expiredLink() });

    expect(screen.getByRole("heading", { name: "Срок действия ссылки истёк" })).toBeInTheDocument();

    const button = screen.getByRole("button", { name: "Отправить новую ссылку" });

    expect(button).toBeEnabled();

    await user.click(button);

    expect(await screen.findByRole("heading", { name: "Проверь почту" })).toBeInTheDocument();
    expect(requests("/auth/resend-confirmation")).toEqual([
      expect.objectContaining({ method: "POST", body: { token: "abc" } }),
    ]);
  });

  it("202 shows the sent screen with a timer from resend_after", async () => {
    const { requests, user, wait } = await setup({
      confirm: async () => expiredLink(),
      resend: async () => jsonResponse(202, { resend_after: 42 }),
    });

    await user.click(screen.getByRole("button", { name: "Отправить новую ссылку" }));

    const region = await screen.findByRole("region", { name: "Проверь почту" });

    expect(
      within(region).getByText("Письмо отправлено. Перейдите по ссылке в письме для завершения регистрации"),
    ).toBeInTheDocument();
    expect(within(region).getByText(/Можно отправить ещё раз через 0:4[12]/)).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Отправить повторно" })).toBeDisabled();

    await wait(43);

    expect(within(region).getByRole("button", { name: "Отправить повторно" })).toBeEnabled();

    await user.click(within(region).getByRole("button", { name: "Отправить повторно" }));

    expect(await within(region).findByText(/Можно отправить ещё раз через/)).toBeInTheDocument();
    expect(requests("/auth/resend-confirmation")).toHaveLength(2);
    expect(requests("/auth/resend-confirmation").every(({ body }) => (body as { token: string }).token === "abc")).toBe(
      true,
    );
  });

  it.each([
    [400, "AUTH_VALIDATION_ERROR", "Введите корректные имя пользователя или email", "login"],
    [429, "RATE_LIMITED", "Слишком много запросов. Попробуйте позже", null],
    [500, "INTERNAL_ERROR", "Произошла ошибка. Попробуйте позже", null],
  ])("resend %i %s shows the message under the block", async (status, code, message, field) => {
    const { user } = await setup({ confirm: async () => expiredLink(), resend: failure(status, code, message, field) });

    await user.click(screen.getByRole("button", { name: "Отправить новую ссылку" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByRole("heading", { name: "Срок действия ссылки истёк" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Отправить новую ссылку" })).toBeEnabled();
  });

  it.each([
    [429, "RATE_LIMITED", "Слишком много запросов. Попробуйте позже"],
    [500, "INTERNAL_ERROR", "Произошла ошибка. Попробуйте позже"],
  ])("confirmation %i %s shows the message and allows one retry at a time", async (status, code, message) => {
    const held = createControlledTransport();
    let calls = 0;
    const { requests, user } = await setup({
      confirm: (request) => (calls++ === 0 ? failure(status, code, message)() : held.transport(request)),
    });

    expect(screen.getByRole("alert")).toHaveTextContent(message);

    const retry = screen.getByRole("button", { name: "Повторить" });

    await user.click(retry);
    await held.waitForCalls(1);

    expect(screen.queryByRole("button", { name: "Повторить" })).not.toBeInTheDocument();
    expect(screen.getByText("Подтверждаем email…")).toBeInTheDocument();
    expect(requests("/auth/confirm-email")).toHaveLength(2);

    await act(async () => held.current().resolve(jsonResponse(200, sessionInfo)));

    expect(await screen.findByText("Email подтверждён. Добро пожаловать в DejaView!")).toBeInTheDocument();
    expect(requests("/auth/confirm-email")).toHaveLength(2);
  });
});
