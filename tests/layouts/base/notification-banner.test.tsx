import { act, fireEvent, render, screen } from "@testing-library/react";
import { allSettled, fork } from "effector";
import { Provider } from "effector-react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NotificationBanner } from "@/layouts/base/ui/notification-banner";

import { $$notifications, NOTIFICATION_TIMEOUT_MS, type NotificationTone } from "@/shared/lib/notifications";

const renderBanner = ({ contentWidth }: { contentWidth?: boolean } = {}) => {
  const scope = fork();

  render(
    <Provider value={scope}>
      <div style={{ position: "relative", height: "5000px" }}>
        <NotificationBanner contentWidth={contentWidth} />
      </div>
    </Provider>,
  );

  return scope;
};

afterEach(() => {
  vi.useRealTimers();
  window.scrollTo(0, 0);
});

describe("notification banner", () => {
  it("sticks 16 px from the top as a zero-height layer under the header", async () => {
    const scope = renderBanner();

    window.scrollY = 2000;
    fireEvent.scroll(window);

    await act(() =>
      allSettled($$notifications.inputs.shown, {
        scope,
        params: { text: "Email подтверждён. Добро пожаловать в DejaView!", tone: "success" },
      }),
    );

    const row = screen.getByRole("status").parentElement;
    const layer = row?.parentElement;

    expect(layer).toHaveClass("pointer-events-none", "sticky", "top-4", "z-40", "h-0", "px-4", "md:px-12");
    expect(layer).toHaveClass("mt-2", "-mb-2", "md:mt-4", "md:-mb-4");
    expect(layer).not.toHaveClass("fixed", "absolute");
    expect(row).toHaveClass("mx-auto", "max-w-results");
    expect(row).toHaveClass("justify-center", "md:justify-end");
    expect(screen.getByRole("status")).toHaveClass("pointer-events-auto", "w-full", "md:w-auto");
  });

  it("aligns with the content width header on the movie and profile pages", async () => {
    const scope = renderBanner({ contentWidth: true });

    await act(() =>
      allSettled($$notifications.inputs.shown, { scope, params: { text: "Скоро будет готово", tone: "info" } }),
    );

    const row = screen.getByRole("status").parentElement;

    expect(row).toHaveClass("max-w-content");
    expect(row?.parentElement).toHaveClass("md:px-8");
  });

  it.each([
    ["success", "status", "Пароль успешно изменён", "bg-success-bg"],
    ["error", "alert", "Произошла ошибка. Попробуйте позже", "bg-error-bg"],
    ["info", "status", "Скоро будет готово", "bg-card"],
  ] as const)("shows the %s tone", async (tone: NotificationTone, role, text, style) => {
    const scope = renderBanner();

    await act(() => allSettled($$notifications.inputs.shown, { scope, params: { text, tone } }));

    expect(screen.getByRole(role)).toHaveTextContent(text);
    expect(screen.getByRole(role)).toHaveClass(style);
  });

  it("closes by the button and by the timer", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const scope = renderBanner();

    await act(() =>
      allSettled($$notifications.inputs.shown, { scope, params: { text: "Скоро будет готово", tone: "info" } }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    await act(() => allSettled(scope));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await act(() =>
      allSettled($$notifications.inputs.shown, { scope, params: { text: "Скоро будет готово", tone: "info" } }),
    );
    await act(() => vi.advanceTimersByTimeAsync(NOTIFICATION_TIMEOUT_MS));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
