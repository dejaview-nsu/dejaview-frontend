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

Приложение — на `http://localhost:5173`. Без настроек открываются страницы, но запросы к API не работают. Выберите вариант.

**Пока нет backend** — заглушки API. Создайте в корне файл `.env.development.local`:

```
VITE_API_MOCKS=true
```

Войти можно кнопкой «Войти (заглушка)» на `/login`, вход сохраняется после перезагрузки. Сценарии ответов — в разделе «Заглушки» [`src/shared/api/README.md`](src/shared/api/README.md).

**Backend запущен локально** — в том же файле:

```
VITE_API_MOCKS=false
VITE_API_PROXY_TARGET=http://localhost:8080
```

После изменения переменных перезапустите `pnpm start:dev`. Файл `.env.development.local` читается только при разработке: в сборку и в git он не попадает.

### Переменные окружения

Все настройки необязательны. Шаблон со всеми переменными — `.env.example`, его можно скопировать в `.env.development.local` (`Copy-Item .env.example .env.development.local` в PowerShell, `cp .env.example .env.development.local` в bash).

| Переменная              | Где используется                                               | По умолчанию                        | Пример                               |
| ----------------------- | -------------------------------------------------------------- | ----------------------------------- | ------------------------------------ |
| `VITE_URL`              | хост dev-сервера                                               | `localhost`                         | `127.0.0.1`                          |
| `VITE_PORT`             | порт dev-сервера                                               | `5173`                              | `3000`                               |
| `VITE_API_URL`          | демо-запрос из каркаса, к API DejaView не относится            | —                                   | `https://api.example.com`            |
| `VITE_API_BASE_URL`     | адрес API вместе с `/api/v1`, подставляется при сборке         | `/api/v1`                           | `https://dejaview.example.ru/api/v1` |
| `VITE_API_MOCKS`        | `true` — ответы из заглушек, только для разработки             | `false`                             | `true`                               |
| `VITE_API_PROXY_TARGET` | куда dev-сервер пересылает `/api/v1`                           | не задана, proxy выключен           | `http://localhost:8080`              |
| `OPENAPI_SPEC`          | путь к контракту для `pnpm api:generate`, задаётся в терминале | `../dejaview-docs/api/openapi.yaml` | `D:\docs\api\openapi.yaml`           |

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
