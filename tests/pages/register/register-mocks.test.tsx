import { RouterProvider } from "@effector/router-react";
import { act, render, screen } from "@testing-library/react";
import { allSettled } from "effector";
import { Provider } from "effector-react";
import { describe, expect, it } from "vitest";

import { $$registerForm, RegisterPage } from "@/pages/register";

import { type RegisterField } from "@/features/register";

import { MOCK_STORAGE_KEYS } from "@/shared/api/mocks";
import { router } from "@/shared/routes";

import { createTestMockStorage, setupMockApiScope } from "../../session-scope";
import { userEventSetup } from "../../test-utils";

const filled: Record<RegisterField, string> = {
  username: "anna_k",
  email: "anna@mail.ru",
  birthYear: "2003",
  password: "Kino#2026",
  passwordConfirmation: "Kino#2026",
};

const setup = async (scenario: string) => {
  const storage = createTestMockStorage();

  storage.set(MOCK_STORAGE_KEYS.authScenario, scenario);

  const { scope } = await setupMockApiScope({ initialEntry: "/register", storage });

  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <RegisterPage />
      </RouterProvider>
    </Provider>,
  );

  for (const [field, value] of Object.entries(filled) as [RegisterField, string][]) {
    await act(() => allSettled($$registerForm.inputs.fieldChanged, { scope, params: { field, value } }));
  }

  await userEventSetup().click(screen.getByRole("button", { name: "Зарегистрироваться" }));

  return { scope };
};

describe("/register on the mock transport", () => {
  it("register_ok shows the check-email screen", async () => {
    const { scope } = await setup("register_ok");

    expect(await screen.findByRole("heading", { name: "Проверь почту" })).toBeInTheDocument();
    expect(screen.getByText("anna@mail.ru")).toBeInTheDocument();
    expect(scope.getState(router.$path)).toBe("/register");
  });

  it.each([
    ["register_username_taken", "Это имя пользователя уже занято", "Имя пользователя"],
    ["register_email_taken", "Пользователь с таким email уже существует", "Email"],
  ])("%s shows «%s» and highlights the field", async (scenario, text, label) => {
    await setup(scenario);

    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(screen.getByLabelText(label, { selector: "input" })).toHaveAttribute("aria-invalid", "true");
  });
});
