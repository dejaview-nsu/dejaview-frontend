import { allSettled, fork } from "effector";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type FileSearchMode,
  isSearchUnavailableError,
  requestFx,
  type Transport,
  transportFx,
  zSearchResponse,
  zSessionInfo,
} from "@/shared/api";
import {
  createMockStorage,
  createMockTransport,
  MOCK_STORAGE_KEYS,
  type MockStorage,
  NO_MOCK_DELAYS,
} from "@/shared/api/mocks";

const MODE_PREFIX: Record<FileSearchMode, string> = {
  image: "Невозможно выполнить поиск по изображению: ",
  video: "Невозможно выполнить поиск по видеофрагменту: ",
};

const setup = (storage: MockStorage = createMockStorage(() => window.localStorage)) => ({
  storage,
  transport: createMockTransport({ storage, delays: NO_MOCK_DELAYS }),
});

const signIn = (storage: MockStorage) => storage.set(MOCK_STORAGE_KEYS.session, "authenticated");

const searchRequest = (mode: FileSearchMode, extra: Partial<Parameters<Transport>[0]> = {}) => {
  const body = new FormData();
  body.append("file", new File(["x".repeat(1024)], mode === "image" ? "frame.jpg" : "scene.mp4"));

  return {
    method: "POST" as const,
    path: `/search/${mode}`,
    body,
    timeouts: { upload: 1000, response: 1000 },
    ...extra,
  };
};

const search = async (mode: FileSearchMode, scenario?: string) => {
  const { storage, transport } = setup();

  signIn(storage);

  if (scenario) {
    storage.set(MOCK_STORAGE_KEYS.searchScenario, scenario);
  }

  const response = await transport(searchRequest(mode));

  return { response, body: response.bodyText ? JSON.parse(response.bodyText) : undefined, storage, transport };
};

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("search mocks", () => {
  it.each([
    ["image", "Матрица"],
    ["video", "Начало"],
  ] as const)("found in %s mode returns a movie from contract examples", async (mode, title) => {
    const { response, body } = await search(mode);

    expect(response.status).toBe(200);
    expect(zSearchResponse.parse(body).results[0].title).toBe(title);
  });

  it("empty returns no results", async () => {
    const { response, body } = await search("image", "empty");

    expect(response.status).toBe(200);
    expect(body).toEqual({ results: [] });
  });

  describe.each(["image", "video"] as const)("file errors in %s mode", (mode) => {
    it.each([
      ["FILE_REQUIRED", 400],
      ["TOO_MANY_FILES", 400],
      ["UNSUPPORTED_FORMAT", 415],
      ["FILE_TOO_LARGE", 413],
      ["FILE_CORRUPTED", 422],
    ])("%s → %i with text of the mode", async (scenario, status) => {
      const { response, body } = await search(mode, scenario);

      expect(response.status).toBe(status);
      expect(body).toMatchObject({ code: scenario, field: "file" });
      expect(body.message.startsWith(MODE_PREFIX[mode])).toBe(true);
    });
  });

  it("uses exact contract texts", async () => {
    expect((await search("image", "FILE_TOO_LARGE")).body.message).toBe(
      "Невозможно выполнить поиск по изображению: размер файла больше 10 МБ",
    );
    expect((await search("video", "FILE_TOO_LARGE")).body.message).toBe(
      "Невозможно выполнить поиск по видеофрагменту: размер файла больше 50 МБ",
    );
    expect((await search("video", "UNSUPPORTED_FORMAT")).body.message).toBe(
      "Невозможно выполнить поиск по видеофрагменту: поддерживаются только MP4, MOV и WEBM",
    );
  });

  it("VIDEO_TOO_LONG in video mode → 422", async () => {
    const { response, body } = await search("video", "VIDEO_TOO_LONG");

    expect(response.status).toBe(422);
    expect(body).toEqual({
      code: "VIDEO_TOO_LONG",
      message: "Невозможно выполнить поиск по видеофрагменту: видео длиннее 30 секунд",
      field: "file",
    });
  });

  it.each([
    ["SEARCH_UNAVAILABLE", 503, "Поиск временно недоступен. Попробуйте позже"],
    ["SERVER_BUSY", 503, "Сервис перегружен. Попробуйте позже"],
    ["SESSION_REQUIRED", 401, "Войдите, чтобы продолжить"],
    ["SESSION_EXPIRED", 401, "Сессия истекла. Войдите снова"],
    ["RATE_LIMITED", 429, "Слишком много запросов. Попробуйте позже"],
    ["INTERNAL_ERROR", 500, "Произошла ошибка. Попробуйте позже"],
  ])("%s → %i with Error body", async (scenario, status, message) => {
    const { response, body } = await search("video", scenario);

    expect(response.status).toBe(status);
    expect(body).toEqual({ code: scenario, message, field: null });
  });

  it("RATE_LIMITED has Retry-After", async () => {
    const { response } = await search("image", "RATE_LIMITED");

    expect(response.getHeader("Retry-After")).toBe("60");
  });

  it("NGINX_502 returns HTML that the client turns into SEARCH_UNAVAILABLE", async () => {
    const { storage, transport } = setup();
    signIn(storage);
    storage.set(MOCK_STORAGE_KEYS.searchScenario, "NGINX_502");

    const raw = await transport(searchRequest("image"));

    expect(raw.status).toBe(502);
    expect(raw.bodyText).toContain("502 Bad Gateway");

    const scope = fork({ handlers: [[transportFx, transport]] });
    const result = await allSettled(requestFx, {
      scope,
      params: { ...searchRequest("image"), schema: zSearchResponse, isSearch: true },
    });

    expect(result.status).toBe("fail");
    expect(isSearchUnavailableError(result.value)).toBe(true);
    expect(result.value).toMatchObject({
      code: "SEARCH_UNAVAILABLE",
      message: "Поиск временно недоступен. Попробуйте позже",
    });
  });

  it.each([
    ["NETWORK_ERROR", "network"],
    ["TIMEOUT", "timeout"],
  ])("%s rejects like a transport failure", async (scenario, kind) => {
    const { storage, transport } = setup();
    signIn(storage);
    storage.set(MOCK_STORAGE_KEYS.searchScenario, scenario);

    await expect(transport(searchRequest("video"))).rejects.toMatchObject({ name: "TransportError", kind });
  });

  it("SESSION_EXPIRED signs the user out", async () => {
    const { storage, transport } = await search("video", "SESSION_EXPIRED");

    expect(storage.get(MOCK_STORAGE_KEYS.session)).toBeNull();

    const session = await transport({ method: "GET", path: "/auth/session", timeouts: { response: 1000 } });

    expect(session.status).toBe(401);
  });

  it("search without session → 401 SESSION_REQUIRED", async () => {
    const { transport } = setup();

    const response = await transport(searchRequest("image"));

    expect(response.status).toBe(401);
    expect(JSON.parse(response.bodyText)).toMatchObject({ code: "SESSION_REQUIRED" });
  });

  it("unknown scenario warns and falls back to found", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { response, body } = await search("image", "SOMETHING_ELSE");

    expect(response.status).toBe(200);
    expect(body.results[0].title).toBe("Матрица");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("SOMETHING_ELSE"));
  });

  it("VIDEO_TOO_LONG in image mode warns and falls back to found", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const { response } = await search("image", "VIDEO_TOO_LONG");

    expect(response.status).toBe(200);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("reports upload progress up to 100% and upload end", async () => {
    const { storage, transport } = setup();
    const onUploadProgress = vi.fn();
    const onUploadComplete = vi.fn();
    signIn(storage);

    await transport(searchRequest("video", { onUploadProgress, onUploadComplete }));

    const fractions = onUploadProgress.mock.calls.map(([fraction]) => fraction);

    expect(fractions.length).toBeGreaterThan(1);
    expect(fractions.at(-1)).toBe(1);
    expect(onUploadComplete).toHaveBeenCalledTimes(1);
  });

  it("aborts during upload", async () => {
    const { storage, transport } = setup();
    const controller = new AbortController();
    signIn(storage);

    const promise = transport(searchRequest("video", { signal: controller.signal }));
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("session mocks", () => {
  const sessionRequest = { method: "GET" as const, path: "/auth/session", timeouts: { response: 1000 } };
  const loginRequest = {
    method: "POST" as const,
    path: "/auth/login",
    body: { login: "movie_fan_42", password: "Kino#2026" },
    timeouts: { response: 1000 },
  };
  const logoutRequest = { method: "POST" as const, path: "/auth/logout", timeouts: { response: 1000 } };

  it("guest gets 401 SESSION_REQUIRED", async () => {
    const { transport } = setup();

    const response = await transport(sessionRequest);

    expect(response.status).toBe(401);
    expect(JSON.parse(response.bodyText)).toMatchObject({ code: "SESSION_REQUIRED" });
  });

  it("login creates a session that survives reload", async () => {
    const { transport } = setup();

    const login = await transport(loginRequest);

    expect(login.status).toBe(200);
    expect(zSessionInfo.parse(JSON.parse(login.bodyText)).user.username).toBe("movie_fan_42");
    expect(window.localStorage.getItem(MOCK_STORAGE_KEYS.session)).toBe("authenticated");

    const afterReload = setup();
    const session = await afterReload.transport(sessionRequest);

    expect(session.status).toBe(200);
    expect(zSessionInfo.safeParse(JSON.parse(session.bodyText)).success).toBe(true);
  });

  it("logout ends the session", async () => {
    const { transport } = setup();

    await transport(loginRequest);
    const logout = await transport(logoutRequest);

    expect(logout.status).toBe(204);
    expect((await transport(sessionRequest)).status).toBe(401);
    expect((await transport(logoutRequest)).status).toBe(401);
  });

  it("works in memory when localStorage is unavailable", async () => {
    const storage = createMockStorage(() => {
      throw new DOMException("Access denied", "SecurityError");
    });
    const { transport } = setup(storage);

    expect((await transport(loginRequest)).status).toBe(200);
    expect((await transport(sessionRequest)).status).toBe(200);

    storage.set(MOCK_STORAGE_KEYS.searchScenario, "empty");
    expect(JSON.parse((await transport(searchRequest("image"))).bodyText)).toEqual({ results: [] });
  });
});

describe("unknown requests", () => {
  it("answer 404 and warn", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { transport } = setup();

    const response = await transport({ method: "GET", path: "/movies/603", timeouts: { response: 1000 } });

    expect(response.status).toBe(404);
    expect(JSON.parse(response.bodyText)).toMatchObject({ code: "MOCK_NOT_FOUND" });
    expect(warn).toHaveBeenCalledWith("Заглушки: нет заглушки для GET /movies/603");
  });
});
