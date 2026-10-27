import { invoke } from "@withease/factories";
import { allSettled, fork, scopeBind } from "effector";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createResendConfirmationFactory, formatCountdown } from "@/features/resend-confirmation";

import { type Transport, transportFx } from "@/shared/api";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";

const $$resend = invoke(createResendConfirmationFactory);

const setup = (transport: Transport = async () => jsonResponse(202, { resend_after: 60 })) => {
  const spy = vi.fn<Transport>(transport);
  const scope = fork({ handlers: [[transportFx, spy]] });
  const start = scopeBind($$resend.inputs.started, { scope });
  const press = scopeBind($$resend.inputs.resendPressed, { scope });
  const state = () => ({
    countdown: scope.getState($$resend.outputs.$countdown),
    canResend: scope.getState($$resend.outputs.$canResend),
    error: scope.getState($$resend.outputs.$error),
  });
  const requests = () => spy.mock.calls.map(([request]) => request);

  return { scope, start, press, state, requests };
};

const seconds = (value: number) => vi.advanceTimersByTimeAsync(value * 1000);

describe("resend confirmation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats the countdown as in the mockup", () => {
    expect(formatCountdown(60)).toBe("1:00");
    expect(formatCountdown(45)).toBe("0:45");
    expect(formatCountdown(5)).toBe("0:05");
  });

  it("counts down from resend_after and enables the button at zero", async () => {
    const { start, state, scope } = setup();

    start({ request: { login: "anna@mail.ru" }, resendAfter: 60 });

    expect(state()).toEqual({ countdown: "1:00", canResend: false, error: null });

    await seconds(15);

    expect(state().countdown).toBe("0:45");
    expect(state().canResend).toBe(false);

    await seconds(44);

    expect(state().countdown).toBe("0:01");

    await seconds(1);

    expect(state()).toEqual({ countdown: null, canResend: true, error: null });

    await seconds(5);

    expect(scope.getState($$resend.outputs.$secondsLeft)).toBe(0);
  });

  it("ignores presses while the timer runs", async () => {
    const { start, press, requests } = setup();

    start({ request: { login: "anna@mail.ru" }, resendAfter: 60 });
    await seconds(30);
    press();
    await seconds(1);

    expect(requests()).toHaveLength(0);
  });

  it("202 sends the email as login and restarts the timer from resend_after", async () => {
    const { start, press, state, requests } = setup(async () => jsonResponse(202, { resend_after: 42 }));

    start({ request: { login: "anna@mail.ru" }, resendAfter: 60 });
    await seconds(60);
    press();
    await vi.waitFor(() => expect(state().countdown).toBe("0:42"));

    expect(requests()).toEqual([
      expect.objectContaining({ method: "POST", path: "/auth/resend-confirmation", body: { login: "anna@mail.ru" } }),
    ]);
    expect(state().canResend).toBe(false);

    await seconds(42);

    expect(state().canResend).toBe(true);
  });

  it.each([
    [400, "AUTH_VALIDATION_ERROR", "Введите корректные имя пользователя или email", "login"],
    [429, "RATE_LIMITED", "Слишком много запросов. Попробуйте позже", null],
    [500, "INTERNAL_ERROR", "Произошла ошибка. Попробуйте позже", null],
  ])("%i %s shows the server message and does not restart the timer", async (status, code, message, field) => {
    const { start, press, state, scope } = setup(async () => jsonResponse(status, { code, message, field }));

    start({ request: { login: "anna@mail.ru" }, resendAfter: 1 });
    await seconds(1);
    press();
    await vi.waitFor(() => expect(state().error).toBe(message));

    expect(scope.getState($$resend.outputs.$secondsLeft)).toBe(0);
    expect(state().countdown).toBeNull();
    expect(state().canResend).toBe(true);
  });

  it("a new attempt clears the previous error", async () => {
    const responses = [
      jsonResponse(500, { code: "INTERNAL_ERROR", message: "Произошла ошибка. Попробуйте позже", field: null }),
      jsonResponse(202, { resend_after: 60 }),
    ];
    const { start, press, state } = setup(async () => responses.shift()!);

    start({ request: { login: "anna@mail.ru" }, resendAfter: 0 });
    press();
    await vi.waitFor(() => expect(state().error).not.toBeNull());
    press();
    await vi.waitFor(() => expect(state().countdown).toBe("1:00"));

    expect(state().error).toBeNull();
  });

  it("sends only one request while the previous one runs", async () => {
    const held = createControlledTransport();
    const { start, press, state, requests } = setup(held.transport);

    start({ request: { login: "anna@mail.ru" }, resendAfter: 0 });
    press();
    await held.waitForCalls(1);

    expect(state().canResend).toBe(false);

    press();
    press();
    await seconds(1);

    expect(requests()).toHaveLength(1);

    held.current().resolve(jsonResponse(202, { resend_after: 60 }));
    await vi.waitFor(() => expect(state().countdown).toBe("1:00"));

    expect(requests()).toHaveLength(1);
  });

  it("reset stops the timer and forgets the request", async () => {
    const { scope, start, press, state, requests } = setup();

    start({ request: { login: "anna@mail.ru" }, resendAfter: 60 });
    await seconds(10);
    await allSettled($$resend.inputs.reset, { scope });

    expect(state()).toEqual({ countdown: null, canResend: false, error: null });

    await seconds(60);
    press();
    await seconds(1);

    expect(state().countdown).toBeNull();
    expect(requests()).toHaveLength(0);
  });

  it.each([202, 500])("reset cancels resend and ignores its late %s response after restart", async (status) => {
    const held = createControlledTransport({ ignoreAbort: true });
    const { scope, start, press, state } = setup(held.transport);

    start({ request: { login: "first@example.test" }, resendAfter: 0 });
    press();
    await held.waitForCalls(1);
    const stale = held.current();

    scopeBind($$resend.inputs.reset, { scope })();
    expect(stale.request.signal?.aborted).toBe(true);
    await vi.waitFor(() => expect(scope.getState($$resend.outputs.$pending)).toBe(false));
    start({ request: { login: "second@example.test" }, resendAfter: 0 });
    press();
    await held.waitForCalls(2);
    expect(held.current().request.body).toEqual({ login: "second@example.test" });

    stale.resolve(
      jsonResponse(
        status,
        status === 202 ? { resend_after: 60 } : { code: "INTERNAL_ERROR", message: "Старая ошибка" },
      ),
    );
    held.current().resolve(jsonResponse(202, { resend_after: 42 }));
    await vi.waitFor(() => expect(state().countdown).toBe("0:42"));

    expect(state().error).toBeNull();
    await allSettled($$resend.inputs.reset, { scope });
  });
});
