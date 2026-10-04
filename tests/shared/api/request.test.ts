import { allSettled, fork } from "effector";
import { describe, expect, it, vi } from "vitest";

import { ApiError, requestFx, transportFx, type TransportResponse, zSessionInfo } from "@/shared/api";

const response = (status: number, body: unknown): TransportResponse => ({
  status,
  bodyText: typeof body === "string" ? body : JSON.stringify(body),
  getHeader: () => null,
});

const sessionInfo = {
  user: { username: "movie_fan_42", avatar_url: null, has_password: true },
  expires_at: "2026-09-28T12:00:00Z",
};

const run = async (transportResponse: TransportResponse, schema: typeof zSessionInfo | null = zSessionInfo) => {
  const transport = vi.fn(async () => transportResponse);
  const scope = fork({ handlers: [[transportFx, transport]] });
  const result = await allSettled(requestFx, { scope, params: { method: "GET", path: "/auth/session", schema } });

  return { result, transport };
};

describe("requestFx", () => {
  it("passes request to transport with default JSON timeout", async () => {
    const { transport } = await run(response(200, sessionInfo));

    expect(transport).toHaveBeenCalledWith({ method: "GET", path: "/auth/session", timeouts: { response: 10_000 } });
  });

  it("returns body validated by generated schema", async () => {
    const { result } = await run(response(200, sessionInfo));

    expect(result).toEqual({ status: "done", value: sessionInfo });
  });

  it("returns undefined for responses without schema", async () => {
    const { result } = await run(response(204, ""), null);

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
});
