import { RouterProvider } from "@effector/router-react";
import { render, screen, waitFor, within } from "@testing-library/react";
import { Provider } from "effector-react";
import { describe, expect, it, vi } from "vitest";

import { Routing } from "@/pages";

import { $$session } from "@/entities/session";

import { type Transport } from "@/shared/api";
import { MOCK_STORAGE_KEYS } from "@/shared/api/mocks";
import { router } from "@/shared/routes";

import { jsonResponse } from "../../controlled-transport";
import { createTestMockStorage, setupApiScope, setupMockApiScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const VALID = "Kino#2026";

const setup = async ({ path = "/reset-password?token=abc", scenario }: { path?: string; scenario?: string } = {}) => {
  const storage = createTestMockStorage();

  if (scenario) storage.set(MOCK_STORAGE_KEYS.authScenario, scenario);

  const { scope, history } = await setupMockApiScope({ initialEntry: path, storage });

  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <Routing />
      </RouterProvider>
    </Provider>,
  );

  return { scope, history, user: userEventSetup() };
};

const password = () => screen.getByLabelText<HTMLInputElement>("Новый пароль", { selector: "input" });
const confirmation = () => screen.getByLabelText("Подтверждение нового пароля", { selector: "input" });
const checklist = () =>
  within(screen.getByRole("list", { name: "Требования к паролю" }))
    .getAllByRole("listitem")
    .map((item) => item.getAttribute("data-state"));

const openForm = async (options?: Parameters<typeof setup>[0]) => {
  const page = await setup(options);

  await screen.findByRole("heading", { level: 1, name: "Новый пароль" });

  return page;
};

describe("reset password page", () => {
  describe("link check", () => {
    it("checks the token from the address, removes it from the address bar and shows the form", async () => {
      const transport = vi.fn<Transport>(async (request) =>
        request.path === "/auth/session"
          ? jsonResponse(401, { code: "SESSION_REQUIRED", message: "Войдите", field: null })
          : jsonResponse(204, ""),
      );
      const { scope, history } = await setupApiScope({ initialEntry: "/reset-password?token=abc&utm=mail", transport });

      render(
        <Provider value={scope}>
          <RouterProvider router={router}>
            <Routing />
          </RouterProvider>
        </Provider>,
      );

      const heading = await screen.findByRole("heading", { level: 1, name: "Новый пароль" });

      expect(transport.mock.calls.map(([request]) => request)).toContainEqual(
        expect.objectContaining({ path: "/auth/password-reset/check", body: { token: "abc" } }),
      );
      expect(history.location.pathname).toBe("/reset-password");
      expect(history.location.search).toBe("?utm=mail");
      await waitFor(() => expect(heading).toHaveFocus());
      expect(screen.getByText("Придумай новый пароль для входа в DejaView")).toBeInTheDocument();
    });

    it.each([
      ["without a token", "/reset-password", undefined],
      ["with an empty token", "/reset-password?token=", undefined],
      ["with an expired link", "/reset-password?token=abc", "password_check_expired"],
    ])("%s shows the expired link screen", async (_, path, scenario) => {
      await setup({ path, scenario });

      const heading = await screen.findByRole("heading", { level: 1, name: "Срок действия ссылки истёк" });

      await waitFor(() => expect(heading).toHaveFocus());
      expect(screen.getByText("Ссылка действует 1 час и только один раз")).toBeInTheDocument();
      expect(screen.getByText("Запросите восстановление пароля повторно")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Запросить повторно" })).toHaveAttribute("href", "/forgot-password");
      expect(screen.getByRole("link", { name: "Вернуться ко входу" })).toHaveAttribute("href", "/login");
    });

    it("a server error offers a retry", async () => {
      await setup({ scenario: "password_check_server_error" });

      expect(await screen.findByRole("alert")).toHaveTextContent("Произошла ошибка. Попробуйте позже");
      expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
    });
  });

  describe("form", () => {
    it("the eye button toggles visibility with aria-pressed and keeps focus and caret in the field", async () => {
      const { user } = await openForm();

      await user.type(password(), VALID);
      password().setSelectionRange(3, 3);

      const toggle = within(password().parentElement as HTMLElement).getByRole("button", { name: "Показать пароль" });

      expect(toggle).toHaveAttribute("aria-pressed", "false");

      await user.click(toggle);

      expect(password()).toHaveAttribute("type", "text");
      expect(toggle).toHaveAttribute("aria-pressed", "true");
      expect(password()).toHaveFocus();
      expect(password().selectionStart).toBe(3);
    });

    it("the checklist is neutral, turns green while typing and red after blur", async () => {
      const { user } = await openForm();

      expect(checklist()).toEqual(["neutral", "neutral", "neutral", "neutral"]);
      expect(password().getAttribute("aria-describedby")).toBeTruthy();

      await user.type(password(), "Kino#");

      expect(checklist()).toEqual(["neutral", "passed", "neutral", "passed"]);

      await user.tab();

      expect(checklist()).toEqual(["failed", "passed", "failed", "passed"]);
      expect(password()).toHaveAttribute("aria-invalid", "true");
      expect(document.querySelector("[aria-live=polite]")).toHaveTextContent(
        "Пароль должен содержать не менее 8 символов",
      );
      expect(
        screen.queryByText("Пароль должен содержать не менее 8 символов", { selector: "span" }),
      ).not.toBeInTheDocument();
    });

    it("accepts a pasted password longer than 128 characters and marks the length rule", async () => {
      const { user } = await openForm();
      const long = `Aa1!${"x".repeat(125)}`;

      await user.click(password());
      await user.paste(long);
      await user.tab();

      expect(password()).toHaveValue(long);
      expect(checklist()[0]).toBe("failed");
    });

    it("an empty submission shows the text under the password and focuses it", async () => {
      const { user } = await openForm();

      await user.click(screen.getByRole("button", { name: "Сохранить пароль" }));

      const message = screen.getByText("Введите новый пароль", { selector: "span" }).closest("p");

      await waitFor(() => expect(password()).toHaveFocus());
      expect(password().getAttribute("aria-describedby")?.split(" ")).toContain(message?.id);
    });

    it("a mismatched confirmation is shown under the confirmation and focused", async () => {
      const { user } = await openForm();

      await user.type(password(), VALID);
      await user.type(confirmation(), "Kino#2027");
      await user.click(screen.getByRole("button", { name: "Сохранить пароль" }));

      expect(screen.getByText("Пароли не совпадают")).toBeInTheDocument();
      await waitFor(() => expect(confirmation()).toHaveFocus());
      expect(confirmation()).toHaveAttribute("aria-invalid", "true");
    });

    it("the same password as the current one is shown over the form and the values stay", async () => {
      const { user } = await openForm({ scenario: "password_complete_same_as_current" });

      await user.type(password(), VALID);
      await user.type(confirmation(), VALID);
      await user.click(screen.getByRole("button", { name: "Сохранить пароль" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Новый пароль должен отличаться от текущего");
      expect(password()).toHaveValue(VALID);
      expect(confirmation()).toHaveValue(VALID);
    });

    it("an expired link while saving shows the expired screen", async () => {
      const { user } = await openForm({ scenario: "password_complete_expired" });

      await user.type(password(), VALID);
      await user.type(confirmation(), VALID);
      await user.click(screen.getByRole("button", { name: "Сохранить пароль" }));

      expect(await screen.findByRole("heading", { name: "Срок действия ссылки истёк" })).toBeInTheDocument();
    });

    it.each(["password_complete_server_error", "password_complete_network_error"])(
      "%s shows the general error over the form",
      async (scenario) => {
        const { user } = await openForm({ scenario });

        await user.type(password(), VALID);
        await user.type(confirmation(), VALID);
        await user.click(screen.getByRole("button", { name: "Сохранить пароль" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("Произошла ошибка. Попробуйте позже");
        expect(password()).toHaveValue(VALID);
      },
    );
  });

  describe("success", () => {
    it("signs the user in, opens the home page with the avatar and shows the notification", async () => {
      const { scope, user } = await openForm();

      await user.type(password(), VALID);
      await user.type(confirmation(), VALID);
      await user.click(screen.getByRole("button", { name: "Сохранить пароль" }));

      await waitFor(() => expect(scope.getState(router.$path)).toBe("/"));
      expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
      expect(await screen.findByRole("button", { name: /Меню пользователя/ })).toBeInTheDocument();

      const toast = screen.getByText("Пароль успешно изменён").closest("[role=status]") as HTMLElement;

      expect(toast).not.toBeNull();

      await user.click(within(toast).getByRole("button", { name: "Закрыть" }));

      expect(screen.queryByText("Пароль успешно изменён")).not.toBeInTheDocument();
    });
  });
});
