import { RouterProvider } from "@effector/router-react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { Provider } from "effector-react";
import { describe, expect, it, vi } from "vitest";

import { Routing } from "@/pages";

import { $$session } from "@/entities/session";

import { type Transport } from "@/shared/api";
import { MOCK_STORAGE_KEYS } from "@/shared/api/mocks";
import { router } from "@/shared/routes";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";
import { createTestMockStorage, setupApiScope, setupMockApiScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const SENT =
  "Если учётная запись с таким email существует, мы отправили ссылку для восстановления пароля. Проверьте почту";

const renderRouting = (scope: Parameters<typeof Provider>[0]["value"]) =>
  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <Routing />
      </RouterProvider>
    </Provider>,
  );

const setup = async ({ path = "/forgot-password", scenario }: { path?: string; scenario?: string } = {}) => {
  const storage = createTestMockStorage();

  if (scenario) storage.set(MOCK_STORAGE_KEYS.authScenario, scenario);

  const { scope, history } = await setupMockApiScope({ initialEntry: path, storage });

  renderRouting(scope);

  return { scope, history, storage, user: userEventSetup() };
};

const field = () => screen.getByLabelText("Имя пользователя или Email");

describe("forgot password page", () => {
  it("shows the request form with a level one heading", async () => {
    await setup();

    expect(await screen.findByRole("heading", { level: 1, name: "Восстановление пароля" })).toBeInTheDocument();
    expect(screen.getByText("Укажи имя пользователя или email — пришлём ссылку для смены пароля")).toBeInTheDocument();
    expect(field()).toHaveAttribute("placeholder", "anna_k или anna@mail.ru");
    expect(screen.getByRole("button", { name: "Восстановить пароль" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Вернуться ко входу" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "DejaView — главная" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Войти" })).not.toBeInTheDocument();
  });

  it("validates on blur and links the error to the field", async () => {
    const { user } = await setup();

    await user.click(await screen.findByLabelText("Имя пользователя или Email"));
    await user.tab();

    const message = screen.getByText("Введите имя пользователя или email").closest("p");

    expect(field()).toHaveAttribute("aria-invalid", "true");
    expect(field().getAttribute("aria-describedby")?.split(" ")).toContain(message?.id);

    await user.type(field(), "anna k");
    await user.tab();

    expect(screen.getByText("Введите корректные имя пользователя или email")).toBeInTheDocument();
  });

  it("an invalid submission sends nothing and focuses the field", async () => {
    const transport = vi.fn<Transport>(async (request) =>
      request.path === "/auth/session"
        ? jsonResponse(401, { code: "SESSION_REQUIRED", message: "Войдите", field: null })
        : jsonResponse(202, ""),
    );
    const { scope } = await setupApiScope({ initialEntry: "/forgot-password", transport });
    const user = userEventSetup();

    renderRouting(scope);

    await user.click(await screen.findByRole("button", { name: "Восстановить пароль" }));

    await waitFor(() => expect(field()).toHaveFocus());
    expect(transport.mock.calls.map(([request]) => request.path)).toEqual(["/auth/session"]);
  });

  it("shows the sending state, blocks the button and then the same message for any login", async () => {
    const controlled = createControlledTransport();
    const transport: Transport = (request) =>
      request.path === "/auth/session"
        ? Promise.resolve(jsonResponse(401, { code: "SESSION_REQUIRED", message: "Войдите", field: null }))
        : controlled.transport(request);
    const { scope } = await setupApiScope({ initialEntry: "/forgot-password", transport });
    const user = userEventSetup();

    renderRouting(scope);

    await user.type(await screen.findByLabelText("Имя пользователя или Email"), "nobody@example.test");
    await user.click(screen.getByRole("button", { name: "Восстановить пароль" }));

    const pending = await screen.findByRole("button", { name: "Отправляем…" });

    expect(pending).toBeDisabled();

    await user.click(pending);

    expect(controlled.calls).toHaveLength(1);

    await act(async () => controlled.current().resolve(jsonResponse(202, "")));

    const heading = await screen.findByRole("heading", { level: 1, name: "Проверь почту" });

    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByText(SENT)).toBeInTheDocument();
    expect(
      screen.getByText("Ссылка действует 1 час. Если запросишь ещё раз, предыдущая ссылка перестанет работать"),
    ).toBeInTheDocument();
    expect(screen.getByText(/и перейди по ссылке в нём, чтобы задать новый пароль/)).toBeInTheDocument();
    expect(screen.queryByText("nobody@example.test")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Вернуться ко входу" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("button", { name: "Запросить ссылку ещё раз" })).toBeDisabled();
    expect(screen.getByText("Можно запросить ещё раз через 1:00")).toBeInTheDocument();
  });

  it.each(["anna_k", "anna@mail.ru"])("the sent screen is identical for %s", async (login) => {
    const { user } = await setup();

    await user.type(await screen.findByLabelText("Имя пользователя или Email"), login);
    await user.click(screen.getByRole("button", { name: "Восстановить пароль" }));

    const card = (await screen.findByRole("heading", { name: "Проверь почту" })).closest("section") as HTMLElement;

    expect(card.textContent).not.toContain(login);
    expect(within(card).getByText(SENT)).toBeInTheDocument();
  });

  it.each(["password_request_server_error", "password_request_rate_limited", "password_request_network_error"])(
    "%s shows the error over the form and keeps the value",
    async (scenario) => {
      const { user } = await setup({ scenario });

      await user.type(await screen.findByLabelText("Имя пользователя или Email"), "anna_k");
      await user.click(screen.getByRole("button", { name: "Восстановить пароль" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Произошла ошибка. Попробуйте позже");
      expect(screen.getByRole("alert")).toHaveFocus();
      expect(field()).toHaveValue("anna_k");
      expect(screen.queryByRole("heading", { name: "Проверь почту" })).not.toBeInTheDocument();
    },
  );

  it("redirects a signed in user to the home page", async () => {
    const storage = createTestMockStorage();

    storage.set(MOCK_STORAGE_KEYS.authScenario, "session_user");

    const { scope } = await setupMockApiScope({ initialEntry: "/forgot-password", storage });

    renderRouting(scope);

    await waitFor(() => expect(scope.getState(router.$path)).toBe("/"));
  });
});

describe("«Забыли пароль?» in the login form", () => {
  it("leads from the login page to the request form", async () => {
    const { scope, user } = await setup({ path: "/login" });

    await user.click(await screen.findByRole("link", { name: "Забыли пароль?" }));

    expect(scope.getState(router.$path)).toBe("/forgot-password");
    expect(await screen.findByRole("heading", { name: "Восстановление пароля" })).toBeInTheDocument();
  });

  it("closes the login dialog and opens the request form", async () => {
    const { scope, user } = await setup({ path: "/about" });

    await user.click(await screen.findByRole("button", { name: "Войти" }));

    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("link", { name: "Забыли пароль?" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(scope.getState(router.$path)).toBe("/forgot-password");
    expect(scope.getState($$session.outputs.$isLoginDialogOpened)).toBe(false);
  });
});
