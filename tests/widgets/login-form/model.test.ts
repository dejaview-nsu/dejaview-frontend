import { invoke } from "@withease/factories";
import { allSettled, createEvent, createStore, fork, sample, scopeBind } from "effector";
import { describe, expect, it, vi } from "vitest";

import { createLoginFormFactory } from "@/widgets/login-form";

import { createSessionFactory } from "@/entities/session/model/session";

import { transportFx } from "@/shared/api";
import { TransportError } from "@/shared/api/transport/errors";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";
import { sessionInfo } from "../../session-scope";

const setup = async (ignoreAbort = false) => {
  const session = invoke(createSessionFactory);
  const activeChanged = createEvent<boolean>();
  const $active = createStore(true);

  sample({ clock: activeChanged, target: $active });

  const form = invoke(createLoginFormFactory, { session, $active });
  const transport = createControlledTransport({ ignoreAbort });
  const scope = fork({ handlers: [[transportFx, transport.transport]] });

  scopeBind(session.inputs.sessionCheckRequested, { scope })();
  await transport.waitForCalls(1);
  transport.current().resolve(jsonResponse(401, { code: "SESSION_REQUIRED", message: "Войдите" }));
  await allSettled(scope);

  const fill = async (login = "movie_fan_42", password = "Kino#2026") => {
    await allSettled(form.inputs.fieldChanged, { scope, params: { field: "login", value: login } });
    await allSettled(form.inputs.fieldChanged, { scope, params: { field: "password", value: password } });
  };

  const submit = scopeBind(form.inputs.submitted, { scope });

  return { session, form, scope, transport, fill, submit, activeChanged };
};

describe("login form model", () => {
  it("validates blur and submission without sending invalid data", async () => {
    const { form, scope, transport } = await setup();
    expect(scope.getState(form.outputs.$errors)).toEqual({ login: null, password: null });

    await allSettled(form.inputs.fieldBlurred, { scope, params: "login" });
    expect(scope.getState(form.outputs.$errors).login?.message).toBe("Введите имя пользователя или email");

    await allSettled(form.inputs.fieldChanged, { scope, params: { field: "login", value: "невалидно" } });
    await allSettled(form.inputs.submitted, { scope });

    expect(scope.getState(form.outputs.$errors)).toEqual({
      login: { message: "Введите корректные имя пользователя или email" },
      password: { message: "Введите пароль" },
    });
    expect(scope.getState(form.outputs.$focusRequest)?.field).toBe("login");
    expect(transport.calls).toHaveLength(1);
  });

  it.each(["movie_fan_42", "fan@example.test"])(
    "sends %s and stays pending through the session check",
    async (login) => {
      const { form, session, scope, transport, fill, submit } = await setup();
      await fill(` ${login} `, " x ");
      submit();
      await transport.waitForCalls(2);

      expect(transport.current().request.body).toEqual({ login, password: " x " });
      expect(scope.getState(form.outputs.$pending)).toBe(true);

      transport.current().resolve(jsonResponse(200, sessionInfo));
      await transport.waitForCalls(3);
      expect(transport.current().request.path).toBe("/auth/session");
      expect(scope.getState(form.outputs.$pending)).toBe(true);
      submit();

      transport.current().resolve(jsonResponse(200, sessionInfo));
      await allSettled(scope);
      expect(transport.calls).toHaveLength(3);
      expect(scope.getState(session.outputs.$status)).toBe("authenticated");
      expect(scope.getState(form.outputs.$pending)).toBe(false);
    },
  );

  it.each([
    [400, "AUTH_INVALID_CREDENTIALS", "movie_fan_42", "Неверные имя пользователя или пароль"],
    [400, "AUTH_INVALID_CREDENTIALS", "fan@example.test", "Неверные email или пароль"],
    [403, "AUTH_ACCOUNT_BLOCKED", "movie_fan_42", "Ваша учётная запись заблокирована. Обратитесь в службу поддержки"],
    [500, "INTERNAL_ERROR", "movie_fan_42", "Произошла ошибка. Попробуйте позже"],
  ])("%s %s clears only the password and permits retry", async (status, code, login, message) => {
    const { form, scope, transport, fill, submit } = await setup();
    await fill(String(login));
    submit();
    await transport.waitForCalls(2);
    transport
      .current()
      .resolve(
        jsonResponse(
          Number(status),
          { code, message: "Серверная ошибка", captcha_required: false },
          { "Retry-After": "781" },
        ),
      );
    await allSettled(scope);

    expect(scope.getState(form.outputs.$values)).toEqual({ login, password: "" });
    expect(scope.getState(form.outputs.$messages)).toEqual([message]);
    expect(scope.getState(form.outputs.$errors).password).toBeNull();

    await fill(String(login));
    submit();
    await transport.waitForCalls(3);
    expect(scope.getState(form.outputs.$messages)).toEqual([]);
    transport.current().reject(new TransportError("network"));
    await allSettled(scope);
    expect(scope.getState(form.outputs.$messages)[0]).toContain("Проверьте подключение");
  });

  it("disables editing and requests until Retry-After expires, then permits retry", async () => {
    const { form, scope, transport, fill, submit, activeChanged } = await setup();
    vi.useFakeTimers();
    try {
      await fill();
      submit();
      await transport.waitForCalls(2);
      transport
        .current()
        .resolve(jsonResponse(429, { code: "AUTH_LOGIN_LOCKED", message: "Заблокировано" }, { "Retry-After": "61" }));
      await vi.waitFor(() => expect(scope.getState(form.outputs.$locked)).toBe(true));
      expect(scope.getState(form.outputs.$messages)).toEqual(["Слишком много попыток входа. Повторите через 2 минут"]);
      scopeBind(form.inputs.fieldChanged, { scope })({ field: "login", value: "changed_user" });
      scopeBind(form.inputs.fieldChanged, { scope })({ field: "password", value: "changed password" });
      submit();
      expect(transport.calls).toHaveLength(2);
      expect(scope.getState(form.outputs.$values)).toEqual({ login: "movie_fan_42", password: "" });

      await vi.advanceTimersByTimeAsync(1000);
      expect(scope.getState(form.outputs.$messages)).toEqual(["Слишком много попыток входа. Повторите через 1 минут"]);
      await vi.advanceTimersByTimeAsync(60000);
      expect(scope.getState(form.outputs.$locked)).toBe(false);
      expect(scope.getState(form.outputs.$messages)).toEqual([]);
      await fill();
      submit();
      await transport.waitForCalls(3);
      scopeBind(activeChanged, { scope })(false);
      await allSettled(scope);
    } finally {
      scopeBind(activeChanged, { scope })(false);
      vi.useRealTimers();
    }
  });

  it("closing resets a lock timer and stale ticks cannot affect a new attempt", async () => {
    const { form, scope, transport, fill, submit, activeChanged } = await setup();
    vi.useFakeTimers();
    try {
      await fill();
      submit();
      await transport.waitForCalls(2);
      transport
        .current()
        .resolve(jsonResponse(429, { code: "AUTH_LOGIN_LOCKED", message: "Заблокировано" }, { "Retry-After": "900" }));
      await vi.waitFor(() => expect(scope.getState(form.outputs.$locked)).toBe(true));
      scopeBind(activeChanged, { scope })(false);
      expect(scope.getState(form.outputs.$locked)).toBe(false);
      expect(scope.getState(form.outputs.$messages)).toEqual([]);
      scopeBind(activeChanged, { scope })(true);
      await fill();
      submit();
      await transport.waitForCalls(3);
      await vi.advanceTimersByTimeAsync(2000);
      expect(scope.getState(form.outputs.$locked)).toBe(false);
      expect(scope.getState(form.outputs.$pending)).toBe(true);
      scopeBind(activeChanged, { scope })(false);
      await allSettled(scope);
    } finally {
      scopeBind(activeChanged, { scope })(false);
      vi.useRealTimers();
    }
  });

  it.each(["login", "session"] as const)(
    "closing during %s aborts the request and permits a new attempt",
    async (stage) => {
      const { form, session, scope, transport, fill, submit, activeChanged } = await setup();
      await fill();
      submit();
      await transport.waitForCalls(2);
      if (stage === "session") {
        transport.current().resolve(jsonResponse(200, sessionInfo));
        await transport.waitForCalls(3);
      }
      const cancelled = transport.current();
      const count = transport.calls.length;
      scopeBind(activeChanged, { scope })(false);
      await allSettled(scope);

      expect(cancelled.request.signal?.aborted).toBe(true);
      expect(scope.getState(form.outputs.$values)).toEqual({ login: "", password: "" });
      expect(scope.getState(form.outputs.$pending)).toBe(false);
      expect(scope.getState(session.outputs.$status)).toBe("guest");

      await allSettled(activeChanged, { scope, params: true });
      await fill();
      submit();
      await transport.waitForCalls(count + 1);
      transport.current().resolve(jsonResponse(200, sessionInfo));
      await transport.waitForCalls(count + 2);
      transport.current().resolve(jsonResponse(200, sessionInfo));
      await allSettled(scope);
      expect(scope.getState(session.outputs.$status)).toBe("authenticated");
    },
  );

  it.each(["login", "session"] as const)("a cancelled %s success cannot authenticate after close", async (stage) => {
    const { form, session, scope, transport, fill, submit, activeChanged } = await setup(true);
    await fill();
    submit();
    await transport.waitForCalls(2);
    if (stage === "session") {
      transport.current().resolve(jsonResponse(200, sessionInfo));
      await transport.waitForCalls(3);
    }
    const stale = transport.current();
    scopeBind(activeChanged, { scope })(false);
    expect(stale.request.signal?.aborted).toBe(true);
    stale.resolve(jsonResponse(200, sessionInfo));
    await allSettled(scope);

    expect(scope.getState(session.outputs.$status)).toBe("guest");
    expect(scope.getState(session.outputs.$user)).toBeNull();
    expect(scope.getState(form.outputs.$messages)).toEqual([]);
    expect(scope.getState(form.outputs.$pending)).toBe(false);
  });

  it("a late cancelled login error cannot overwrite a new attempt", async () => {
    const { form, session, scope, transport, fill, submit, activeChanged } = await setup(true);
    await fill();
    submit();
    await transport.waitForCalls(2);
    const stale = transport.current();
    scopeBind(activeChanged, { scope })(false);
    await vi.waitFor(() => expect(scope.getState(form.outputs.$pending)).toBe(false));
    scopeBind(activeChanged, { scope })(true);
    scopeBind(form.inputs.fieldChanged, { scope })({ field: "login", value: "second_user" });
    scopeBind(form.inputs.fieldChanged, { scope })({ field: "password", value: "other password" });
    submit();
    await transport.waitForCalls(3);
    stale.resolve(jsonResponse(401, { code: "SESSION_EXPIRED", message: "Старая ошибка" }));
    transport.current().resolve(jsonResponse(200, sessionInfo));
    await transport.waitForCalls(4);
    transport.current().resolve(jsonResponse(200, sessionInfo));
    await allSettled(scope);

    expect(scope.getState(session.outputs.$status)).toBe("authenticated");
    expect(scope.getState(form.outputs.$messages)).toEqual([]);
  });
});
