# dejaview-frontend

Одностраничное приложение: мультимодальный поиск фильмов и личный кинотрекер.

## Зона ответственности

- Четыре режима поиска в одном окне: текст, изображение, видео, аудио
- Загрузка файлов до 50 МБ: прогресс и отмена, загрузка и обработка показаны отдельно
- Страница фильма: постер, оценки, актёры, сюжет, отзывы
- Профиль: списки «Хочу посмотреть» и «Просмотрено», история, статистика
- Пустые состояния и экраны ошибок
- Адаптивная вёрстка от 360 px

## Стек

- React 19, TypeScript, Vite
- Состояние: Effector + @effector/router, данные: Farfetched + zod
- UI: React Aria Components, стили: Tailwind CSS 4
- Тесты: Vitest + Testing Library
- Типы и zod-схемы API генерируются из `dejaview-docs/api/openapi.yaml` инструментом `@hey-api/openapi-ts`, руками не пишутся
- Конфигурация из переменных окружения, секреты в репозиторий не попадают

## Как поднять локально

```
pnpm install && pnpm start:dev
```

Приложение — на `http://localhost:5173` (порт и хост настраиваются `VITE_PORT`/`VITE_URL`). Без настроек проект открывается, но запросы к API без заглушек или backend не работают: вход и поиск будут падать с сетевой ошибкой. Выберите один из вариантов.

Сначала скопируйте шаблон переменных в `.env.development.local`:

```powershell
# PowerShell
Copy-Item .env.example .env.development.local
```

```bash
# bash
cp .env.example .env.development.local
```

Vite читает `.env.development.local` только при `pnpm start:dev`, при `pnpm build` этот файл не используется. Поэтому настройки разработки никогда не попадут в сборку. Файл не коммитится.

**Пока нет backend** — ответы API из заглушек:

```
VITE_API_MOCKS=true
```

`VITE_API_MOCKS=true` — только для локальной разработки, в `.env.development.local`.

**Backend запущен локально** — запросы к `/api/v1` dev-сервер передаёт на backend:

```
VITE_API_MOCKS=false
VITE_API_PROXY_TARGET=http://localhost:8080
```

После изменения переменных перезапустите `pnpm start:dev`.

### Переменные окружения

| Переменная              | Где используется                                                                    | По умолчанию                        | Пример                               |
| ----------------------- | ----------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------ |
| `VITE_URL`              | хост dev-сервера Vite (`vite.config.ts`)                                            | `localhost`                         | `0.0.0.0`                            |
| `VITE_PORT`             | порт dev-сервера и `pnpm start:prod` (`vite.config.ts`)                             | `5173`                              | `3000`                               |
| `VITE_API_URL`          | `buildUrl` в `src/shared/api/url.ts`, адрес из каркаса; к API DejaView не относится | —                                   | `https://api.example.com`            |
| `VITE_API_BASE_URL`     | клиент API, подставляется при сборке; полный адрес вместе с `/api/v1`               | `/api/v1`                           | `https://dejaview.example.ru/api/v1` |
| `VITE_API_MOCKS`        | клиент API: `true` — ответы из заглушек; только в `.env.development.local`          | `false`                             | `true`                               |
| `VITE_API_PROXY_TARGET` | proxy `/api/v1` в dev-сервере (`vite.config.ts`)                                    | не задана, proxy выключен           | `http://localhost:8080`              |
| `OPENAPI_SPEC`          | путь к спецификации для `pnpm api:generate`; переменная оболочки, не `.env`         | `../dejaview-docs/api/openapi.yaml` | `D:\docs\api\openapi.yaml`           |

## Генерация типов API

```
pnpm api:generate
```

- Запускать после изменения контракта `api/openapi.yaml` в `dejaview-docs`: подтяните репозиторий документации и сгенерируйте заново.
- Результат — `src/shared/api/generated/`. Файлы коммитятся вместе с кодом, который на них опирается, и исключены из lint и format. Руками их не правят.
- `dejaview-docs` нужен только для генерации: сборка, тесты и dev-сервер используют закоммиченные файлы.
- Спецификация по умолчанию лежит рядом с проектом, другой путь задаётся `OPENAPI_SPEC` (см. таблицу выше).

Устройство API-клиента — в [`src/shared/api/README.md`](src/shared/api/README.md).

## Временный обход ошибки роутера

В `@effector/router` 1.2.0 обработчик `block` подключается повторно до завершения асинхронного `POP`,
из-за чего кнопки браузера «Назад» и «Вперёд» зацикливают переход. В `src/shared/routes/routes.ts`
из адаптера удалён необязательный `block`; синхронизация адреса продолжает работать через `listen`.
Проверка доступа к профилю через `chainRoute` сохраняется. При этом `beforeNavigate` не сможет
блокировать нативные переходы браузера, пока действует обход.

Обход можно убрать после обновления роутера с исправлением и проверки `tests/shared/routes/browser-history.test.ts`.

## Ссылки

- Задачи и требования: https://ai.nsu.ru/projects/dejaview
- Архитектура, контракты, соглашения: https://github.com/dejaview-nsu/dejaview-docs
- Организация: https://github.com/dejaview-nsu
- Дизайн-макеты и дизайн система (Figma): https://www.figma.com/design/b26RzxztcxHD7uzDaWbP15/DejaView?node-id=1-2&t=6dwwByiAVp9K8QwG-1

## Как работаем

- Ветка от `main`: `feat/<номер задачи>-<кратко>`, нейминг в `conventions.md`
- Изменения через Pull Request с ревью, прямой push в `main` закрыт
- Ревьюер назначается автоматически по CODEOWNERS
- Время трекается в Redmine, в задачу, а не в требование
