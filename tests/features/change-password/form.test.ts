import { invoke } from "@withease/factories";
import { allSettled, createEffect, createStore, fork, sample, scopeBind } from "effector";
import { describe, expect, it, vi } from "vitest";

import { createChangePasswordFactory } from "@/features/change-password";

import { transportFx } from "@/shared/api";
import { TransportError } from "@/shared/api/transport/errors";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";

const GENERAL = "Произошла ошибка. Попробуйте позже";

const setup = ({ hasPassword = true, ignoreAbort = false } = {}) => {
  const $$model = invoke(createChangePasswordFactory, { $hasPassword: createStore(hasPassword) });
  const transport = createControlledTransport({ ignoreAbort });
  const succeeded = vi.fn();
  const succeededFx = createEffect(succeeded);

  sample({ clock: $$model.outputs.succeeded, target: succeededFx });

  const scope = fork({ handlers: [[transportFx, transport.transport]] });

  const fill = async (values: { current?: string; password?: string; confirmation?: string }) => {
    for (const [field, value] of Object.entries(values))
      await allSettled($$model.inputs.fieldChanged, {
        scope,
        params: { field: field as "current" | "password" | "confirmation", value },
      });
  };

  const openAndFill = async (values = { current: "Kino#2026", password: "Kino#2027", confirmation: "Kino#2027" }) => {
    await allSettled($$model.inputs.opened, { scope });
    await fill(values);
  };

  return { $$model, scope, transport, succeeded, fill, openAndFill };
};

const errorBody = (code: string, message: string, field: string | null = null) => ({ code, message, field });

describe("change password form", () => {
  it("opens with empty fields and asks for the current password when the account has one", async () => {
    const { $$model, scope } = setup();

    await allSettled($$model.inputs.opened, { scope });

    expect(scope.getState($$model.outputs.$isOpen)).toBe(true);
    expect(scope.getState($$model.outputs.$requiresCurrent)).toBe(true);
    expect(scope.getState($$model.outputs.$values)).toEqual({ current: "", password: "", confirmation: "" });
  });

  it("validates the fields before sending", async () => {
    const { $$model, scope, transport, fill } = setup();

    await allSettled($$model.inputs.opened, { scope });
    await fill({ password: "short", confirmation: "other" });
    await allSettled($$model.inputs.submitted, { scope });

    expect(transport.calls).toHaveLength(0);
    expect(scope.getState($$model.outputs.$errors)).toEqual({
      current: { message: "Введите текущий пароль" },
      password: { message: null },
      confirmation: { message: "Пароли не совпадают" },
    });
    expect(scope.getState($$model.outputs.$checks).map(({ state }) => state)).toEqual([
      "failed",
      "failed",
      "failed",
      "failed",
    ]);
    expect(scope.getState($$model.outputs.$focusRequest)?.field).toBe("current");
  });

  it("asks for a new password when it is empty", async () => {
    const { $$model, scope, fill } = setup();

    await allSettled($$model.inputs.opened, { scope });
    await fill({ current: "Kino#2026" });
    await allSettled($$model.inputs.submitted, { scope });

    expect(scope.getState($$model.outputs.$errors).password).toEqual({ message: "Введите новый пароль" });
  });

  it("sends the current and the new password and reports success", async () => {
    const { $$model, scope, transport, succeeded, openAndFill } = setup();

    await openAndFill();
    const submitting = allSettled($$model.inputs.submitted, { scope });
    await transport.waitForCalls(1);

    expect(transport.current().request).toMatchObject({
      method: "PUT",
      path: "/users/me/password",
      body: { current_password: "Kino#2026", new_password: "Kino#2027" },
    });
    expect(scope.getState($$model.outputs.$pending)).toBe(true);

    transport.current().resolve(jsonResponse(204, ""));
    await submitting;

    expect(succeeded).toHaveBeenCalledOnce();
    expect(scope.getState($$model.outputs.$isOpen)).toBe(false);
    expect(scope.getState($$model.outputs.$isSucceeded)).toBe(true);
    expect(scope.getState($$model.outputs.$pending)).toBe(false);
    expect(scope.getState($$model.outputs.$values)).toEqual({ current: "", password: "", confirmation: "" });
  });

  it("sets a password without the current one when the account has no password", async () => {
    const { $$model, scope, transport, fill } = setup({ hasPassword: false });

    await allSettled($$model.inputs.opened, { scope });
    await fill({ password: "Kino#2027", confirmation: "Kino#2027" });
    const submitting = allSettled($$model.inputs.submitted, { scope });
    await transport.waitForCalls(1);

    expect(scope.getState($$model.outputs.$requiresCurrent)).toBe(false);
    expect(scope.getState($$model.outputs.$errors).current).toBeNull();
    expect(transport.current().request.body).toEqual({ new_password: "Kino#2027" });

    transport.current().resolve(jsonResponse(204, ""));
    await submitting;

    expect(scope.getState($$model.outputs.$isSucceeded)).toBe(true);
  });

  it.each([
    [
      "AUTH_CURRENT_PASSWORD_INVALID",
      400,
      errorBody("AUTH_CURRENT_PASSWORD_INVALID", "Неверный текущий пароль", "current_password"),
      "Неверный текущий пароль",
    ],
    [
      "AUTH_PASSWORD_SAME_AS_CURRENT",
      400,
      errorBody("AUTH_PASSWORD_SAME_AS_CURRENT", "Новый пароль должен отличаться от текущего", "new_password"),
      "Новый пароль должен отличаться от текущего",
    ],
    ["INVALID_PARAMETER", 400, errorBody("INVALID_PARAMETER", "Некорректный запрос"), GENERAL],
    ["RATE_LIMITED", 429, errorBody("RATE_LIMITED", "Слишком много запросов. Попробуйте позже"), GENERAL],
    ["INTERNAL_ERROR", 500, errorBody("INTERNAL_ERROR", GENERAL), GENERAL],
    ["SERVICE_UNAVAILABLE", 503, "<html>", GENERAL],
    ["INVALID_RESPONSE", 418, "<html>", GENERAL],
  ])("shows %s above the form and keeps the entered values", async (_, status, body, message) => {
    const { $$model, scope, transport, succeeded, openAndFill } = setup();

    await openAndFill();
    const submitting = allSettled($$model.inputs.submitted, { scope });
    await transport.waitForCalls(1);
    transport.current().resolve(jsonResponse(status, body));
    await submitting;

    expect(scope.getState($$model.outputs.$formError)).toBe(message);
    expect(scope.getState($$model.outputs.$isOpen)).toBe(true);
    expect(scope.getState($$model.outputs.$pending)).toBe(false);
    expect(scope.getState($$model.outputs.$values)).toEqual({
      current: "Kino#2026",
      password: "Kino#2027",
      confirmation: "Kino#2027",
    });
    expect(succeeded).not.toHaveBeenCalled();
  });

  it.each(["network", "timeout"] as const)("shows the general error for a %s failure", async (kind) => {
    const { $$model, scope, transport, openAndFill } = setup();

    await openAndFill();
    const submitting = allSettled($$model.inputs.submitted, { scope });
    await transport.waitForCalls(1);
    transport.current().reject(new TransportError(kind));
    await submitting;

    expect(scope.getState($$model.outputs.$formError)).toBe(GENERAL);
  });

  it.each([
    ["current_password", "current", "Введите текущий пароль"],
    ["new_password", "password", "Пароль должен содержать не менее 8 символов"],
  ] as const)("shows a server validation error for %s under the field", async (serverField, field, message) => {
    const { $$model, scope, transport, openAndFill, fill } = setup();

    await openAndFill();
    const submitting = allSettled($$model.inputs.submitted, { scope });
    await transport.waitForCalls(1);
    transport.current().resolve(jsonResponse(400, errorBody("AUTH_VALIDATION_ERROR", message, serverField)));
    await submitting;

    expect(scope.getState($$model.outputs.$formError)).toBeNull();
    expect(scope.getState($$model.outputs.$errors)[field]).toEqual({ message });
    expect(scope.getState($$model.outputs.$focusRequest)?.field).toBe(field);

    await fill({ [field]: "Kino#2028" });

    expect(scope.getState($$model.outputs.$errors)[field]).toBeNull();
  });

  it("does not show an error above the form when the session expires", async () => {
    const { $$model, scope, transport, openAndFill } = setup();

    await openAndFill();
    const submitting = allSettled($$model.inputs.submitted, { scope });
    await transport.waitForCalls(1);
    transport.current().resolve(jsonResponse(401, errorBody("SESSION_EXPIRED", "Сессия истекла. Войдите снова")));
    await submitting;

    expect(scope.getState($$model.outputs.$formError)).toBeNull();
  });

  it("lets the user retry after an error", async () => {
    const { $$model, scope, transport, succeeded, openAndFill } = setup();

    await openAndFill();
    const first = allSettled($$model.inputs.submitted, { scope });
    await transport.waitForCalls(1);
    transport.current().resolve(jsonResponse(500, errorBody("INTERNAL_ERROR", GENERAL)));
    await first;

    const second = allSettled($$model.inputs.submitted, { scope });
    await transport.waitForCalls(2);

    expect(scope.getState($$model.outputs.$formError)).toBeNull();

    transport.current().resolve(jsonResponse(204, ""));
    await second;

    expect(succeeded).toHaveBeenCalledOnce();
  });

  it("ignores a repeated submit while saving", async () => {
    const { $$model, scope, transport, openAndFill } = setup();

    await openAndFill();
    const first = allSettled($$model.inputs.submitted, { scope });
    await transport.waitForCalls(1);
    scopeBind($$model.inputs.submitted, { scope })();
    await Promise.resolve();

    expect(transport.calls).toHaveLength(1);

    transport.current().resolve(jsonResponse(204, ""));
    await first;
  });

  it("cancels the request and closes the form on cancel", async () => {
    const { $$model, scope, transport, succeeded, openAndFill } = setup();

    await openAndFill();
    void allSettled($$model.inputs.submitted, { scope });
    await transport.waitForCalls(1);
    const signal = transport.current().request.signal;

    await allSettled($$model.inputs.cancelled, { scope });

    await vi.waitFor(() => expect(signal?.aborted).toBe(true));
    expect(scope.getState($$model.outputs.$isOpen)).toBe(false);
    expect(scope.getState($$model.outputs.$pending)).toBe(false);
    expect(scope.getState($$model.outputs.$values)).toEqual({ current: "", password: "", confirmation: "" });
    expect(succeeded).not.toHaveBeenCalled();
  });

  it("ignores a late response after the form was closed and opened again", async () => {
    const { $$model, scope, transport, succeeded, openAndFill } = setup({ ignoreAbort: true });

    await openAndFill();
    void allSettled($$model.inputs.submitted, { scope });
    await transport.waitForCalls(1);
    const late = transport.current();

    scopeBind($$model.inputs.cancelled, { scope })();
    scopeBind($$model.inputs.opened, { scope })();

    late.resolve(jsonResponse(400, errorBody("AUTH_CURRENT_PASSWORD_INVALID", "Неверный текущий пароль")));
    await allSettled(scope);

    expect(scope.getState($$model.outputs.$isOpen)).toBe(true);
    expect(scope.getState($$model.outputs.$formError)).toBeNull();
    expect(scope.getState($$model.outputs.$isSucceeded)).toBe(false);
    expect(succeeded).not.toHaveBeenCalled();
  });

  it("clears the success message on reset and when the form opens again", async () => {
    const { $$model, scope, transport, openAndFill } = setup();

    await openAndFill();
    const submitting = allSettled($$model.inputs.submitted, { scope });
    await transport.waitForCalls(1);
    transport.current().resolve(jsonResponse(204, ""));
    await submitting;

    await allSettled($$model.inputs.opened, { scope });

    expect(scope.getState($$model.outputs.$isSucceeded)).toBe(false);

    await allSettled($$model.inputs.reset, { scope });

    expect(scope.getState($$model.outputs.$isOpen)).toBe(false);
  });
});
