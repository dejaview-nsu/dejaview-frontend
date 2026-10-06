# API-клиент

Все запросы к backend DejaView идут через этот слой. Контракт — `dejaview-docs/api/openapi.yaml`, типы и zod-схемы из него лежат в `generated/` (команда `pnpm api:generate`, см. общий README).

## Как сделать запрос

Запросы оформляются операциями Farfetched, внутри handler вызывается `callApi`:

```ts
import { createQuery } from "@farfetched/core";

import { callApi, zSessionInfo } from "@/shared/api";

const sessionQuery = createQuery({
  name: "session.get",
  handler: () => callApi({ method: "GET", path: "/auth/session", schema: zSessionInfo, onUnauthorized: "guest" }),
});
```

- `path` — путь из контракта без `/api/v1`; адрес собирается из `VITE_API_BASE_URL`.
- `schema` — сгенерированная zod-схема ответа; тип результата выводится из неё. Ответ не по схеме — ошибка `INVALID_RESPONSE`. Для ответа без тела (204) — `zNoContent`.
- Cookie сессии браузер отправляет сам, клиент её не читает.
- Таймаут обычного запроса — 10 с.

Правила:

- **У каждой операции Farfetched уникальный `name`.** Без него в тестах подмены разных операций срабатывают друг за друга.
- **`callApi` вызывается один раз на операцию и синхронно внутри handler, до первого `await`** — иначе Farfetched бросит ошибку. Если нужно два запроса или своя отмена: создайте `AbortController`, один раз вызовите `onAbort(() => controller.abort())` и передавайте `signal` в `sendApiRequest`.
- Без Farfetched — `sendApiRequest` с теми же параметрами.

## Ошибки

Любая ошибка запроса, кроме отмены, — `ApiError`. Экран показывает `error.message` как есть: тексты для пользователя на русском.

| Поле         | Что в нём                                                     |
| ------------ | ------------------------------------------------------------- |
| `status`     | HTTP-статус; `0` — ответа не было (нет сети, таймаут)         |
| `code`       | код из контракта или клиентский (`NETWORK_ERROR`, `TIMEOUT`…) |
| `message`    | текст для пользователя                                        |
| `field`      | поле формы, к которому относится ошибка, или `null`           |
| `retryAfter` | секунды из `Retry-After` или `null`                           |
| `details`    | всё тело ошибки как есть; доп. поля — через `getErrorDetails` |

Если сервер не прислал JSON (нет сети, HTML от nginx), клиент сам строит ошибку с понятным текстом: `NETWORK_ERROR`, `TIMEOUT`, `INTERNAL_ERROR`, `SEARCH_UNAVAILABLE` (для запросов с `isSearch: true`), `SERVICE_UNAVAILABLE`, `RATE_LIMITED`, `INVALID_RESPONSE` и др. Тексты — в `CLIENT_ERRORS` (`errors.ts`).

Проверки: `isSessionError`, `isSearchUnavailableError`, `isRateLimitError` (429, кроме блокировки входа), `isLoginLockedError`, `isNetworkError`, `isTimeoutError`, `isAbortError` (отмена — не `ApiError`, как ошибку не показывать).

Дополнительные поля ответа:

```ts
import { getErrorDetails, zAuthLoginError } from "@/shared/api";

const captchaRequired = getErrorDetails(error, zAuthLoginError)?.captcha_required ?? false;
```

## 401

- **Действия пользователя** (по умолчанию `onUnauthorized: "login"`): клиент делает пользователя гостем и открывает `/login?redirect=<текущая страница>`; после входа — возврат обратно. Экран 401 не обрабатывает.
- **`GET /auth/session` и `POST /auth/logout`** (`onUnauthorized: "guest"`): только статус гостя, вход не открывается.

Автоматического повтора действия после входа нет, хотя контракт его упоминает: гость не может выбрать режимы с файлами, поэтому 401 на поиске бывает только при истёкшей сессии — после входа пользователь запускает поиск сам.

## Поиск по файлу

`POST /search/image` и `POST /search/video`. Режимы, пути и таймауты — в `search/modes.ts`.

```ts
import { invoke } from "@withease/factories";

import { createFileSearchFactory } from "@/shared/api";

export const $$videoSearch = invoke(createFileSearchFactory, { mode: "video" });
```

| Вход / выход           | Что это                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `inputs.started(file)` | начать поиск; сбрасывает прошлый результат, отменяет идущий поиск                  |
| `inputs.cancelled()`   | отменить на любом этапе; вне поиска ничего не делает                               |
| `outputs.$stage`       | `idle` → `uploading` → `processing` → `done` / `failed`                            |
| `outputs.$progress`    | процент загрузки 0–100; `null` — размер неизвестен, нужен неопределённый индикатор |
| `outputs.$results`     | найденные фильмы или `null`                                                        |
| `outputs.$isEmpty`     | ничего не найдено — это не ошибка                                                  |
| `outputs.$error`       | `ApiError` после `failed`                                                          |

- `uploading` — файл отправляется (индикатор загрузки), `processing` — файл отправлен, сервер ищет (индикатор обработки).
- Отмена и 401 возвращают модель в `idle` без ошибки.
- **При уходе со страницы поиска экран вызывает `cancelled`**, иначе загрузка продолжится в фоне:

```ts
sample({ clock: route.closed, target: $$videoSearch.inputs.cancelled });
```

Без Effector — `searchByFile({ mode, file, signal, onUploadProgress, onUploadComplete })`: прогресс — доля от 0 до 1 или `null`, отмена — `controller.abort()` (промис отклоняется с `AbortError`).

**Новый режим загрузки (аудио):** запись в `FILE_SEARCH_MODES` (путь, таймауты, текст `FILE_TOO_LARGE`) и сценарии в заглушках — модель и `searchByFile` работают без изменений. **Текстовый поиск** — отдельная функция с JSON-запросом, без этапа загрузки и без 401.

## Сессия

Модель `$$session` из `@/entities/session`:

- `inputs.signedIn({ login, password })` — вход; повторный вызов, пока вход идёт, игнорируется;
- `outputs.$isSigningIn` — вход идёт, блокировать кнопку;
- `outputs.$loginError` — ошибка последней попытки входа (`ApiError` или `null`); сбрасывается при новой попытке и при уходе с `/login`; `captcha_required` — `getLoginErrorDetails(error)`.

Кнопка «Войти (заглушка)» на `/login` есть только в режиме разработки и отправляет тестовые данные из контракта. Её заменит форма входа.

## Заглушки

Отвечают вместо backend, чтобы делать экраны до его готовности. Подменяют только отправку запроса, поэтому ошибки, 401 и отмена работают так же, как с настоящим сервером.

Включение — `VITE_API_MOCKS=true` в `.env.development.local` (см. общий README). В продакшен-сборку не попадают.

- Вход принимает любые данные и сохраняется после перезагрузки страницы.
- Поиск без входа отвечает 401; после входа — загрузка с прогрессом, обработка 3 с (изображение) или 5 с (видео) и ответ по выбранному сценарию.
- Запрос, для которого нет заглушки, — 404 `MOCK_NOT_FOUND` и предупреждение в консоли.

### Сценарии

Сценарий выбирается в консоли браузера и действует со следующего запроса, перезагрузка не нужна:

```js
localStorage.setItem("dejaview:mocks:search", "FILE_TOO_LARGE"); // выбрать сценарий поиска
localStorage.removeItem("dejaview:mocks:search"); // вернуть по умолчанию

localStorage.setItem("dejaview:mocks:login", "INVALID_CREDENTIALS"); // выбрать сценарий входа
localStorage.removeItem("dejaview:mocks:login"); // вернуть успешный вход

localStorage.removeItem("dejaview:mocks:session"); // выйти без кнопки
```

| Сценарий поиска                                                                             | Что вернёт                                                     |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `found` (по умолчанию)                                                                      | найденный фильм: «Начало» для видео, «Матрица» для изображения |
| `empty`                                                                                     | `results: []` — ничего не найдено                              |
| `FILE_REQUIRED`, `TOO_MANY_FILES`, `UNSUPPORTED_FORMAT`, `FILE_TOO_LARGE`, `FILE_CORRUPTED` | ошибка файла с текстом своего режима                           |
| `VIDEO_TOO_LONG`                                                                            | видео длиннее 30 секунд (только для видео)                     |
| `SEARCH_UNAVAILABLE`, `SERVER_BUSY`, `NGINX_502`                                            | поиск недоступен                                               |
| `SESSION_EXPIRED`, `SESSION_REQUIRED`                                                       | 401: пользователь становится гостем и уходит на вход           |
| `RATE_LIMITED`                                                                              | слишком много запросов                                         |
| `INTERNAL_ERROR`                                                                            | ошибка сервера                                                 |
| `NETWORK_ERROR`, `TIMEOUT`                                                                  | нет сети, сервер не ответил                                    |

| Сценарий входа        | Что вернёт                               |
| --------------------- | ---------------------------------------- |
| без сценария          | успешный вход                            |
| `INVALID_CREDENTIALS` | неверные имя пользователя или пароль     |
| `CAPTCHA_REQUIRED`    | нужна CAPTCHA (`captcha_required: true`) |
| `EMAIL_NOT_CONFIRMED` | email не подтверждён                     |
| `LOGIN_LOCKED`        | вход заблокирован, `retryAfter` = 840 с  |

Тексты и HTTP-статусы — как в контракте. Неизвестное имя сценария — предупреждение в консоли и поведение по умолчанию.

## Работа с настоящим backend локально

Cookie сессии работает, только когда API на том же адресе, что и сайт. Поэтому dev-сервер пересылает `/api/v1` на backend — в `.env.development.local`:

```
VITE_API_MOCKS=false
VITE_API_PROXY_TARGET=http://localhost:8080
```

- Если backend проверяет `Origin`, разрешите ему `http://localhost:5173`.
- Для `pnpm start:prod` переменная задаётся в `.env.production.local` (перед этим `pnpm build`); `VITE_API_MOCKS=true` туда не писать — заглушки попадут в сборку.
- Вход проверяйте в Chrome или Firefox: Safari может не принять cookie с `Secure` на `http://localhost`.
