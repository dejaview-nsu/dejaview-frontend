import { RouterProvider } from "@effector/router-react";
import { act, render, screen } from "@testing-library/react";
import { Provider } from "effector-react";
import { describe, expect, it } from "vitest";

import { ConfirmEmailPage } from "@/pages/confirm-email";

import { BaseLayout } from "@/layouts/base";

import { $$session } from "@/entities/session";

import { MOCK_STORAGE_KEYS } from "@/shared/api/mocks";
import { router } from "@/shared/routes";

import { createTestMockStorage, setupMockApiScope } from "../../session-scope";

const setup = async (scenario: string) => {
  const storage = createTestMockStorage();

  storage.set(MOCK_STORAGE_KEYS.authScenario, scenario);

  const result = await act(() => setupMockApiScope({ initialEntry: "/confirm-email?token=abc", storage }));

  render(
    <Provider value={result.scope}>
      <RouterProvider router={router}>
        <BaseLayout>
          <ConfirmEmailPage />
        </BaseLayout>
      </RouterProvider>
    </Provider>,
  );

  return result;
};

describe("/confirm-email on the mock transport", () => {
  it("confirm_ok signs the user in and shows the notification on the home page", async () => {
    const { scope, storage } = await setup("confirm_ok");

    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
    expect(storage.get(MOCK_STORAGE_KEYS.session)).toBe("authenticated");
    expect(screen.getByText("Email подтверждён. Добро пожаловать в DejaView!")).toBeInTheDocument();
  });

  it("confirm_expired shows the expired link screen", async () => {
    const { scope } = await setup("confirm_expired");

    expect(scope.getState(router.$path)).toBe("/confirm-email");
    expect(screen.getByRole("heading", { name: "Срок действия ссылки истёк" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Отправить новую ссылку" })).toBeEnabled();
  });
});
