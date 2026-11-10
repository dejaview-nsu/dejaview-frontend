import { invoke } from "@withease/factories";
import { fork, scopeBind } from "effector";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRequestPasswordResetFactory } from "@/features/request-password-reset";

import { type Transport, transportFx } from "@/shared/api";
import { TransportError } from "@/shared/api/transport/errors";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";

const $$request = invoke(createRequestPasswordResetFactory);

const ERROR = "Произошла ошибка. Попробуйте позже";

const accepted = async () => jsonResponse(202, "");

const setup = (transport: Transport = accepted) => {
  const spy = vi.fn<Transport>(transport);
  const scope = fork({ handlers: [[transportFx, spy]] });
  const change = scopeBind($$request.inputs.changed, { scope });
  const blur = scopeBind($$request.inputs.blurred, { scope });
  const submit = scopeBind($$request.inputs.submitted, { scope });
  const resend = scopeBind($$request.inputs.resendPressed, { scope });
  const reset = scopeBind($$request.inputs.reset, { scope });
  const state = () => ({
    value: scope.getState($$request.outputs.$value),
    fieldError: scope.getState($$request.outputs.$fieldError),
    formError: scope.getState($$request.outputs.$formError),
    sent: scope.getState($$request.outputs.$isSent),
    pending: scope.getState($$request.outputs.$pending),
  });
  const requests = () => spy.mock.calls.map(([request]) => request);
  const settle = () => vi.advanceTimersByTimeAsync(0);

  return { scope, spy, change, blur, submit, resend, reset, state, requests, settle };
};

const seconds = (value: number) => vi.advanceTimersByTimeAsync(value * 1000);

describe("request password reset model", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("validation", () => {
    it("shows no error before blur or submit", () => {
      const { change, state } = setup();

      change("неверно");

      expect(state().fieldError).toBeNull();
    });

    it("an empty field after blur asks for a login", () => {
      const { blur, state } = setup();

      blur();

      expect(state().fieldError).toEqual({ message: "Введите имя пользователя или email" });
    });

    it.each(["an", "anna k", "anna@", "@mail.ru", "анна"])("%j has an invalid format", (value) => {
      const { change, blur, state } = setup();

      change(value);
      blur();

      expect(state().fieldError).toEqual({ message: "Введите корректные имя пользователя или email" });
    });

    it("an invalid value is not sent and requests focus on the field", async () => {
      const { change, submit, scope, requests, settle } = setup();

      change("   ");
      submit();
      await settle();

      expect(requests()).toEqual([]);
      expect(scope.getState($$request.outputs.$focusRequest)).toEqual({ id: 1 });

      submit();

      expect(scope.getState($$request.outputs.$focusRequest)).toEqual({ id: 2 });
    });

    it("sends the value trimmed at the edges", async () => {
      const { change, submit, requests, settle } = setup();

      change("  anna@mail.ru \t");
      submit();
      await settle();

      expect(requests()).toEqual([
        expect.objectContaining({
          method: "POST",
          path: "/auth/password-reset/request",
          body: { login: "anna@mail.ru" },
        }),
      ]);
    });
  });

  describe("sending", () => {
    it.each(["anna_k", "anna@mail.ru", "nobody@example.test"])(
      "202 for %s leads to the same sent state",
      async (login) => {
        const { change, submit, state, settle } = setup();

        change(login);
        submit();
        await settle();

        expect(state()).toEqual({ value: login, fieldError: null, formError: null, sent: true, pending: false });
      },
    );

    it("blocks a repeated submission while the request is pending", async () => {
      const controlled = createControlledTransport();
      const { change, submit, state, settle } = setup(controlled.transport);

      change("anna_k");
      submit();
      await settle();

      expect(state().pending).toBe(true);

      submit();
      submit();
      await settle();

      expect(controlled.calls).toHaveLength(1);

      controlled.current().resolve(jsonResponse(202, ""));
      await settle();

      expect(state().sent).toBe(true);
    });

    it.each([
      ["500", async () => jsonResponse(500, { code: "INTERNAL_ERROR", message: "Сервер упал", field: null })],
      ["502 from nginx", async () => jsonResponse(502, "<html>Bad Gateway</html>")],
      ["429", async () => jsonResponse(429, { code: "RATE_LIMITED", message: "Слишком много", field: null })],
      ["no network", async () => Promise.reject(new TransportError("network"))],
      ["timeout", async () => Promise.reject(new TransportError("timeout"))],
      ["an unexpected status", async () => jsonResponse(418, "")],
    ])("%s shows the general error over the form and keeps the value", async (_, transport) => {
      const { change, submit, state, settle } = setup(transport as Transport);

      change("anna@mail.ru");
      submit();
      await settle();

      expect(state()).toEqual({
        value: "anna@mail.ru",
        fieldError: null,
        formError: ERROR,
        sent: false,
        pending: false,
      });
    });

    it("400 for the login field marks the field with the client text, not the server text", async () => {
      const { change, submit, state, scope, settle } = setup(async () =>
        jsonResponse(400, { code: "AUTH_VALIDATION_ERROR", message: "Текст сервера", field: "login" }),
      );

      change("anna_k");
      submit();
      await settle();

      expect(state().fieldError).toEqual({ message: "Введите корректные имя пользователя или email" });
      expect(state().formError).toBeNull();
      expect(scope.getState($$request.outputs.$focusRequest)).toEqual({ id: 1 });
    });

    it("a new submission clears the previous error", async () => {
      let fail = true;
      const { change, submit, state, settle } = setup(async () =>
        fail ? jsonResponse(500, { code: "INTERNAL_ERROR", message: "x", field: null }) : jsonResponse(202, ""),
      );

      change("anna_k");
      submit();
      await settle();

      expect(state().formError).toBe(ERROR);

      fail = false;
      submit();
      await settle();

      expect(state().formError).toBeNull();
      expect(state().sent).toBe(true);
    });
  });

  describe("cancellation", () => {
    it("reset aborts the request and ignores its late response", async () => {
      const controlled = createControlledTransport({ ignoreAbort: true });
      const { change, submit, reset, state, settle } = setup(controlled.transport);

      change("anna_k");
      submit();
      await settle();

      reset();

      expect(controlled.current().request.signal?.aborted).toBe(true);

      controlled.current().resolve(jsonResponse(202, ""));
      await settle();

      expect(state()).toEqual({ value: "", fieldError: null, formError: null, sent: false, pending: false });
    });

    it("a late failure after reset does not show an error", async () => {
      const controlled = createControlledTransport({ ignoreAbort: true });
      const { change, submit, reset, state, settle } = setup(controlled.transport);

      change("anna_k");
      submit();
      await settle();
      reset();

      controlled.current().resolve(jsonResponse(500, { code: "INTERNAL_ERROR", message: "x", field: null }));
      await settle();

      expect(state().formError).toBeNull();
    });
  });

  describe("requesting the link again", () => {
    it("is available after 60 seconds and resends the same login", async () => {
      const { change, submit, resend, scope, requests, settle } = setup();

      change(" anna_k ");
      submit();
      await settle();

      expect(scope.getState($$request.outputs.$countdown)).toBe("1:00");
      expect(scope.getState($$request.outputs.$canResend)).toBe(false);

      resend();
      await seconds(59);

      expect(requests()).toHaveLength(1);
      expect(scope.getState($$request.outputs.$countdown)).toBe("0:01");

      await seconds(1);

      expect(scope.getState($$request.outputs.$canResend)).toBe(true);

      change("someone_else");
      resend();
      await settle();

      expect(requests()).toHaveLength(2);
      expect(requests()[1]).toEqual(expect.objectContaining({ body: { login: "anna_k" } }));
      expect(scope.getState($$request.outputs.$countdown)).toBe("1:00");
    });

    it("a failed resend keeps the sent screen and shows the general error", async () => {
      let fail = false;
      const { change, submit, resend, state, settle } = setup(async () =>
        fail ? Promise.reject(new TransportError("network")) : jsonResponse(202, ""),
      );

      change("anna_k");
      submit();
      await settle();
      await seconds(60);

      fail = true;
      resend();
      await settle();

      expect(state().sent).toBe(true);
      expect(state().formError).toBe(ERROR);
    });

    it("submitting the form again is ignored on the sent screen", async () => {
      const { change, submit, requests, settle } = setup();

      change("anna_k");
      submit();
      await settle();
      submit();
      await settle();

      expect(requests()).toHaveLength(1);
    });
  });
});
