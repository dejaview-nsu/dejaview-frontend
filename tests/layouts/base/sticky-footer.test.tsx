import { RouterProvider } from "@effector/router-react";
import { render, screen } from "@testing-library/react";
import { Provider } from "effector-react";
import { describe, expect, it } from "vitest";

import { AuthShell } from "@/layouts/auth";
import { BaseLayout } from "@/layouts/base";

import { router } from "@/shared/routes";

import { setupSessionScope } from "../../session-scope";

describe("footer stays at the bottom of registration pages", () => {
  it.each(["/register", "/confirm-email?token=abc", "/auth/oidc?provider=google&result=account_blocked"])(
    "%s: the page is a full-height column, main stretches and the footer is last",
    async (path) => {
      const { scope } = await setupSessionScope({ initialEntry: path, transport: async () => new Promise(() => {}) });

      const { container } = render(
        <Provider value={scope}>
          <RouterProvider router={router}>
            <BaseLayout>
              <AuthShell>
                <p>Короткий контент</p>
              </AuthShell>
            </BaseLayout>
          </RouterProvider>
        </Provider>,
      );

      const page = container.firstElementChild as HTMLElement;
      const main = screen.getByRole("main");
      const footer = screen.getByRole("contentinfo");

      expect(page).toHaveClass("flex", "min-h-dvh", "flex-col");
      expect(main).toHaveClass("flex", "flex-1", "flex-col");
      expect(screen.getByTestId("auth-shell")).toHaveClass("flex-1", "bg-card");
      expect(page.lastElementChild).toBe(footer);
      expect(main.nextElementSibling).toBe(footer);
    },
  );
});
