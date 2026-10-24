import { RouterProvider } from "@effector/router-react";
import { act, render, screen } from "@testing-library/react";
import { Provider } from "effector-react";
import { describe, expect, it } from "vitest";

import { OidcCallbackPage } from "@/pages/oidc-callback";

import { MOCK_STORAGE_KEYS } from "@/shared/api/mocks";
import { router } from "@/shared/routes";

import { createTestMockStorage, setupMockApiScope } from "../../session-scope";

const setup = async (result: string, scenario: string) => {
  const storage = createTestMockStorage();

  storage.set(MOCK_STORAGE_KEYS.authScenario, scenario);

  const { scope } = await act(() =>
    setupMockApiScope({ initialEntry: `/auth/oidc?provider=google&result=${result}`, storage }),
  );

  render(
    <Provider value={scope}>
      <RouterProvider router={router}>
        <OidcCallbackPage />
      </RouterProvider>
    </Provider>,
  );

  return { scope };
};

const input = (label: string) => screen.getByLabelText(label, { selector: "input" });

describe("/auth/oidc on the mock transport", () => {
  it("oidc_pending_registration prefills the suggested username", async () => {
    await setup("registration_required", "oidc_pending_registration");

    expect(screen.getByRole("heading", { name: "Завершение регистрации" })).toBeInTheDocument();
    expect(input("Имя пользователя")).toHaveValue("ivan_petrov");
    expect(input("Год рождения")).toHaveValue("");
  });

  it("oidc_pending_link shows the email and the provider from the pending data", async () => {
    await setup("link_required", "oidc_pending_link");

    expect(
      screen.getByText("Учётная запись с email ivan@example.com уже существует. Войдите с паролем, чтобы привязать VK"),
    ).toBeInTheDocument();
    expect(input("Email")).toHaveValue("ivan@example.com");
  });
});
