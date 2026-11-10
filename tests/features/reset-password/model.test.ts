import { invoke } from "@withease/factories";
import { createWatch, fork, scopeBind } from "effector";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createResetPasswordFactory } from "@/features/reset-password";

import { type Transport, transportFx, type TransportRequest, type TransportResponse } from "@/shared/api";
import { TransportError } from "@/shared/api/transport/errors";

import { createControlledTransport, jsonResponse } from "../../controlled-transport";
import { sessionInfo } from "../../session-scope";

const $$reset = invoke(createResetPasswordFactory);

const VALID = "Kino#2026";
const ERROR = "Произошла ошибка. Попробуйте позже";

const expired = () =>
  jsonResponse(410, { code: "AUTH_RESET_LINK_EXPIRED", message: "Срок действия ссылки истёк", field: null });

type Replies = {
  check?: (request: TransportRequest) => Promise<TransportResponse>;
  complete?: (request: TransportRequest) => Promise<TransportResponse>;
};

const routeTransport =
  ({ check = async () => jsonResponse(204, ""), complete = async () => jsonResponse(200, sessionInfo) }: Replies) =>
  (request: TransportRequest) =>
    request.path === "/auth/password-reset/check" ? check(request) : complete(request);

const setup = (transport: Transport = routeTransport({})) => {
  const spy = vi.fn<Transport>(transport);
  const scope = fork({ handlers: [[transportFx, spy]] });
  const completed = vi.fn();

  createWatch({ unit: $$reset.outputs.completed, fn: completed, scope });

  const receive = scopeBind($$reset.inputs.tokenReceived, { scope });
  const change = scopeBind($$reset.inputs.fieldChanged, { scope });
  const blur = scopeBind($$reset.inputs.fieldBlurred, { scope });
  const submit = scopeBind($$reset.inputs.submitted, { scope });
  const retry = scopeBind($$reset.inputs.retryPressed, { scope });
  const reset = scopeBind($$reset.inputs.reset, { scope });
  const settle = () => vi.advanceTimersByTimeAsync(0);
  const screen = () => scope.getState($$reset.outputs.$screen);
  const requests = (path: string) => spy.mock.calls.map(([request]) => request).filter((r) => r.path === path);
  const fill = (password: string, confirmation = password) => {
    change({ field: "password", value: password });
    change({ field: "confirmation", value: confirmation });
  };
  const openForm = async () => {
    receive("token-1");
    await settle();
  };

  return { scope, completed, receive, change, blur, submit, retry, reset, settle, screen, requests, fill, openForm };
};

describe("reset password model", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("link check", () => {
    it("a valid link shows the form", async () => {
      const { receive, screen, requests, settle } = setup();

      receive("token-1");

      expect(screen()).toBe("checking");

      await settle();

      expect(screen()).toBe("form");
      expect(requests("/auth/password-reset/check")).toEqual([
        expect.objectContaining({ method: "POST", body: { token: "token-1" } }),
      ]);
    });

    it("410 shows the expired link screen", async () => {
      const { receive, screen, settle } = setup(routeTransport({ check: async () => expired() }));

      receive("token-1");
      await settle();

      expect(screen()).toBe("expired");
    });

    it("without a token shows the expired link screen and sends nothing", async () => {
      const { receive, screen, requests, settle } = setup();

      receive(null);
      await settle();

      expect(screen()).toBe("expired");
      expect(requests("/auth/password-reset/check")).toEqual([]);
    });

    it("a network error offers a retry that checks the same token again", async () => {
      let fail = true;
      const { receive, retry, screen, requests, settle } = setup(
        routeTransport({
          check: async () => (fail ? Promise.reject(new TransportError("network")) : jsonResponse(204, "")),
        }),
      );

      receive("token-1");
      await settle();

      expect(screen()).toBe("failed");

      fail = false;
      retry();
      await settle();

      expect(screen()).toBe("form");
      expect(requests("/auth/password-reset/check")).toHaveLength(2);
    });

    it("a new token aborts the previous check and ignores its late answer", async () => {
      const controlled = createControlledTransport({ ignoreAbort: true });
      const { receive, screen, settle } = setup(controlled.transport);

      receive("old");
      await settle();
      receive("new");
      await settle();

      expect(controlled.calls[0].request.signal?.aborted).toBe(true);

      controlled.calls[1].resolve(jsonResponse(204, ""));
      await settle();
      controlled.calls[0].resolve(expired());
      await settle();

      expect(screen()).toBe("form");
    });

    it("reset aborts the check and ignores its late answer", async () => {
      const controlled = createControlledTransport({ ignoreAbort: true });
      const { receive, reset, screen, settle } = setup(controlled.transport);

      receive("token-1");
      await settle();
      reset();
      controlled.current().resolve(expired());
      await settle();

      expect(controlled.current().request.signal?.aborted).toBe(true);
      expect(screen()).toBe("checking");
    });
  });

  describe("form validation", () => {
    it("shows the empty password error under the field and focuses it", async () => {
      const { openForm, submit, scope, requests, settle } = setup();

      await openForm();
      submit();
      await settle();

      expect(scope.getState($$reset.outputs.$errors)).toEqual({
        password: { message: "Введите новый пароль" },
        confirmation: null,
      });
      expect(scope.getState($$reset.outputs.$focusRequest)).toEqual({ field: "password", id: 1 });
      expect(requests("/auth/password-reset/complete")).toEqual([]);
    });

    it("a weak password marks the field without text and reveals failed checklist items", async () => {
      const { openForm, fill, blur, scope } = setup();

      await openForm();
      fill("Kino#2");

      expect(scope.getState($$reset.outputs.$checks).map(({ state }) => state)).toEqual([
        "neutral",
        "passed",
        "passed",
        "passed",
      ]);

      blur("password");

      expect(scope.getState($$reset.outputs.$errors).password).toEqual({ message: null });
      expect(scope.getState($$reset.outputs.$checks).map(({ state }) => state)).toEqual([
        "failed",
        "passed",
        "passed",
        "passed",
      ]);
    });

    it("a mismatched confirmation is reported under the confirmation and focused first when the password is valid", async () => {
      const { openForm, fill, submit, scope, settle } = setup();

      await openForm();
      fill(VALID, "Kino#2027");
      submit();
      await settle();

      expect(scope.getState($$reset.outputs.$errors)).toEqual({
        password: null,
        confirmation: { message: "Пароли не совпадают" },
      });
      expect(scope.getState($$reset.outputs.$focusRequest)?.field).toBe("confirmation");
    });

    it("focuses the password when both fields are invalid", async () => {
      const { openForm, fill, submit, scope, settle } = setup();

      await openForm();
      fill("short", "other");
      submit();
      await settle();

      expect(scope.getState($$reset.outputs.$focusRequest)?.field).toBe("password");
    });

    it.each([
      [7, false],
      [8, true],
      [128, true],
      [129, false],
    ])("a password of %i characters is sent: %s", async (length, sent) => {
      const { openForm, fill, submit, requests, settle } = setup();
      const password = `Aa1!${"x".repeat(length - 4)}`;

      await openForm();
      fill(password);
      submit();
      await settle();

      expect(requests("/auth/password-reset/complete")).toHaveLength(sent ? 1 : 0);
    });

    it("announces the rules after a pause in typing, on blur and on submit, not on every character", async () => {
      const { openForm, change, blur, submit, scope, settle } = setup();
      const announcement = () => scope.getState($$reset.outputs.$announcement);

      await openForm();
      change({ field: "password", value: "K" });
      change({ field: "password", value: "Ki" });
      await vi.advanceTimersByTimeAsync(500);

      expect(announcement()).toBe("");

      change({ field: "password", value: "Kin" });
      await vi.advanceTimersByTimeAsync(1000);

      expect(announcement()).toBe(
        "Пароль должен содержать не менее 8 символов. Пароль должен содержать хотя бы одну заглавную букву, одну строчную букву, одну цифру и один специальный символ",
      );

      change({ field: "password", value: "Kino#2026" });
      blur("password");

      expect(announcement()).toBe("Все требования к паролю выполнены");

      change({ field: "password", value: "" });
      submit();
      await settle();

      expect(announcement()).toBe("Введите новый пароль");
    });
  });

  describe("saving", () => {
    it("sends the token and the new password and reports completion with the session", async () => {
      const { openForm, fill, submit, completed, requests, settle } = setup();

      await openForm();
      fill(VALID);
      submit();
      await settle();

      expect(requests("/auth/password-reset/complete")).toEqual([
        expect.objectContaining({ method: "POST", body: { token: "token-1", new_password: VALID } }),
      ]);
      expect(completed).toHaveBeenCalledExactlyOnceWith(sessionInfo);
    });

    it("blocks a repeated submission while saving", async () => {
      const controlled = createControlledTransport();
      const { receive, fill, submit, scope, settle } = setup(controlled.transport);

      receive("token-1");
      await settle();
      controlled.current().resolve(jsonResponse(204, ""));
      await settle();

      fill(VALID);
      submit();
      await settle();

      expect(scope.getState($$reset.outputs.$pending)).toBe(true);

      submit();
      await settle();

      expect(controlled.calls).toHaveLength(2);
    });

    it("410 switches to the expired link screen", async () => {
      const { openForm, fill, submit, screen, settle } = setup(routeTransport({ complete: async () => expired() }));

      await openForm();
      fill(VALID);
      submit();
      await settle();

      expect(screen()).toBe("expired");
    });

    it("the same password as the current one is shown over the form and the values stay", async () => {
      const { openForm, fill, submit, scope, screen, completed, settle } = setup(
        routeTransport({
          complete: async () =>
            jsonResponse(400, {
              code: "AUTH_PASSWORD_SAME_AS_CURRENT",
              message: "Текст сервера",
              field: "new_password",
            }),
        }),
      );

      await openForm();
      fill(VALID);
      submit();
      await settle();

      expect(screen()).toBe("form");
      expect(scope.getState($$reset.outputs.$formError)).toBe("Новый пароль должен отличаться от текущего");
      expect(scope.getState($$reset.outputs.$values)).toEqual({ password: VALID, confirmation: VALID });
      expect(completed).not.toHaveBeenCalled();
    });

    it.each([
      ["500", async () => jsonResponse(500, { code: "INTERNAL_ERROR", message: "x", field: null })],
      ["429", async () => jsonResponse(429, { code: "RATE_LIMITED", message: "x", field: null })],
      [
        "another 400",
        async () => jsonResponse(400, { code: "AUTH_VALIDATION_ERROR", message: "x", field: "new_password" }),
      ],
      ["no network", async () => Promise.reject(new TransportError("network"))],
      ["an invalid response", async () => jsonResponse(200, { user: null })],
    ])("%s shows the general error over the form", async (_, complete) => {
      const { openForm, fill, submit, scope, completed, settle } = setup(routeTransport({ complete }));

      await openForm();
      fill(VALID);
      submit();
      await settle();

      expect(scope.getState($$reset.outputs.$formError)).toBe(ERROR);
      expect(scope.getState($$reset.outputs.$values).password).toBe(VALID);
      expect(completed).not.toHaveBeenCalled();
    });

    it("reset aborts saving and ignores a late success", async () => {
      const controlled = createControlledTransport({ ignoreAbort: true });
      const { receive, fill, submit, reset, completed, settle } = setup(controlled.transport);

      receive("token-1");
      await settle();
      controlled.current().resolve(jsonResponse(204, ""));
      await settle();
      fill(VALID);
      submit();
      await settle();

      reset();
      controlled.current().resolve(jsonResponse(200, sessionInfo));
      await settle();

      expect(controlled.current().request.signal?.aborted).toBe(true);
      expect(completed).not.toHaveBeenCalled();
    });
  });
});
