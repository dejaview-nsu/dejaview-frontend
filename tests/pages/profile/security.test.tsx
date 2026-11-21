import { RouterProvider } from "@effector/router-react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { type Scope } from "effector";
import { Provider } from "effector-react";
import { afterEach, describe, expect, it } from "vitest";

import { Routing } from "@/pages";

import { type Transport } from "@/shared/api";
import { createMockTransport, MOCK_STORAGE_KEYS, type MockStorage, NO_MOCK_DELAYS } from "@/shared/api/mocks";
import { router } from "@/shared/routes";

import { createTestMockStorage, setupApiScope, setupMockApiScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const GENERAL = "Произошла ошибка. Попробуйте позже";

const renderApp = (scope: Scope) =>
  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <Routing />
      </RouterProvider>
    </Provider>,
  );

const signedInStorage = ({ passwordless = false } = {}) => {
  const storage = createTestMockStorage();

  storage.set(MOCK_STORAGE_KEYS.session, "authenticated");

  if (passwordless) storage.set(MOCK_STORAGE_KEYS.sessionPasswordless, "true");

  return storage;
};

const openSecurity = async (storage: MockStorage) => {
  const { scope } = await act(() => setupMockApiScope({ initialEntry: "/profile?tab=security", storage }));

  renderApp(scope);

  return { scope, user: userEventSetup() };
};

const card = () => within(screen.getByRole("region", { name: "Пароль" }));

const fillForm = async (
  user: ReturnType<typeof userEventSetup>,
  {
    current = "Kino#2026",
    password = "Kino#2027",
    confirmation = "Kino#2027",
  }: { current?: string; password?: string; confirmation?: string } = {},
) => {
  if (current) await user.type(card().getByLabelText("Текущий пароль"), current);
  await user.type(card().getByLabelText("Новый пароль"), password);
  await user.type(card().getByLabelText("Подтверждение нового пароля"), confirmation);
};

afterEach(() => sessionStorage.clear());

describe("profile security", () => {
  it("shows the password card with the change button", async () => {
    await openSecurity(signedInStorage());

    expect(await screen.findByRole("heading", { level: 2, name: "Безопасность" })).toBeInTheDocument();
    expect(card().getByText("Для входа по имени пользователя или email")).toBeInTheDocument();
    expect(card().getByRole("button", { name: "Сменить пароль" })).toBeInTheDocument();
    expect(card().queryByLabelText("Новый пароль")).not.toBeInTheDocument();
  });

  it("changes the password and shows the success message above the card", async () => {
    const { user } = await openSecurity(signedInStorage());

    await user.click(await screen.findByRole("button", { name: "Сменить пароль" }));

    expect(card().getByLabelText("Текущий пароль")).toHaveFocus();
    expect(card().getByRole("list", { name: "Требования к паролю" })).toBeInTheDocument();

    await fillForm(user);
    await user.click(card().getByRole("button", { name: "Сохранить пароль" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Пароль успешно изменён");
    expect(card().queryByLabelText("Новый пароль")).not.toBeInTheDocument();
    expect(card().getByRole("button", { name: "Сменить пароль" })).toBeInTheDocument();
  });

  it("sets a password without the current one when the account has none", async () => {
    const storage = signedInStorage({ passwordless: true });
    const { user } = await openSecurity(storage);

    await user.click(await screen.findByRole("button", { name: "Сменить пароль" }));

    expect(
      card().getByText(
        "У вашей учётной записи нет пароля. Вы можете задать его для входа по имени пользователя или email",
      ),
    ).toBeInTheDocument();
    expect(card().queryByLabelText("Текущий пароль")).not.toBeInTheDocument();
    expect(card().getByLabelText("Новый пароль")).toHaveFocus();

    await fillForm(user, { current: "" });
    await user.click(card().getByRole("button", { name: "Сохранить пароль" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Пароль успешно изменён");
    expect(storage.get(MOCK_STORAGE_KEYS.sessionPasswordless)).toBeNull();

    await user.click(card().getByRole("button", { name: "Сменить пароль" }));

    expect(card().getByLabelText("Текущий пароль")).toBeInTheDocument();
  });

  it("shows client validation errors under the fields", async () => {
    const { user } = await openSecurity(signedInStorage());

    await user.click(await screen.findByRole("button", { name: "Сменить пароль" }));
    await user.type(card().getByLabelText("Новый пароль"), "short");
    await user.type(card().getByLabelText("Подтверждение нового пароля"), "other");
    await user.click(card().getByRole("button", { name: "Сохранить пароль" }));

    expect(card().getByText("Введите текущий пароль")).toBeInTheDocument();
    expect(card().getByText("Пароли не совпадают")).toBeInTheDocument();
    expect(card().getByLabelText("Текущий пароль")).toHaveAttribute("aria-invalid", "true");
  });

  it.each([
    ["password_change_current_invalid", "Неверный текущий пароль"],
    ["password_change_same_as_current", "Новый пароль должен отличаться от текущего"],
    ["password_change_rate_limited", GENERAL],
    ["password_change_server_error", GENERAL],
    ["password_change_network_error", GENERAL],
    ["password_change_timeout", GENERAL],
    ["password_change_invalid_response", GENERAL],
  ])("shows the %s error above the form and keeps the values", async (scenario, message) => {
    const storage = signedInStorage();
    storage.set(MOCK_STORAGE_KEYS.authScenario, scenario);
    const { user } = await openSecurity(storage);

    await user.click(await screen.findByRole("button", { name: "Сменить пароль" }));
    await fillForm(user);
    await user.click(card().getByRole("button", { name: "Сохранить пароль" }));

    expect(await card().findByRole("alert")).toHaveTextContent(message);
    expect(card().getByLabelText("Текущий пароль")).toHaveValue("Kino#2026");
    expect(card().getByLabelText("Новый пароль")).toHaveValue("Kino#2027");
    expect(card().getByRole("button", { name: "Сохранить пароль" })).toBeEnabled();
  });

  it.each([
    ["password_change_current_required", "Текущий пароль", "Введите текущий пароль"],
    ["password_change_validation_error", "Новый пароль", "Пароль должен содержать не менее 8 символов"],
  ])("shows the %s server error under the field", async (scenario, label, message) => {
    const storage = signedInStorage();
    storage.set(MOCK_STORAGE_KEYS.authScenario, scenario);
    const { user } = await openSecurity(storage);

    await user.click(await screen.findByRole("button", { name: "Сменить пароль" }));
    await fillForm(user);
    await user.click(card().getByRole("button", { name: "Сохранить пароль" }));

    await waitFor(() => expect(card().getByLabelText(label)).toHaveAttribute("aria-invalid", "true"));
    expect(card().getByText(message)).toBeInTheDocument();
    expect(card().queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sends the user to login and back to the security tab when the session expires", async () => {
    const storage = signedInStorage();
    storage.set(MOCK_STORAGE_KEYS.authScenario, "password_change_session_expired");
    const { scope, user } = await openSecurity(storage);

    await user.click(await screen.findByRole("button", { name: "Сменить пароль" }));
    await fillForm(user);
    await user.click(card().getByRole("button", { name: "Сохранить пароль" }));

    await waitFor(() => expect(scope.getState(router.$path)).toBe("/login"));
    expect(scope.getState(router.$query)).toEqual({ redirect: "/profile?tab=security" });
  });

  it("blocks saving while the request is pending and cancels it on «Отмена»", async () => {
    const storage = signedInStorage();
    const mock = createMockTransport({ storage, delays: NO_MOCK_DELAYS });
    const signals: AbortSignal[] = [];
    const transport: Transport = async (request) => {
      if (request.method === "PUT" && request.path === "/users/me/password") {
        if (request.signal) signals.push(request.signal);

        return new Promise(() => {});
      }

      return mock(request);
    };
    const { scope } = await act(() => setupApiScope({ initialEntry: "/profile?tab=security", transport }));
    renderApp(scope);
    const user = userEventSetup();

    await user.click(await screen.findByRole("button", { name: "Сменить пароль" }));
    await fillForm(user);
    await user.click(card().getByRole("button", { name: "Сохранить пароль" }));

    const saving = card().getByRole("button", { name: "Сохраняем…" });

    expect(saving).toBeDisabled();

    await user.click(saving);

    expect(signals).toHaveLength(1);

    await user.click(card().getByRole("button", { name: "Отмена" }));

    expect(signals[0].aborted).toBe(true);
    expect(card().getByRole("button", { name: "Сменить пароль" })).toHaveFocus();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("closes the form and clears the values when the user leaves the tab", async () => {
    const { user } = await openSecurity(signedInStorage());

    await user.click(await screen.findByRole("button", { name: "Сменить пароль" }));
    await user.type(card().getByLabelText("Новый пароль"), "Kino#2027");
    await user.click(screen.getByRole("tab", { name: "Мои оценки" }));
    await user.click(screen.getByRole("tab", { name: "Безопасность" }));

    expect(card().queryByLabelText("Новый пароль")).not.toBeInTheDocument();

    await user.click(card().getByRole("button", { name: "Сменить пароль" }));

    expect(card().getByLabelText("Новый пароль")).toHaveValue("");
  });
});
