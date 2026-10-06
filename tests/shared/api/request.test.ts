import { allSettled, fork } from "effector";
import { describe, expect, it, vi } from "vitest";

import {
  ApiError,
  type ApiRequest,
  requestFx,
  transportFx,
  type TransportResponse,
  zNoContent,
  zSessionInfo,
} from "@/shared/api";

import { sendApiRequestFx } from "../../api-request";

const response = (status: number, body: unknown): TransportResponse => ({
  status,
  bodyText: typeof body === "string" ? body : JSON.stringify(body),
  getHeader: () => null,
});

const sessionInfo = {
  user: { username: "movie_fan_42", avatar_url: null, has_password: true },
  expires_at: "2026-09-28T12:00:00Z",
};

const run = async (transportResponse: TransportResponse, schema: ApiRequest<unknown>["schema"] = zSessionInfo) => {
  const transport = vi.fn(async () => transportResponse);
  const scope = fork({ handlers: [[transportFx, transport]] });
  const result = await allSettled(sendApiRequestFx, {
    scope,
    params: { method: "GET", path: "/auth/session", schema },
  });

  return { result, transport };
};

describe("requestFx", () => {
  it("returns status and parsed JSON body without schema validation", async () => {
    const scope = fork({ handlers: [[transportFx, async () => response(200, { user: null })]] });
    const result = await allSettled(requestFx, { scope, params: { method: "GET", path: "/auth/session" } });

    expect(result).toEqual({ status: "done", value: { status: 200, body: { user: null } } });
  });
});

describe("sendApiRequest", () => {
  it("passes request to transport with default JSON timeout", async () => {
    const { transport } = await run(response(200, sessionInfo));

    expect(transport).toHaveBeenCalledWith({ method: "GET", path: "/auth/session", timeouts: { response: 10_000 } });
  });

  it("returns body validated by generated schema", async () => {
    const { result } = await run(response(200, sessionInfo));

    expect(result).toEqual({ status: "done", value: sessionInfo });
  });

  it("returns undefined for responses without content", async () => {
    const { result } = await run(response(204, ""), zNoContent);

    expect(result).toEqual({ status: "done", value: undefined });
  });

  it("rejects body that does not match schema with INVALID_RESPONSE", async () => {
    const { result } = await run(response(200, { user: null }));

    expect(result.status).toBe("fail");
    expect(result.value).toBeInstanceOf(ApiError);
    expect(result.value).toMatchObject({ status: 200, code: "INVALID_RESPONSE" });
  });

  it("rejects error status with ApiError from body", async () => {
    const { result } = await run(
      response(401, { code: "SESSION_EXPIRED", message: "Сессия истекла. Войдите снова", field: null }),
    );

    expect(result.value).toBeInstanceOf(ApiError);
    expect(result.value).toMatchObject({
      status: 401,
      code: "SESSION_EXPIRED",
      message: "Сессия истекла. Войдите снова",
      field: null,
    });
  });

  it("keeps the whole error body in details", async () => {
    const body = { code: "AUTH_INVALID_CREDENTIALS", message: "Неверные имя пользователя или пароль", field: null };
    const { result } = await run(response(400, { ...body, captcha_required: true }));

    expect(result.value).toMatchObject({ details: { ...body, captcha_required: true } });
  });
});
