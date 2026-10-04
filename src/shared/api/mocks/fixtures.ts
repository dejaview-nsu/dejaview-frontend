import type { AuthLoginError, Error as ErrorBody, SearchResponse, SessionInfo } from "../generated";
import type { FileSearchMode } from "../search/modes";

export const FOUND_RESULTS = {
  image: {
    results: [
      {
        movie_id: 603,
        title: "Матрица",
        year: 1999,
        poster_url: "https://image.tmdb.org/t/p/w500/poster-603.jpg",
        overview: "Хакер Нео узнает, что мир вокруг - компьютерная симуляция.",
      },
    ],
  },
  video: {
    results: [
      {
        movie_id: 27205,
        title: "Начало",
        year: 2010,
        poster_url: "https://image.tmdb.org/t/p/w500/poster-27205.jpg",
        overview: "Кобб крадет идеи из снов, а теперь должен внедрить идею в чужое подсознание.",
      },
    ],
  },
} as const satisfies Record<FileSearchMode, SearchResponse>;

export const EMPTY_RESULTS = { results: [] } as const satisfies SearchResponse;

export const SESSION_USER = {
  username: "movie_fan_42",
  avatar_url: null,
  has_password: true,
} as const satisfies SessionInfo["user"];

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export const createSessionInfo = (): SessionInfo => ({
  user: { ...SESSION_USER },
  expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
});

const fileError = (code: string, message: string): ErrorBody => ({ code, message, field: "file" });

export const FILE_ERRORS = {
  image: {
    FILE_REQUIRED: fileError("FILE_REQUIRED", "Невозможно выполнить поиск по изображению: изображение не загружено"),
    TOO_MANY_FILES: fileError(
      "TOO_MANY_FILES",
      "Невозможно выполнить поиск по изображению: загружено больше одного файла",
    ),
    UNSUPPORTED_FORMAT: fileError(
      "UNSUPPORTED_FORMAT",
      "Невозможно выполнить поиск по изображению: поддерживаются только JPG, JPEG, PNG и WEBP",
    ),
    FILE_TOO_LARGE: fileError("FILE_TOO_LARGE", "Невозможно выполнить поиск по изображению: размер файла больше 10 МБ"),
    FILE_CORRUPTED: fileError(
      "FILE_CORRUPTED",
      "Невозможно выполнить поиск по изображению: файл поврежден или не может быть обработан",
    ),
  },
  video: {
    FILE_REQUIRED: fileError(
      "FILE_REQUIRED",
      "Невозможно выполнить поиск по видеофрагменту: видеофрагмент не загружен",
    ),
    TOO_MANY_FILES: fileError(
      "TOO_MANY_FILES",
      "Невозможно выполнить поиск по видеофрагменту: загружено больше одного файла",
    ),
    UNSUPPORTED_FORMAT: fileError(
      "UNSUPPORTED_FORMAT",
      "Невозможно выполнить поиск по видеофрагменту: поддерживаются только MP4, MOV и WEBM",
    ),
    FILE_TOO_LARGE: fileError(
      "FILE_TOO_LARGE",
      "Невозможно выполнить поиск по видеофрагменту: размер файла больше 50 МБ",
    ),
    VIDEO_TOO_LONG: fileError(
      "VIDEO_TOO_LONG",
      "Невозможно выполнить поиск по видеофрагменту: видео длиннее 30 секунд",
    ),
    FILE_CORRUPTED: fileError(
      "FILE_CORRUPTED",
      "Невозможно выполнить поиск по видеофрагменту: файл поврежден или не может быть обработан",
    ),
  },
} as const satisfies Record<FileSearchMode, Record<string, ErrorBody>>;

export const COMMON_ERRORS = {
  SEARCH_UNAVAILABLE: {
    code: "SEARCH_UNAVAILABLE",
    message: "Поиск временно недоступен. Попробуйте позже",
    field: null,
  },
  SERVER_BUSY: { code: "SERVER_BUSY", message: "Сервис перегружен. Попробуйте позже", field: null },
  SESSION_REQUIRED: { code: "SESSION_REQUIRED", message: "Войдите, чтобы продолжить", field: null },
  SESSION_EXPIRED: { code: "SESSION_EXPIRED", message: "Сессия истекла. Войдите снова", field: null },
  RATE_LIMITED: { code: "RATE_LIMITED", message: "Слишком много запросов. Попробуйте позже", field: null },
  INTERNAL_ERROR: { code: "INTERNAL_ERROR", message: "Произошла ошибка. Попробуйте позже", field: null },
} as const satisfies Record<string, ErrorBody>;

export const RATE_LIMIT_RETRY_AFTER_SECONDS = 60;

export const LOGIN_LOCKED_RETRY_AFTER_SECONDS = 840;

export const LOGIN_ERRORS = {
  INVALID_CREDENTIALS: {
    status: 400,
    body: {
      code: "AUTH_INVALID_CREDENTIALS",
      message: "Неверные имя пользователя или пароль",
      field: null,
      captcha_required: false,
    },
  },
  CAPTCHA_REQUIRED: {
    status: 403,
    body: {
      code: "AUTH_CAPTCHA_REQUIRED",
      message: "Подтвердите, что вы не робот",
      field: "captcha_token",
      captcha_required: true,
    },
  },
  EMAIL_NOT_CONFIRMED: {
    status: 403,
    body: {
      code: "AUTH_EMAIL_NOT_CONFIRMED",
      message: "Email не подтверждён. Проверьте почту или запросите новую ссылку",
      field: null,
      captcha_required: false,
    },
  },
  LOGIN_LOCKED: {
    status: 429,
    body: {
      code: "AUTH_LOGIN_LOCKED",
      message: "Слишком много попыток входа. Повторите через 14 минут",
      field: null,
    },
  },
} as const satisfies Record<string, { status: number; body: AuthLoginError | ErrorBody }>;

export const NGINX_BAD_GATEWAY_HTML =
  "<html><head><title>502 Bad Gateway</title></head><body><center><h1>502 Bad Gateway</h1></center><hr><center>nginx</center></body></html>";
