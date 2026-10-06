import { allSettled, createEffect, fork } from "effector";
import { describe, expect, it } from "vitest";

import {
  ApiError,
  isAbortError,
  isLoginLockedError,
  isNetworkError,
  isRateLimitError,
  isSearchUnavailableError,
  isSessionError,
  isTimeoutError,
  searchByFile,
  transportFx,
  type TransportResponse,
  zSearchResponse,
} from "@/shared/api";
import { createAbortError, TransportError } from "@/shared/api/transport/errors";

import { sendApiRequestFx } from "../../api-request";

const NGINX_HTML = "<html><body><h1>502 Bad Gateway</h1></body></html>";

const response = (status: number, body: unknown, headers: Record<string, string> = {}): TransportResponse => ({
  status,
  bodyText: typeof body === "string" ? body : JSON.stringify(body),
  getHeader: (name) => headers[name] ?? null,
});

const failWith = async (transport: () => Promise<TransportResponse>, { isSearch = false } = {}) => {
  const scope = fork({ handlers: [[transportFx, transport]] });
  const result = await allSettled(sendApiRequestFx, {
    scope,
    params: { method: "POST", path: "/search/image", schema: zSearchResponse, isSearch },
  });

  expect(result.status).toBe("fail");

  return result.value;
};

const failWithResponse = (raw: TransportResponse, options?: { isSearch?: boolean }) =>
  failWith(async () => raw, options);

describe("API errors from JSON body", () => {
  it("keeps server message and field as is", async () => {
    const body = {
      code: "FILE_CORRUPTED",
      message: "Невозможно выполнить поиск по изображению: файл поврежден или не может быть обработан",
      field: "file",
    };

    const error = await failWithResponse(response(422, body), { isSearch: true });

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, ...body, retryAfter: null });
  });

  it("treats missing field as null", async () => {
    const error = await failWithResponse(
      response(500, { code: "INTERNAL_ERROR", message: "Произошла ошибка. Попробуйте позже" }),
    );

    expect(error).toMatchObject({ status: 500, code: "INTERNAL_ERROR", field: null });
  });

  it.each(["SESSION_REQUIRED", "SESSION_EXPIRED"])("401 %s is a session error", async (code) => {
    const error = await failWithResponse(response(401, { code, message: "Сообщение сервера", field: null }));

    expect(error).toMatchObject({ status: 401, code, message: "Сообщение сервера" });
    expect(isSessionError(error)).toBe(true);
  });

  it("429 AUTH_LOGIN_LOCKED keeps Retry-After in seconds", async () => {
    const error = await failWithResponse(
      response(
        429,
        { code: "AUTH_LOGIN_LOCKED", message: "Слишком много попыток входа. Повторите через 14 минут", field: null },
        { "Retry-After": "840" },
      ),
    );

    expect(error).toMatchObject({ code: "AUTH_LOGIN_LOCKED", retryAfter: 840 });
    expect(isLoginLockedError(error)).toBe(true);
    expect(isRateLimitError(error)).toBe(false);
  });

  it("429 RATE_LIMITED from contract is a general rate limit", async () => {
    const error = await failWithResponse(
      response(
        429,
        { code: "RATE_LIMITED", message: "Слишком много запросов. Попробуйте позже" },
        { "Retry-After": "30" },
      ),
    );

    expect(error).toMatchObject({
      code: "RATE_LIMITED",
      message: "Слишком много запросов. Попробуйте позже",
      retryAfter: 30,
    });
    expect(isRateLimitError(error)).toBe(true);
    expect(isLoginLockedError(error)).toBe(false);
  });

  it("ignores Retry-After that is not a number of seconds", async () => {
    const error = await failWithResponse(response(429, "", { "Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT" }));

    expect(error).toMatchObject({ retryAfter: null });
  });

  it.each([
    ["SEARCH_UNAVAILABLE", "Поиск временно недоступен. Попробуйте позже"],
    ["SERVER_BUSY", "Сервис перегружен. Попробуйте позже"],
  ])("503 %s means search is unavailable", async (code, message) => {
    const error = await failWithResponse(response(503, { code, message }), { isSearch: true });

    expect(error).toMatchObject({ status: 503, code, message });
    expect(isSearchUnavailableError(error)).toBe(true);
  });
});

describe("API errors without valid JSON body", () => {
  it.each([
    [401, false, "SESSION_REQUIRED", "Войдите, чтобы продолжить"],
    [413, true, "FILE_TOO_LARGE", "Файл слишком большой"],
    [429, false, "RATE_LIMITED", "Слишком много запросов. Попробуйте позже"],
    [500, false, "INTERNAL_ERROR", "Произошла ошибка. Попробуйте позже"],
    [502, true, "SEARCH_UNAVAILABLE", "Поиск временно недоступен. Попробуйте позже"],
    [503, true, "SEARCH_UNAVAILABLE", "Поиск временно недоступен. Попробуйте позже"],
    [504, true, "SEARCH_UNAVAILABLE", "Поиск временно недоступен. Попробуйте позже"],
    [502, false, "SERVICE_UNAVAILABLE", "Сервис временно недоступен. Попробуйте позже"],
    [503, false, "SERVICE_UNAVAILABLE", "Сервис временно недоступен. Попробуйте позже"],
    [504, false, "SERVICE_UNAVAILABLE", "Сервис временно недоступен. Попробуйте позже"],
    [400, false, "INVALID_RESPONSE", "Произошла ошибка. Попробуйте позже"],
    [404, false, "INVALID_RESPONSE", "Произошла ошибка. Попробуйте позже"],
  ])("%i (search: %s) HTML from nginx → %s", async (status, isSearch, code, message) => {
    const error = await failWithResponse(response(status, NGINX_HTML), { isSearch });

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status, code, message, field: null });
  });

  it.each([
    ["image", "Невозможно выполнить поиск по изображению: размер файла больше 10 МБ"],
    ["video", "Невозможно выполнить поиск по видеофрагменту: размер файла больше 50 МБ"],
  ] as const)("413 HTML on %s search has the contract text of the mode", async (mode, message) => {
    const searchFx = createEffect(searchByFile);
    const scope = fork({ handlers: [[transportFx, async () => response(413, NGINX_HTML)]] });
    const file = new File(["x"], "file.bin");

    const result = await allSettled(searchFx, { scope, params: { mode, file } });

    expect(result.value).toBeInstanceOf(ApiError);
    expect(result.value).toMatchObject({ status: 413, code: "FILE_TOO_LARGE", message, field: null });
  });

  it("413 HTML outside search keeps the general text", async () => {
    const error = await failWithResponse(response(413, NGINX_HTML));

    expect(error).toMatchObject({ code: "FILE_TOO_LARGE", message: "Файл слишком большой" });
  });

  it("429 without body keeps Retry-After", async () => {
    const error = await failWithResponse(response(429, "", { "Retry-After": "60" }));

    expect(error).toMatchObject({ code: "RATE_LIMITED", retryAfter: 60 });
    expect(isRateLimitError(error)).toBe(true);
  });

  it("503 HTML on search is a search unavailable error", async () => {
    const error = await failWithResponse(response(503, NGINX_HTML), { isSearch: true });

    expect(isSearchUnavailableError(error)).toBe(true);
  });

  it("401 without body is a session error", async () => {
    const error = await failWithResponse(response(401, ""));

    expect(isSessionError(error)).toBe(true);
  });

  it.each([
    ["without message", { code: "SOMETHING" }],
    ["without code", { message: "Текст" }],
    ["of another shape", { error: "Bad Gateway" }],
    ["as array", []],
  ])("JSON body %s is handled like non-JSON", async (_name, body) => {
    const error = await failWithResponse(response(502, body), { isSearch: true });

    expect(error).toMatchObject({ code: "SEARCH_UNAVAILABLE", message: "Поиск временно недоступен. Попробуйте позже" });
  });

  it("success body that does not match schema is INVALID_RESPONSE", async () => {
    const error = await failWithResponse(response(200, "<html>ok</html>"), { isSearch: true });

    expect(error).toMatchObject({
      status: 200,
      code: "INVALID_RESPONSE",
      message: "Произошла ошибка. Попробуйте позже",
    });
  });
});

describe("transport failures", () => {
  it("network failure becomes NETWORK_ERROR with a clear text", async () => {
    const error = await failWith(async () => {
      throw new TransportError("network");
    });

    expect(error).toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
      message: "Не удалось связаться с сервером. Проверьте подключение к интернету и попробуйте ещё раз",
      field: null,
    });
    expect(isNetworkError(error)).toBe(true);
  });

  it("timeout becomes TIMEOUT with a clear text", async () => {
    const error = await failWith(async () => {
      throw new TransportError("timeout");
    });

    expect(error).toMatchObject({
      status: 0,
      code: "TIMEOUT",
      message: "Сервер слишком долго не отвечает. Попробуйте ещё раз",
    });
    expect(isTimeoutError(error)).toBe(true);
  });

  it("abort is not turned into ApiError", async () => {
    const error = await failWith(async () => {
      throw createAbortError();
    });

    expect(error).not.toBeInstanceOf(ApiError);
    expect(isAbortError(error)).toBe(true);
  });

  it("isAbortError is false for API errors", async () => {
    const error = await failWithResponse(response(500, NGINX_HTML));

    expect(isAbortError(error)).toBe(false);
  });
});
