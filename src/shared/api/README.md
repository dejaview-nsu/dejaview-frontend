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

Файловый поиск сохраняет прерванное действие при `SESSION_REQUIRED` или `SESSION_EXPIRED`. После успешного входа и возвращения на главную поиск автоматически повторяется с тем же файлом и режимом. Отмена или замена файла снимает ожидающий повтор. После перезагрузки страницы отложенное действие не сохраняется.

## Поиск по файлу

`POST /search/image` и `POST /search/video`. Режимы, пути и таймауты — в `search/modes.ts`.

Это публичные endpoints application server из `dejaview-docs/api/openapi.yaml`, с префиксом `/api/v1`. Оба принимают `multipart/form-data` с одним полем `file`; заголовок `Content-Type` с boundary выставляет браузер. Ответ — `{ results: MovieSearchResult[] }`, пустой массив означает отсутствие результата. Прямых вызовов внутренних ML-endpoints `/v1/search/*` из SPA нет. Таймауты клиента учитывают загрузку и ожидание публичного API; сроки внутренних вызовов backend → ML не являются таймаутами браузерного запроса.

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
- `outputs.sessionLost` сообщает об актуальном запросе с 401 до перехода на вход; feature использует его для сохранения ожидающего повтора. Запоздалый 401 отменённого запроса игнорируется.
- **При уходе со страницы поиска экран вызывает `cancelled`**, иначе загрузка продолжится в фоне:

```ts
sample({ clock: route.closed, target: $$videoSearch.inputs.cancelled });
```

Без Effector — `searchByFile({ mode, file, signal, onUploadProgress, onUploadComplete })`: прогресс — доля от 0 до 1 или `null`, отмена — `controller.abort()` (промис отклоняется с `AbortError`).

**Новый режим загрузки (аудио):** запись в `FILE_SEARCH_MODES` (путь, таймауты, текст `FILE_TOO_LARGE`) и сценарии в заглушках — модель и `searchByFile` работают без изменений. **Текстовый поиск** — `searchByText({ query, signal })`, `POST /search/text` с JSON `{ query }`, без этапа загрузки. Доступен гостю; по контракту 401 здесь нет. Экран и mock transport поддерживают этот сценарий; backend реализует endpoint в Sprint 2.

## Сессия

Модель `$$session` из `@/entities/session`:

- `inputs.signedIn({ login, password })` — вход; повторный вызов, пока вход идёт, игнорируется;
- `outputs.$isSigningIn` — вход идёт, блокировать кнопку;
- `outputs.$loginError` — ошибка последней попытки входа (`ApiError` или `null`); сбрасывается при новой попытке и при уходе с `/login`; `captcha_required` — `getLoginErrorDetails(error)`.

Кнопка «Войти (заглушка)» на `/login` есть только в режиме разработки и отправляет тестовые данные из контракта. Её заменит форма входа.

## Заглушки

Отвечают вместо backend, чтобы делать экраны до его готовности. Подменяют только отправку запроса, поэтому ошибки, 401 и отмена работают так же, как с настоящим сервером.

Включение — `VITE_API_MOCKS=true` в `.env.development.local` (см. общий README). Для production оставляйте эту настройку выключенной; при явном включении моки попадут в сборку.

- Вход принимает любые данные и сохраняется после перезагрузки страницы.
- Поиск по файлу без входа отвечает 401; после входа — загрузка с прогрессом, обработка 3 с (изображение) или 5 с (видео) и ответ по выбранному сценарию. Поиск по описанию работает и для гостя: обработка 3 с, затем JSON-ответ с пятью фильмами без этапа загрузки.
- Запрос, для которого нет заглушки, — 404 `MOCK_NOT_FOUND` и предупреждение в консоли.

### Сценарии

Для проверки экранов можно задать `VITE_MOCK_SEARCH_SCENARIO=empty` или `VITE_MOCK_SEARCH_SCENARIO=SEARCH_UNAVAILABLE` в `.env.development.local` и перезапустить сервер. Эта настройка имеет приоритет над localStorage и применяется только при включённых моках.

Если настройка не задана, сценарий выбирается в консоли браузера и действует со следующего запроса, перезагрузка не нужна:

```js
localStorage.setItem("dejaview:mocks:search", "FILE_TOO_LARGE"); // выбрать сценарий поиска
localStorage.removeItem("dejaview:mocks:search"); // вернуть по умолчанию

localStorage.setItem("dejaview:mocks:login", "INVALID_CREDENTIALS"); // выбрать сценарий входа
localStorage.removeItem("dejaview:mocks:login"); // вернуть успешный вход

localStorage.removeItem("dejaview:mocks:session"); // выйти без кнопки
```

| Сценарий поиска                                                                             | Что вернёт                                                             |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `found` (по умолчанию)                                                                      | пять фильмов для текста; «Начало» для видео, «Матрица» для изображения |
| `empty`                                                                                     | `results: []` — ничего не найдено                                      |
| `FILE_REQUIRED`, `TOO_MANY_FILES`, `UNSUPPORTED_FORMAT`, `FILE_TOO_LARGE`, `FILE_CORRUPTED` | ошибка файла с текстом своего режима                                   |
| `VIDEO_TOO_LONG`                                                                            | видео длиннее 30 секунд (только для видео)                             |
| `SEARCH_UNAVAILABLE`, `SERVER_BUSY`, `NGINX_502`                                            | поиск недоступен                                                       |
| `SESSION_EXPIRED`, `SESSION_REQUIRED`                                                       | 401: пользователь становится гостем и уходит на вход                   |
| `RATE_LIMITED`                                                                              | слишком много запросов                                                 |
| `INTERNAL_ERROR`                                                                            | ошибка сервера                                                         |
| `NETWORK_ERROR`, `TIMEOUT`                                                                  | нет сети, сервер не ответил                                            |

| Сценарий входа        | Что вернёт                               |
| --------------------- | ---------------------------------------- |
| без сценария          | успешный вход                            |
| `INVALID_CREDENTIALS` | неверные имя пользователя или пароль     |
| `CAPTCHA_REQUIRED`    | нужна CAPTCHA (`captcha_required: true`) |
| `EMAIL_NOT_CONFIRMED` | email не подтверждён                     |
| `LOGIN_LOCKED`        | вход заблокирован, `retryAfter` = 840 с  |

Тексты и HTTP-статусы — как в контракте. Неизвестное имя сценария — предупреждение в консоли и поведение по умолчанию.

Для текстового поиска тот же ключ `dejaview:mocks:search` поддерживает `found`, `empty`, `QUERY_EMPTY`, `QUERY_TOO_SHORT`, `QUERY_TOO_LONG`, `QUERY_NOT_ALLOWED`, `SEARCH_UNAVAILABLE`, `SERVER_BUSY`, `NGINX_502`, `RATE_LIMITED`, `INTERNAL_ERROR`, `NETWORK_ERROR`, `TIMEOUT`. Мок также проверяет фактическую длину запроса. По умолчанию возвращает фиксированный список из пяти фильмов, независимо от введённого описания. Сценарии ошибок файла и сессии к текстовому режиму не применяются.

### Сценарии регистрации, входа и OIDC

Сценарий задаётся ключом localStorage `dejaview:mocks:auth` или переменной `VITE_MOCK_AUTH_SCENARIO` в `.env.development.local`. Если заданы оба, действует localStorage. Ошибки чтения localStorage перехватываются: тогда значение хранится в памяти вкладки, а переменная продолжает работать.

```js
localStorage.setItem("dejaview:mocks:auth", "register_email_taken"); // один сценарий
localStorage.setItem("dejaview:mocks:auth", "confirm_expired,resend_too_early"); // по сценарию на несколько эндпоинтов
localStorage.removeItem("dejaview:mocks:auth"); // вернуть поведение по умолчанию
```

Префикс имени определяет эндпоинт. Эндпоинт без своего сценария работает по умолчанию: регистрация, повторная отправка, подтверждение и OIDC отвечают успехом, а сессия, вход и выход используют сохранённый вход из `dejaview:mocks:session` и старый ключ `dejaview:mocks:login`. Неизвестное имя с префиксом эндпоинта — 404 `MOCK_NOT_FOUND` и предупреждение в консоли. Успешные `confirm_ok`, `login_ok` и `oidc_complete_ok` сохраняют вход, `logout_ok` его удаляет.

| Сценарий                                   | Эндпоинт                         | Ответ                                                                 |
| ------------------------------------------ | -------------------------------- | --------------------------------------------------------------------- |
| `register_ok` (по умолчанию)               | `POST /auth/register`            | 201, `resend_after: 60`                                               |
| `register_username_taken`                  | `POST /auth/register`            | 409 `AUTH_USERNAME_TAKEN`, `field: username`                          |
| `register_email_taken`                     | `POST /auth/register`            | 409 `AUTH_EMAIL_TAKEN`, `field: email`                                |
| `register_birth_year_invalid`              | `POST /auth/register`            | 400 `AUTH_BIRTH_YEAR_INVALID`, `field: birth_year`                    |
| `register_validation_error`                | `POST /auth/register`            | 400 `AUTH_VALIDATION_ERROR`, `field: email`                           |
| `register_rate_limited`                    | `POST /auth/register`            | 429 `RATE_LIMITED`                                                    |
| `register_server_error`                    | `POST /auth/register`            | 500 `INTERNAL_ERROR`                                                  |
| `resend_ok` (по умолчанию)                 | `POST /auth/resend-confirmation` | 202, `resend_after: 60`                                               |
| `resend_too_early`                         | `POST /auth/resend-confirmation` | 202, `resend_after: 42`                                               |
| `resend_validation_error`                  | `POST /auth/resend-confirmation` | 400 `AUTH_VALIDATION_ERROR`, `field: login`                           |
| `confirm_ok` (по умолчанию)                | `POST /auth/confirm-email`       | 200, `SessionInfo` пользователя `movie_fan_42`                        |
| `confirm_expired`                          | `POST /auth/confirm-email`       | 410 `AUTH_CONFIRMATION_LINK_EXPIRED`                                  |
| `session_guest`                            | `GET /auth/session`              | 401 `SESSION_REQUIRED`                                                |
| `session_user`                             | `GET /auth/session`              | 200, `SessionInfo`                                                    |
| `login_ok`                                 | `POST /auth/login`               | 200, `SessionInfo`                                                    |
| `login_invalid_email`                      | `POST /auth/login`               | 400 `AUTH_INVALID_CREDENTIALS`; текст про email или имя по виду login |
| `login_captcha_required`                   | `POST /auth/login`               | 403 `AUTH_CAPTCHA_REQUIRED`, `captcha_required: true`                 |
| `login_captcha_invalid`                    | `POST /auth/login`               | 403 `AUTH_CAPTCHA_INVALID`, `captcha_required: true`                  |
| `login_email_not_confirmed`                | `POST /auth/login`               | 403 `AUTH_EMAIL_NOT_CONFIRMED`                                        |
| `login_blocked`                            | `POST /auth/login`               | 403 `AUTH_ACCOUNT_BLOCKED`                                            |
| `login_locked`                             | `POST /auth/login`               | 429 `AUTH_LOGIN_LOCKED`, `Retry-After: 781` (14 минут)                |
| `login_rate_limited`                       | `POST /auth/login`               | 429 `RATE_LIMITED`                                                    |
| `logout_ok`                                | `POST /auth/logout`              | 204                                                                   |
| `oidc_pending_registration` (по умолчанию) | `GET /auth/oidc/pending`         | 200, `kind: registration`, Google, `ivan_petrov`                      |
| `oidc_pending_link`                        | `GET /auth/oidc/pending`         | 200, `kind: link`, VK, `ivan@example.com`                             |
| `oidc_pending_expired`                     | `GET /auth/oidc/pending`         | 410 `AUTH_OIDC_EXPIRED`                                               |
| `oidc_pending_server_error`                | `GET /auth/oidc/pending`         | 500 `INTERNAL_ERROR`                                                  |
| `oidc_complete_ok` (по умолчанию)          | `POST /auth/oidc/complete`       | 201, `SessionInfo`                                                    |
| `oidc_complete_username_taken`             | `POST /auth/oidc/complete`       | 409 `AUTH_USERNAME_TAKEN`, `field: username`                          |
| `oidc_complete_email_taken`                | `POST /auth/oidc/complete`       | 409 `AUTH_EMAIL_TAKEN`, `field: null`                                 |
| `oidc_complete_validation_error`           | `POST /auth/oidc/complete`       | 400 `AUTH_VALIDATION_ERROR`, `field: username`                        |
| `oidc_complete_expired`                    | `POST /auth/oidc/complete`       | 410 `AUTH_OIDC_EXPIRED`                                               |

Страницу `/auth/oidc` в режиме моков можно открыть напрямую: `/auth/oidc?provider=google&result=registration_required`. Значения `result`: `success`, `registration_required`, `link_required`, `account_blocked`, `error`.

## Работа с настоящим backend локально

Cookie сессии работает, только когда API на том же адресе, что и сайт. Поэтому dev-сервер пересылает `/api/v1` на backend — в `.env.development.local`:

```
VITE_API_MOCKS=false
VITE_API_PROXY_TARGET=http://localhost:8080
```

- Если backend проверяет `Origin`, разрешите ему `http://localhost:5173`.
- Для `pnpm start:prod` переменная задаётся в `.env.production.local` (перед этим `pnpm build`); `VITE_API_MOCKS=true` туда не писать — заглушки попадут в сборку.
- Вход проверяйте в Chrome или Firefox: Safari может не принять cookie с `Secure` на `http://localhost`.
