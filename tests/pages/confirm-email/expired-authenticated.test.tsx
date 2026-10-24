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

describe("/confirm-email with an already used link", () => {
  it("410 for a signed-in user opens the home page without the expired screen", async () => {
    const { scope } = await setup("session_user,confirm_expired");

    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
    expect(scope.getState(router.$path)).toBe("/");
    expect(screen.queryByText("Срок действия ссылки истёк")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Отправить новую ссылку" })).not.toBeInTheDocument();
  });

  it("410 for a guest shows the expired screen with the resend button", async () => {
    const { scope } = await setup("session_guest,confirm_expired");

    expect(scope.getState($$session.outputs.$status)).toBe("guest");
    expect(scope.getState(router.$path)).toBe("/confirm-email");
    expect(screen.getByRole("heading", { name: "Срок действия ссылки истёк" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Отправить новую ссылку" })).toBeEnabled();
  });

  it("200 still opens the home page with the notification", async () => {
    const { scope } = await setup("session_guest,confirm_ok");

    expect(scope.getState(router.$path)).toBe("/");
    expect(scope.getState($$session.outputs.$status)).toBe("authenticated");
    expect(screen.getByText("Email подтверждён. Добро пожаловать в DejaView!")).toBeInTheDocument();
  });
});
