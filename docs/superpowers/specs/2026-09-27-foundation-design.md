# krpo — основа приложения: дизайн-документ

Дата: 2026-09-27
Статус: согласован с пользователем

## Цель

Создать рабочую основу (фундамент) SPA-приложения на React + Vite + Effector + @effector/router + React Aria Components + Vitest с архитектурой FSD. Конвенции — как в референс-проектах `chatlab` и `metrico` (структура слоёв, контракт моделей, паттерны API-слоя), стек — актуальные версии.

Основа включает рабочий каркас и эталонные примеры на каждую технологию:

- роутинг: 3 страницы (`home`, `about`, `not-found`) + layout;
- модель-фабрика с контрактом `inputs/outputs` + farfetched-запрос + `chainRoute`;
- UI-примитив на React Aria Components + cva;
- unit-тест модели (`fork`/`allSettled`) + компонентный тест (Testing Library).

Не входит (осознанно): auth/сессия, RBAC, i18n-библиотека, формы, storybook, e2e, SSR.

## Решения, принятые с пользователем

| Вопрос | Решение |
|---|---|
| Объём основы | Рабочий каркас + эталонные примеры |
| Версии | Актуальные стабильные (не как в референсах) |
| farfetched | Включён (дополнение пользователя) |
| Стилизация | Tailwind 4 + cva + cn (typewind не берём — заброшен) |
| Вариант архитектуры | A — конвенции metrico/chatlab на новом стеке |

## Стек и версии

| Категория | Пакеты |
|---|---|
| Ядро | react ^19.3, react-dom ^19.3, typescript ~5.9 |
| Состояние | effector ^23.4, effector-react ^23.3, patronum ^2.3, effector-action ^1.2, @withease/factories ^1.0 |
| Роутинг | @effector/router ^1.2, @effector/router-react ^1.0, query-string ^9 (обязательный peer роутера) |
| Данные | @farfetched/core ^0.15, zod ^4.6 |
| UI | react-aria-components ^1.21, @react-aria/i18n, class-variance-authority, clsx |
| Стили | tailwindcss ^4.3 + @tailwindcss/vite (PostCSS/tailwind.config не нужны) |
| Сборка | vite ^8.3, @vitejs/plugin-react ^6.1 |
| Тесты | vitest ^5, jsdom ^30, @testing-library/react ^16 + @testing-library/dom + @testing-library/jest-dom ^7, @vitest/coverage-v8 |
| Качество | eslint ^10 (flat) + typescript-eslint ^8 + eslint-plugin-effector ^0.19 + eslint-config-prettier, prettier ^3 + @trivago/prettier-plugin-sort-imports, husky ^9, lint-staged, @commitlint/cli + config-conventional |
| Менеджер | pnpm (`preinstall: npx only-allow pnpm`, поле `packageManager`) |

### Специальные решения

**zod 4 + локальный `zodContract`.** `@farfetched/zod@0.15` требует peer `zod ^3.19`, а `@effector/router` требует `zod >= 4` — конфликт (см. effector/farfetched issue #542, поддержка zod 4 ещё не вышла). Берём zod 4 и пишем тонкий `zodContract` в `src/shared/lib/contracts/zod.ts` (~10 строк: контракт farfetched c `isData` через `safeParse`). Когда `@farfetched/zod` получит поддержку zod 4 — точечно заменить локальный хелпер.

**Babel-плагин effector.** `effector/babel-plugin` с `factories: ["@withease/factories"]` подключается к react-плагину в `vite.config.ts` и `vitest.config.ts` — даёт стабильные SID инстансам фабрик. Vite 8 / @vitejs/plugin-react 6 работает на oxc; если передача `babel.plugins` через опции плагина не сработает — подключить через `@rolldown/plugin-babel` (это peer @vitejs/plugin-react 6).

**TypeScript 5.9, не 7.** typescript-eslint 8.x поддерживает TS < 6.1.

**Демо-API.** Эталонный запрос на странице `home` идёт к `https://jsonplaceholder.typicode.com` — работает без бэкенда. Паттерн для реального API показан в `shared/api/url.ts` (`buildUrl` от `import.meta.env.VITE_API_URL`).

## Структура проекта

```
krpo/
├── .env.sample                 # VITE_API_URL, VITE_URL, VITE_PORT
├── .gitignore
├── .commitlintrc.json
├── .husky/pre-commit           # lint-staged + tsc --noEmit
├── .lintstagedrc
├── .prettierrc                 # importOrder = слои FSD
├── eslint.config.ts            # flat config
├── index.html
├── package.json
├── tsconfig.json               # baseUrl: src, paths @/*, strict
├── tsconfig.node.json
├── vite.config.ts
├── vitest.config.ts
├── vitest.setup.ts
└── src/
    ├── vite-env.d.ts           # типизированный ImportMetaEnv
    ├── app/
    │   ├── main.tsx            # createRoot + appStarted()
    │   ├── application.tsx     # RouterProvider + I18nProvider + Routing
    │   └── index.css           # @import "tailwindcss", @theme-токены, [data-theme=dark]
    ├── layouts/
    │   └── base/               # index.ts, ui/ (BaseLayout: шапка + контент)
    ├── pages/
    │   ├── index.ts            # export { Routing }
    │   ├── routing.tsx         # createRoutesView({ routes, otherwise })
    │   ├── home/               # ЭТАЛОН: api/{request.ts,schema.ts}, model/, ui/, __tests__/
    │   ├── about/              # простая страница без модели
    │   └── not-found/
    ├── widgets/README.md       # пустые слои: назначение + анатомия слайса
    ├── features/README.md
    ├── entities/README.md
    └── shared/
        ├── api/                # url.ts (buildUrl), index.ts
        ├── config/init/        # appStarted
        ├── lib/
        │   ├── cn.ts           # re-export clsx (прямой импорт clsx запрещён)
        │   ├── contracts/zod.ts  # локальный zodContract
        │   └── guards.ts       # isNonNullable и т.п.
        ├── routes/             # routes.ts (createRoute + createRouter), index.ts
        └── ui/
            ├── button/         # ЭТАЛОН: RAC Button + cva
            └── index.ts
```

### Конвенции (из референсов)

- Слои: `app → pages → layouts/widgets → features → entities → shared`; импорты только вниз.
- Один алиас `@/*` → `src/*` (без алиасов на слои).
- Файлы kebab-case; сегменты слайса: `api / model / ui / lib`; публичный API слайса — только через `index.ts`.
- Порядок импортов (prettier importOrder) сверху вниз: external → `@/app` → `@/pages` → `@/layouts` → `@/widgets` → `@/features` → `@/entities` → `@/shared` → относительные.

## Роутинг (@effector/router)

- `src/shared/routes/routes.ts`:
  - `homeRoute = createRoute({ path: '/' })`, `aboutRoute = createRoute({ path: '/about' })` — path задаётся при создании (в отличие от atomic-router);
  - `router = createRouter({ routes: [homeRoute, aboutRoute] })`;
  - история подключается по старту приложения: `sample({ clock: appStarted, fn: () => createBrowserHistory(), target: router.setHistory })` через `historyAdapter`. Источник history-инстанса проверить при реализации (пакет `history` или экспорт `@effector/router`); если нужен `history` — добавить зависимость.
- `src/pages/routing.tsx`: `createRoutesView({ routes: [HomeScreen, AboutScreen], otherwise: NotFound })` (наличие `otherwise` проверить по типам при реализации; если нет — маршрут not-found через wildcard).
- Layout: `withLayout(BaseLayout, [HomeScreen, AboutScreen])` из `@effector/router-react` — вместо поля `layout` у RouteRecord в atomic-router.
- Загрузка данных страницы: `chainRoute` + farfetched-запрос (аналог `queryChain` из metrico на API нового роутера): до готовности данных экран не открывается, показывается лоадер.
- `appStarted` — `createEvent<void>` из `src/shared/config/init`, вызывается в `main.tsx` до рендера. Никаких Provider/fork в проде (CSR, default scope) — как в референсах.
- Тесты роутинга — через `fork` и `createMemoryHistory` (если доступен).

## Состояние: модели-фабрики + farfetched

- Все модели — фабрики: `createFactory` из `@withease/factories`, инстанцирование `invoke()` один раз на уровне модуля слайса.
- Контракт модели: `$$model = { inputs: {...}, outputs: {...} }`; outputs — только `readonly()` из patronum; приватные юниты для тестов — в секции `__`.
- Операторы: только `sample` / `combine` / patronum; `watch` / `on` не используются.
- API-слой на farfetched: в слайсе `api/schema.ts` (zod-схемы) + `api/request.ts` (фабрики `createXxxQuery` / `createXxxMutation` через `createJsonQuery` / `createJsonMutation` + локальный `zodContract`). URL-билдеры — `shared/api/url.ts` от `import.meta.env.VITE_API_URL`.
- Эталон (`pages/home`):
  - запрос поста на jsonplaceholder, zod-схема ответа;
  - `chainRoute`: экран открывается после готовности данных;
  - `$data / $error / $pending` в outputs; сброс при закрытии роута;
  - UI: лоадер → данные или ошибка.

## UI: React Aria Components + Tailwind 4

- Примитивы в `shared/ui`; эталон `button`: RAC `Button` + `cva`-варианты (`primary`, `secondary`, `ghost`) + `cn()`.
- `cn` — re-export clsx из `shared/lib/cn`; прямой импорт `clsx` запрещён (`no-restricted-imports`).
- Tailwind 4 через `@tailwindcss/vite`: токены — CSS-переменные в `app/index.css` (`@theme`), тема — `[data-theme='dark']` с переопределением переменных. Data-атрибуты RAC используются напрямую (`data-[pressed]:...`); плагин `tailwindcss-react-aria-components` (v3-эпоха) не нужен.
- `BaseLayout` (`layouts/base`): шапка с навигацией (`Link` из `@effector/router-react`) + `<main>`; применяется через `withLayout`.
- `<I18nProvider locale="ru-RU">` в `application.tsx`. Тексты — хардкод на русском.

## Тесты

- `vitest.config.ts`: jsdom, `globals: true`, `setupFiles: ['./vitest.setup.ts']`, `include: ['src/**/*.{test,spec}.{ts,tsx}']`, resolve-алиас `@`, react-плагин с babel-effector.
- `vitest.setup.ts`: `@testing-library/jest-dom`, полифиллы `matchMedia`, `ResizeObserver`, `IntersectionObserver`.
- Расположение: рядом с кодом — `<slice>/__tests__/*.test.ts` (модели), `ui/*.test.tsx` (компоненты).
- Эталоны:
  - модель home: `fork({ handlers })` с моком farfetched `executeFx` → `allSettled` → `scope.getState`;
  - кнопка: RTL `render` + `getByRole('button')` + проверка вариантов.
- Скрипты: `test` (watch), `test:run`, `test:ui`, `test:coverage`.

## Тулинг и окружение

- pnpm единственный менеджер: `preinstall: npx only-allow pnpm`, `packageManager: pnpm@10.15.0` (версия на машине пользователя).
- ESLint 10 flat (`eslint.config.ts`): typescript-eslint recommended, `plugin:effector/{recommended,react,scope,future,patronum}`, `unicorn/filename-case: kebabCase`, `no-restricted-imports` (clsx → `@/shared/lib/cn`), `eslint-config-prettier` последним.
- Prettier: `printWidth: 120`, `trailingComma: "all"`, `semi: true`, `tabWidth: 2`, плагин sort-imports с importOrder по слоям FSD.
- Git: репозиторий не инициализирован — `git init` в начале работ. husky 9 (`prepare`), lint-staged (`eslint --fix` + `prettier --write`), pre-commit также гоняет `tsc --noEmit`; commitlint conventional.
- Скрипты package.json: `start:dev` (vite), `build` (typecheck + vite build), `preview`, `lint`, `lint:fix`, `format`, `format:fix`, `typecheck`, тесты (см. выше).
- `.env.sample`: `VITE_API_URL`, `VITE_URL`, `VITE_PORT`; типизация в `src/vite-env.d.ts` через `interface ImportMetaEnv`.

## Успешные критерии

1. `pnpm install && pnpm start:dev` — приложение запускается, навигация `/` ↔ `/about` работает, unknown-путь → not-found.
2. Страница `home` загружает данные (jsonplaceholder) через farfetched с zod-валидацией; до готовности — лоадер; при ошибке API — состояние ошибки.
3. `pnpm test:run` — все эталонные тесты зелёные (модель + кнопка + при возможности роутинг).
4. `pnpm lint && pnpm typecheck && pnpm build` — без ошибок.
5. `git commit` проходит хуки (lint-staged + commitlint).

## Риски / открытые вопросы (решить при реализации)

- Точный способ передачи babel-плагинов в @vitejs/plugin-react 6 (oxc) — при проблеме использовать `@rolldown/plugin-babel`.
- Источник history-инстанса для `historyAdapter` (пакет `history` или экспорт роутера).
- Наличие `otherwise` в `createRoutesView` нового роутера (fallback — wildcard-маршрут).
- Поведение `withLayout` (props `children` vs `Outlet`) — сверить с типами.
