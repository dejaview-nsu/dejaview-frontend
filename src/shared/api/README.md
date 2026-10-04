# API-клиент

Слой запросов к backend DejaView. Контракт — `dejaview-docs/api/openapi.yaml`, типы и zod-схемы из него лежат в `generated/` (см. «Генерация типов API» в общем README).

## Устройство

```
Farfetched (createQuery / createMutation)
        │  handler: callApi({ method, path, body, schema })
        ▼
   requestFx      — разбирает ответ: 2xx → проверка zod-схемой, ошибка → ApiError
        │
   transportFx    — отправляет запрос и возвращает «сырой» ответ: статус, заголовки, текст тела
        │
   xhr-транспорт  — XMLHttpRequest: заголовки, cookie, таймаут, отмена
```

- **Транспорт** (`transport/`) только отправляет запрос. HTTP-статус ошибки для него — обычный ответ. Отклоняет промис транспорт в трёх случаях: нет сети, таймаут, отмена.
- **`requestFx`** (`request.ts`) превращает ответ в данные или `ApiError`. Успешный ответ проверяется сгенерированной схемой (`zSessionInfo`, `zSearchResponse` и т. д.). Ответ не по схеме — `ApiError` с кодом `INVALID_RESPONSE`.
- **`callApi`** вызывается внутри handler Farfetched. Он создаёт `AbortController` и связывает его с `onAbort`: когда Farfetched отменяет операцию, транспорт обрывает запрос. Вызывать `callApi` нужно до первого `await` в handler.
- `transportFx` и `requestFx` — effector-эффекты. В тестах транспорт подменяется через `fork({ handlers: [[transportFx, fake]] })`.

```ts
import { createQuery } from "@farfetched/core";

import { callApi, zSessionInfo } from "@/shared/api";

const sessionQuery = createQuery({
  handler: () => callApi({ method: "GET", path: "/auth/session", schema: zSessionInfo }),
});
```

Таймаут обычного JSON-запроса — 10 с.

## Ошибки

Любая ошибка запроса, кроме отмены, — `ApiError`. Экран показывает `error.message` как есть: сервер присылает текст для пользователя на русском, клиентские тексты ниже написаны так же.

| Поле         | Что в нём                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------- |
| `status`     | HTTP-статус; `0` — ответа не было (нет сети, таймаут)                                        |
| `code`       | код из тела ответа (`FILE_TOO_LARGE`, `SESSION_EXPIRED`…) или клиентский код из таблицы ниже |
| `message`    | текст для пользователя: из тела ответа без изменений или клиентский                          |
| `field`      | поле формы, к которому относится ошибка, или `null`                                          |
| `retryAfter` | секунды из заголовка `Retry-After` или `null`                                                |

Если тело ошибки — JSON по схеме `Error` (есть `code` и `message`), `code`, `message` и `field` берутся из него. Иначе (HTML от nginx, пустое тело, JSON другой формы) ошибка строится по статусу:

| Когда                                                    | `code`                | `message`                                                                               |
| -------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------- |
| нет сети, соединение оборвано                            | `NETWORK_ERROR`       | Не удалось связаться с сервером. Проверьте подключение к интернету и попробуйте ещё раз |
| нет ответа за отведённое время                           | `TIMEOUT`             | Сервер слишком долго не отвечает. Попробуйте ещё раз                                    |
| 401 без тела                                             | `SESSION_REQUIRED`    | Войдите, чтобы продолжить                                                               |
| 413 без тела                                             | `FILE_TOO_LARGE`      | Файл слишком большой                                                                    |
| 429 без тела                                             | `RATE_LIMITED`        | Слишком много запросов. Попробуйте позже                                                |
| 500 без тела                                             | `INTERNAL_ERROR`      | Произошла ошибка. Попробуйте позже                                                      |
| 502, 503, 504 без тела, запрос поиска (`isSearch: true`) | `SEARCH_UNAVAILABLE`  | Поиск временно недоступен. Попробуйте позже                                             |
| 502, 503, 504 без тела, другой запрос                    | `SERVICE_UNAVAILABLE` | Сервис временно недоступен. Попробуйте позже                                            |
| другой статус без тела; успешный ответ не по схеме       | `INVALID_RESPONSE`    | Произошла ошибка. Попробуйте позже                                                      |

Запрос поиска помечается в конфиге: `callApi({ ..., isSearch: true })`.

Проверки:

| Функция                    | `true`, когда                                                              |
| -------------------------- | -------------------------------------------------------------------------- |
| `isSessionError`           | `SESSION_REQUIRED` или `SESSION_EXPIRED`                                   |
| `isSearchUnavailableError` | `SEARCH_UNAVAILABLE` или `SERVER_BUSY`                                     |
| `isRateLimitError`         | статус 429, кроме `AUTH_LOGIN_LOCKED`                                      |
| `isLoginLockedError`       | `AUTH_LOGIN_LOCKED` (вход заблокирован, время ожидания в `retryAfter`)     |
| `isNetworkError`           | `NETWORK_ERROR`                                                            |
| `isTimeoutError`           | `TIMEOUT`                                                                  |
| `isAbortError`             | запрос отменён; это не `ApiError`, пользователю как ошибка не показывается |

## Поиск по файлу

`POST /search/image` и `POST /search/video`: один файл в поле `file` формата multipart. Загрузка и обработка идут в одном запросе: пока тело отправляется, виден процент загрузки; когда отправлено целиком — идёт обработка, ждём ответа.

Режимы задаются в `search/modes.ts`: путь и таймауты с запасом к срокам контракта.

| Режим   | Путь            | Таймаут загрузки      | Таймаут ответа (после загрузки) |
| ------- | --------------- | --------------------- | ------------------------------- |
| `image` | `/search/image` | 15 с (контракт: 5 с)  | 20 с (контракт: 10 с)           |
| `video` | `/search/video` | 90 с (контракт: 30 с) | 30 с (контракт: 15 с)           |

### Модель `createFileSearchFactory({ mode })`

Входы:

| Вход                   | Что делает                                                                                                                                                                                                                              |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inputs.started(file)` | Начинает поиск. Из любого состояния начинает заново и сразу сбрасывает `$results`, `$error` и `$progress`, чтобы старые данные не мелькали. Если поиск уже идёт, предыдущий запрос отменяется. Файл модель не хранит, его держит экран. |
| `inputs.cancelled()`   | Отменяет идущий поиск (этапы `uploading` и `processing`), см. «Отмена». В `idle`, `done` и `failed` ничего не меняет.                                                                                                                   |

Выходы:

| Выход       | Тип                           | Что в нём                                                                                                                  |
| ----------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `$stage`    | `FileSearchStage`             | этап, см. ниже                                                                                                             |
| `$progress` | `number \| null`              | процент загрузки 0–100; `null` — размер неизвестен, нужен неопределённый индикатор; при переходе в `processing` всегда 100 |
| `$results`  | `MovieSearchResult[] \| null` | результат после `done`, иначе `null`                                                                                       |
| `$isEmpty`  | `boolean`                     | `true`, если поиск выполнен и ничего не найдено; это не ошибка                                                             |
| `$error`    | `ApiError \| null`            | ошибка после `failed`; показывать `error.message` как есть                                                                 |
| `succeeded` | событие `MovieSearchResult[]` | поиск выполнен (в том числе пустой результат)                                                                              |
| `failed`    | событие `ApiError`            | поиск завершился ошибкой                                                                                                   |

Значения `$stage`:

| `$stage`     | Что показать                                                             |
| ------------ | ------------------------------------------------------------------------ |
| `idle`       | ничего не идёт                                                           |
| `uploading`  | индикатор загрузки: процент из `$progress` или неопределённый при `null` |
| `processing` | индикатор обработки (файл отправлен, ждём ответа)                        |
| `done`       | результат или «ничего не найдено» (`$isEmpty`)                           |
| `failed`     | `$error.message` в области сообщений режима                              |

401 на поиске не показывается как ошибка: модель возвращается в `idle`, `$error` остаётся `null`, `failed` не срабатывает. Экран 401 не обрабатывает. Клиент сам делает пользователя гостем и открывает вход, а после входа поиск автоматически не повторяется.

503 (`SEARCH_UNAVAILABLE`, `SERVER_BUSY`) и 502/503/504 без тела — `failed` с текстом о недоступности поиска; проверить можно через `isSearchUnavailableError`.

### Отмена

- `inputs.cancelled()` обрывает запрос на любом этапе: и во время загрузки, и во время обработки.
- Отмена — не ошибка. Модель возвращается в `idle`, `$progress` сбрасывается, `$error` остаётся `null`, `failed` и `succeeded` не срабатывают.
- Новый `started` во время идущего поиска отменяет предыдущий запрос. Состояние показывает только новый поиск и не откатывается в `idle`.
- Прогресс и ответ, которые пришли от уже отменённого запроса, игнорируются.
- `cancelled` в `idle`, `done` и `failed` ничего не меняет: найденный результат и ошибка остаются.
- **Экран должен вызывать `cancelled` при уходе со страницы поиска**, иначе загрузка продолжится в фоне:

```ts
sample({ clock: route.closed, target: $$videoSearch.inputs.cancelled });
```

### Подключение в экранах

```ts
import { invoke } from "@withease/factories";

import { createFileSearchFactory } from "@/shared/api";

export const $$imageSearch = invoke(createFileSearchFactory, { mode: "image" });
export const $$videoSearch = invoke(createFileSearchFactory, { mode: "video" });
```

```tsx
const { stage, progress, results, isEmpty, error, start, cancel } = useUnit({
  stage: $$videoSearch.outputs.$stage,
  progress: $$videoSearch.outputs.$progress,
  results: $$videoSearch.outputs.$results,
  isEmpty: $$videoSearch.outputs.$isEmpty,
  error: $$videoSearch.outputs.$error,
  start: $$videoSearch.inputs.started,
  cancel: $$videoSearch.inputs.cancelled,
});

// «Начать поиск» → start(file)
// stage === "uploading"       → индикатор загрузки: progress === null ? неопределённый : `${progress}%`, «Отмена» → cancel()
// stage === "processing"      → индикатор обработки, «Отмена» → cancel()
// stage === "done" && isEmpty → «ничего не найдено», файл остаётся выбранным
// stage === "done"            → results[0]
// stage === "failed"          → error.message
```

### Без Effector: `searchByFile`

```ts
import { searchByFile } from "@/shared/api";

const controller = new AbortController();

const { results } = await searchByFile({
  mode: "image",
  file,
  signal: controller.signal,
  onUploadProgress: (fraction) => console.log(fraction === null ? "размер неизвестен" : fraction),
  onUploadComplete: () => console.log("обработка"),
});
```

`fraction` — доля от 0 до 1 или `null`. Ошибки — `ApiError`, 401 тоже, потому что без модели его некому скрыть.

Отмена — `controller.abort()`: запрос обрывается на любом этапе, таймеры очищаются, промис отклоняется с `AbortError`. Это не `ApiError`, отличить можно через `isAbortError(error)`, пользователю как ошибку не показывать.

## 401

401 значит только «нет сессии»: `SESSION_REQUIRED` (нет cookie) или `SESSION_EXPIRED` (сессия истекла или завершена). Оба кода обрабатываются одинаково. Неверный пароль при входе — 400, не 401.

В конфиге запроса есть `onUnauthorized`:

| `onUnauthorized`         | Запросы                                  | Что происходит при 401                                                                          |
| ------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `"login"` (по умолчанию) | действия пользователя: поиск и т. п.     | `shared/api` генерирует `sessionRequired`; пользователь становится гостем и уходит на вход      |
| `"guest"`                | `GET /auth/session`, `POST /auth/logout` | только статус гостя, адрес не меняется, вход не открывается; после выхода — главная, как обычно |

Реакция на `sessionRequired` — в `entities/session` (`shared` не импортирует `entities`):

1. Сначала пользователь становится гостем: `$status = "guest"`, `$user = null`.
2. Затем переход на `/login?redirect=<текущий путь вместе с query>` через `loginRedirectRequested`.

Вид перехода:

- с открытой страницы (главная, карточка фильма) — обычный переход (push): «Назад» вернёт на эту страницу;
- с защищённой страницы (сделанной через `createAuthorizedRouteFactory`, сейчас `/profile`) — с заменой (replace), как при защите профиля. Иначе «Назад» вернёт на защищённую страницу, защита снова отправит на вход, и пользователь застрянет.

Перехода нет:

- если пользователь уже на `/login` или `/register` — только статус гостя;
- для второго и следующих 401, пока переход на вход ещё идёт: несколько упавших одновременно запросов дают один переход;
- при отмене запроса: отмена — не 401.

Экран 401 не обрабатывает: модель поиска уходит в `idle` без ошибки, всё остальное делает клиент. После входа пользователь возвращается по `redirect` на ту же страницу вместе с query и сам запускает действие заново. Автоматического повтора действия нет.

## Заглушки

Заглушки (`mocks/`) отвечают вместо backend, чтобы верстать экраны до его готовности. Они подменяют только транспорт, поэтому разбор ответов, ошибки, 401 и отмена работают так же, как с настоящим сервером.

### Как включить

В `.env.development.local` (см. «Как поднять локально» в общем README):

```
VITE_API_MOCKS=true
```

и перезапустить `pnpm start:dev`.

- `VITE_API_MOCKS=true` — только для локальной разработки. Vite читает `.env.development.local` только при `pnpm start:dev`, при `pnpm build` этот файл не используется.
- В сборку заглушки не попадают. `resolveTransport` подключает их динамическим `import()` только при `import.meta.env.VITE_API_MOCKS === "true"`. При другом значении Vite подставляет его при сборке и выбрасывает эту ветку вместе с кодом и данными заглушек.

Что умеют:

| Запрос                                     | Ответ                                                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /auth/session`                        | 200 `SessionInfo`, если «вошёл»; иначе 401 `SESSION_REQUIRED`                                                                                                            |
| `POST /auth/login`                         | любые данные: «вошёл», 200 `SessionInfo` (`movie_fan_42`)                                                                                                                |
| `POST /auth/logout`                        | 204 и «гость»; если уже гость — 401 `SESSION_REQUIRED`                                                                                                                   |
| `POST /search/image`, `POST /search/video` | гостю — сразу 401 `SESSION_REQUIRED`; иначе загрузка с прогрессом (примерно 2 МБ/с, не меньше 1,5 с), обработка (3 с для изображения, 5 с для видео) и ответ по сценарию |
| любой другой                               | 404 `MOCK_NOT_FOUND` и `console.warn("Заглушки: нет заглушки для <METHOD> <path>")`                                                                                      |

«Вошёл/гость» хранится в `localStorage` и переживает перезагрузку, как настоящая cookie. Если `localStorage` недоступен, заглушки работают, а вход хранится в памяти до перезагрузки.

### Сценарии поиска

| Сценарий                        | HTTP                   | `code`                               | Что увидит пользователь                                                                                                 |
| ------------------------------- | ---------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `found` (по умолчанию)          | 200                    | —                                    | фильм из примеров контракта: «Матрица» для изображения, «Начало» для видео                                              |
| `empty`                         | 200                    | —                                    | «ничего не найдено»                                                                                                     |
| `FILE_REQUIRED`                 | 400                    | `FILE_REQUIRED`                      | «Невозможно выполнить поиск по изображению: изображение не загружено» / «…по видеофрагменту: видеофрагмент не загружен» |
| `TOO_MANY_FILES`                | 400                    | `TOO_MANY_FILES`                     | «…: загружено больше одного файла»                                                                                      |
| `UNSUPPORTED_FORMAT`            | 415                    | `UNSUPPORTED_FORMAT`                 | «…: поддерживаются только JPG, JPEG, PNG и WEBP» / «…MP4, MOV и WEBM»                                                   |
| `FILE_TOO_LARGE`                | 413                    | `FILE_TOO_LARGE`                     | «…: размер файла больше 10 МБ» / «…50 МБ»                                                                               |
| `VIDEO_TOO_LONG` (только видео) | 422                    | `VIDEO_TOO_LONG`                     | «Невозможно выполнить поиск по видеофрагменту: видео длиннее 30 секунд»                                                 |
| `FILE_CORRUPTED`                | 422                    | `FILE_CORRUPTED`                     | «…: файл поврежден или не может быть обработан»                                                                         |
| `SEARCH_UNAVAILABLE`            | 503                    | `SEARCH_UNAVAILABLE`                 | «Поиск временно недоступен. Попробуйте позже»                                                                           |
| `SERVER_BUSY`                   | 503                    | `SERVER_BUSY`                        | «Сервис перегружен. Попробуйте позже»                                                                                   |
| `NGINX_502`                     | 502, HTML от nginx     | `SEARCH_UNAVAILABLE` (строит клиент) | «Поиск временно недоступен. Попробуйте позже»                                                                           |
| `SESSION_EXPIRED`               | 401                    | `SESSION_EXPIRED`                    | ошибки нет: «гость» и переход на вход; заглушка тоже снимает вход                                                       |
| `SESSION_REQUIRED`              | 401                    | `SESSION_REQUIRED`                   | ошибки нет: «гость» и переход на вход                                                                                   |
| `RATE_LIMITED`                  | 429, `Retry-After: 60` | `RATE_LIMITED`                       | «Слишком много запросов. Попробуйте позже»                                                                              |
| `INTERNAL_ERROR`                | 500                    | `INTERNAL_ERROR`                     | «Произошла ошибка. Попробуйте позже»                                                                                    |
| `NETWORK_ERROR`                 | ответа нет             | `NETWORK_ERROR` (строит клиент)      | «Не удалось связаться с сервером. Проверьте подключение к интернету и попробуйте ещё раз»                               |
| `TIMEOUT`                       | ответа нет             | `TIMEOUT` (строит клиент)            | «Сервер слишком долго не отвечает. Попробуйте ещё раз»                                                                  |

Тексты ошибок файла — дословно из контракта, для режима запроса. Ошибки приходят после загрузки и обработки, как с настоящим сервером. Неизвестное имя сценария (и `VIDEO_TOO_LONG` для изображения) — `console.warn` и `found`.

### Как переключать

В консоли браузера; действует со следующего запроса, перезагрузка не нужна:

```js
localStorage.setItem("dejaview:mocks:search", "SEARCH_UNAVAILABLE");
localStorage.removeItem("dejaview:mocks:search");
localStorage.setItem("dejaview:mocks:session", "authenticated");
localStorage.removeItem("dejaview:mocks:session");
```

1. Выбрать сценарий поиска — первая строка с нужным именем из таблицы.
2. Вернуть сценарий по умолчанию (`found`) — вторая строка.
3. Войти без формы — третья строка; после перезагрузки страницы шапка покажет вход.
4. Выйти без кнопки — четвёртая строка; следующий поиск получит 401 и откроет вход.

### Фрагменты для консоли браузера

Vite в режиме разработки отдаёт модули по пути, поэтому их можно импортировать прямо из консоли.

Поиск через `searchByFile` с прогрессом и отменой:

```js
const { searchByFile, isAbortError } = await import("/src/shared/api/index.ts");
const file = new File([new Uint8Array(30 * 1024 * 1024)], "scene.mp4", { type: "video/mp4" });
const controller = new AbortController();

searchByFile({
  mode: "video",
  file,
  signal: controller.signal,
  onUploadProgress: (fraction) => console.log("загрузка", fraction === null ? "?" : `${Math.round(fraction * 100)}%`),
  onUploadComplete: () => console.log("обработка…"),
}).then(
  (response) => console.log("ответ", response),
  (error) => console.warn(isAbortError(error) ? "отменено" : `${error.code}: ${error.message}`),
);

// отмена на любом этапе:
controller.abort();
```

Модель `createFileSearchFactory` с выводом изменений `$stage`, `$progress`, `$results` и `$error`. `invoke` хранит состояние в своём модуле, поэтому берём тот же экземпляр `@withease/factories`, что у приложения: адрес с `?v=…` находится среди загруженных ресурсов.

```js
const { createFileSearchFactory } = await import("/src/shared/api/index.ts");
const factoriesUrl = performance
  .getEntriesByType("resource")
  .map((entry) => entry.name)
  .find((name) => name.includes("/.vite/deps/@withease_factories.js"));
const { invoke } = await import(factoriesUrl);

const $$search = invoke(createFileSearchFactory, { mode: "video" });

for (const name of ["$stage", "$progress", "$results", "$error"]) {
  $$search.outputs[name].watch((value) => console.log(name, value));
}

$$search.inputs.started(new File([new Uint8Array(30 * 1024 * 1024)], "scene.mp4", { type: "video/mp4" }));

// отмена:
$$search.inputs.cancelled();
```

### Правило: у каждой операции Farfetched есть `name`

```ts
createQuery({ name: "session.get", handler: ... });
createMutation({ name: `fileSearch.${mode}`, handler: ... });
```

Внутренний эффект операции (`__.executeFx`) получает `sid` из её имени: `ff.<name>.executeFx`. Без `name` у всех операций один и тот же `sid` `ff.unnamed.executeFx`. Подмены в тестах (`fork({ handlers })`) привязываются к `sid`, поэтому подмена одной безымянной операции срабатывает и для других: например, мок мутации входа отвечал за мутацию поиска. Имя должно быть уникальным.

## Адрес и cookie

- Адрес запроса = `VITE_API_BASE_URL` + путь операции из контракта, например `/api/v1` + `/auth/session`. По умолчанию `VITE_API_BASE_URL` = `/api/v1`: в продакшене nginx отдаёт SPA и проксирует `/api/v1` на том же домене.
- Заголовки: `Accept: application/json`; для JSON-тела ещё `Content-Type: application/json`. Для `FormData` Content-Type ставит браузер, вместе с boundary.
- Сессия — cookie `dv_session` (`HttpOnly; Secure; SameSite=Lax; Path=/api/v1`). JavaScript её не видит и не читает, браузер сам отправляет её с запросами на `/api/v1`. Состояние входа клиент узнаёт через `GET /auth/session`.
- `withCredentials = true`: на том же домене это ничего не меняет, а если `VITE_API_BASE_URL` указывает на другой домен, браузер всё равно отправит cookie. Но CORS по контракту разрешён только с домена приложения, поэтому основной вариант — тот же домен.

## Proxy в разработке

Cookie с `SameSite=Lax` и `Path=/api/v1` надёжно работает, только когда API на том же адресе, что и сайт. Поэтому в разработке запросы идут на `http://localhost:5173/api/v1`, а dev-сервер Vite передаёт их на backend:

```
VITE_API_PROXY_TARGET=http://localhost:8080
```

- Proxy включается, только если переменная задана; `VITE_API_BASE_URL` при этом остаётся `/api/v1`.
- `changeOrigin: true` — backend получает заголовок `Host` своего адреса. Если backend проверяет `Origin`, в разработке ему нужно разрешить `http://localhost:5173`.
- Cookie с `Secure` на `http://localhost` Chrome и Firefox принимают. Safari может отклонить: для проверки входа используйте Chrome или Firefox.
