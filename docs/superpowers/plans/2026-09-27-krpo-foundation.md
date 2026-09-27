# krpo Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Рабочая основа SPA на React + Vite + Effector + @effector/router + React Aria Components + Vitest с архитектурой FSD и эталонными примерами (модель-фабрика, farfetched-запрос, UI-примитив, тесты).

**Architecture:** FSD-слои `app → pages → layouts/widgets → features/entities → shared`, один алиас `@/*` → `src/*`. Модели — фабрики `@withease/factories` с контрактом `{ inputs, outputs }`, инстанцируются `invoke()` на уровне модуля слайса. CSR без fork в проде; старт приложения через событие `appStarted`. Роутинг `@effector/router` (роуты с path при создании, история через `historyAdapter`), данные — farfetched + zod 4 (локальный `zodContract`).

**Tech Stack:** React 19, Vite 8, TypeScript 5.9, effector 23 + patronum + @withease/factories, @effector/router 1.x, @farfetched/core 0.15, zod 4, react-aria-components 1.x, Tailwind 4 (@tailwindcss/vite), Vitest 5, ESLint 10 flat + typescript-eslint 8 + eslint-plugin-effector, Prettier + sort-imports, pnpm 10.

**Spec:** `docs/superpowers/specs/2026-09-27-foundation-design.md`

## Global Constraints

- Менеджер пакетов — только pnpm (`preinstall: npx only-allow pnpm`, `packageManager: pnpm@10.15.0`).
- Установка зависимостей — командами `pnpm add` (версии резолвятся npm; контрольные версии из спеки: react ^19.3, vite ^8.3, typescript ~5.9, effector ^23.4, @effector/router ^1.2, @farfetched/core ^0.15, zod ^4.6, tailwindcss ^4.3, vitest ^5, eslint ^10).
- TypeScript 5.9 (НЕ 7): `~5.9.3` — typescript-eslint 8.x поддерживает TS < 6.1.
- zod 4 обязателен (peer `@effector/router`); `@farfetched/zod` НЕ ставить (требует zod ^3.19) — вместо него локальный `zodContract` в `src/shared/lib/contracts/zod.ts`.
- Файлы — kebab-case; слайсы FSD: сегменты `api / model / ui / lib`, публичный API — только через `index.ts`.
- Импорты только вниз по слоям: `app → pages → layouts/widgets → features → entities → shared`. Внутри слоя — относительные пути; между слоями — `@/`.
- Модели: только `sample` / `combine` / patronum; никаких `watch` / `on` / `forward` / `guard`.
- Прямой импорт `clsx` запрещён — только `cn` из `@/shared/lib/cn`.
- Коммиты — conventional (commitlint), каждый таск завершается коммитом.
- Скрипты package.json: `start:dev`, `start:prod`, `build`, `lint`, `lint:fix`, `format`, `format:fix`, `typecheck`, `test`, `test:run`, `test:ui`, `test:coverage`.

---

### Task 1: Скелет проекта и зависимости

**Files:**

- Create: `package.json`, `.gitignore`, `.npmrc`

**Interfaces:**

- Consumes: git-репозиторий (уже инициализирован, ветка `main`, есть коммит спеки).
- Produces: установленный `node_modules`; package.json со всеми зависимостями и скриптами из Global Constraints (используются всеми последующими задачами).

- [ ] **Step 1: Создать package.json со скриптами**

```bash
cd /Users/vadimkhalikov/Documents/Development/krpo
cat > package.json <<'EOF'
{
  "name": "krpo",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "packageManager": "pnpm@10.15.0",
  "sideEffects": ["./*/**/[!index].*"],
  "scripts": {
    "preinstall": "npx only-allow pnpm",
    "prepare": "husky",
    "start:dev": "vite",
    "start:prod": "vite preview",
    "build": "tsc --noEmit && vite build",
    "lint": "eslint \"./src/**/**.{ts,tsx,js,jsx,json}\"",
    "lint:fix": "eslint --fix \"./src/**/**.{ts,tsx,js,jsx,json}\"",
    "format": "prettier \"./src/**/**.{ts,tsx,js,jsx,json}\"",
    "format:fix": "prettier --write \"./src/**/**.{ts,tsx,js,jsx,json}\"",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
EOF
```

- [ ] **Step 2: Создать .gitignore**

```bash
cat > .gitignore <<'EOF'
node_modules
dist
coverage
*.local
.env
.env.*
!.env.sample
stats.html
.vite
.idea
.DS_Store
EOF
```

- [ ] **Step 3: Установить runtime-зависимости**

```bash
pnpm add react react-dom effector effector-react patronum effector-action @withease/factories @effector/router @effector/router-react query-string zod @farfetched/core react-aria-components @react-aria/i18n class-variance-authority clsx history
```

Ожидание: установка без peer-конфликтов. Если pnpm сообщит о конфликте peer-зависимостей — НЕ продолжать, разобраться (ожидалось: все совместимы, проверено по npm).

- [ ] **Step 4: Установить dev-зависимости**

```bash
pnpm add -D vite @vitejs/plugin-react typescript vitest @vitest/ui @vitest/coverage-v8 jsdom @testing-library/react @testing-library/dom @testing-library/jest-dom tailwindcss @tailwindcss/vite eslint typescript-eslint eslint-plugin-effector eslint-plugin-unicorn eslint-config-prettier prettier @trivago/prettier-plugin-sort-imports husky lint-staged @commitlint/cli @commitlint/config-conventional @types/react @types/react-dom @types/node @rolldown/plugin-babel @babel/core
```

- [ ] **Step 5: Разрешить build-скрипты нативных пакетов**

pnpm 10 блокирует postinstall-скрипты. После установки выполнить `pnpm install` ещё раз и посмотреть предупреждение «Ignored build scripts». Добавить в package.json (в корень объекта) разрешение только для реально используемых:

```json
"pnpm": {
  "onlyBuiltDependencies": ["esbuild", "rolldown", "oxc-transform", "@tailwindcss/oxide"]
}
```

Затем: `pnpm install` — предупреждение должно исчезнуть.

- [ ] **Step 6: Проверить установку**

```bash
pnpm typecheck
```

Ожидание: `tsc --noEmit` без ошибок (файлов ещё нет) — команда может выдать «No inputs were found»; это нормально, ошибка TS18003 не блокирует. Если вывелась именно она — считать успехом.

- [ ] **Step 7: Commit**

```bash
git add package.json .gitignore pnpm-lock.yaml
git commit -m "chore: init package with deps and scripts"
```

Если pre-commit хук ещё не настроен (husky появится в Task 4) и коммит падает с ошибкой хука — коммитить с `--no-verify`.

---

### Task 2: TypeScript, Vite, точка входа приложения

**Files:**

- Create: `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `.env.sample`, `src/vite-env.d.ts`, `src/app/main.tsx`, `src/app/application.tsx`, `src/app/index.css`

**Interfaces:**

- Consumes: package.json со скриптами (Task 1).
- Produces: сборка Vite; алиас `@/*` → `src/*`; компонент `App` в `src/app/application.tsx` (Task 6 встроит в него роутинг); `src/app/index.css` с `@import "tailwindcss"` (Task 7 добавит токены).

- [ ] **Step 1: Создать tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ESNext"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": false,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": "src",
    "paths": {
      "@/*": ["./*"]
    },
    "types": ["node", "vitest/globals"]
  },
  "include": ["src", "vitest.setup.ts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 2: Создать tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowSyntheticDefaultImports": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts", "vitest.config.ts", "eslint.config.ts"]
}
```

- [ ] **Step 3: Создать vite.config.ts**

`@vitejs/plugin-react` 6 работает на oxc и НЕ принимает babel-плагины, поэтому `effector/babel-plugin` подключается через первый плагин Vite 8 — `@rolldown/plugin-babel`.

```ts
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";

  return {
    plugins: [
      react(),
      babel({
        include: /\.(ts|tsx)$/,
        plugins: [["effector/babel-plugin", { factories: ["@withease/factories"] }]],
      }),
      tailwindcss(),
    ],
    resolve: {
      // В Vite 8 по умолчанию выключено — без этого dev-сервер не резолвит алиас @/*
      // из tsconfig paths (build при этом работает).
      tsconfigPaths: true,
    },
    server: isDev ? { port: 5173 } : undefined,
  };
});
```

Примечания (выяснены при имплементации): в `@rolldown/plugin-babel@0.2.4` НЕТ именованного экспорта `babel` — импортировать default (`import babel from ...`). Если dev-сервер не стартует из-за babel-плагина — сузить include до `src/**`, и только если не помогло — убрать `@rolldown/plugin-babel` (babel-плагин нужен только для стабильных SID; для CSR это оптимизация) и удалить его из зависимостей вместе с `@babel/core`.

- [ ] **Step 4: Создать index.html**

```html
<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>krpo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/app/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Создать .env.sample**

```
VITE_API_URL=https://api.example.com
VITE_URL=localhost
VITE_PORT=5173
```

- [ ] **Step 6: Создать src/vite-env.d.ts**

```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_URL: string;
  readonly VITE_PORT: string;
}

interface ImportMeta {
  readonly env: Readonly<ImportMetaEnv>;
}
```

- [ ] **Step 7: Создать точку входа (временная заглушка)**

`src/app/index.css` (токены добавит Task 7):

```css
@import "tailwindcss";
```

`src/app/application.tsx` (Task 6 добавит провайдеры и роутинг):

```tsx
export const App = () => {
  return <div className="p-6 text-2xl font-semibold">krpo</div>;
};
```

`src/app/main.tsx`:

```tsx
import { createRoot } from "react-dom/client";

import { App } from "./application";
import "./index.css";

const container = document.querySelector("#root");
if (!container) {
  throw new Error("Root container #root not found");
}

createRoot(container).render(<App />);
```

- [ ] **Step 8: Проверить сборку**

```bash
pnpm build
```

Ожидание: `tsc --noEmit` + `vite build` проходят без ошибок, в `dist/` появляется `index.html` и бандл.

- [ ] **Step 9: Smoke-проверка dev-сервера**

```bash
pnpm exec vite --port 5199 > /tmp/vite-dev.log 2>&1 &
VITE_PID=$!
sleep 4
curl -sf http://localhost:5199/ | grep -q '<div id="root">' && echo "DEV OK"
kill $VITE_PID
```

Ожидание: `DEV OK`.

- [ ] **Step 10: Commit**

```bash
git add tsconfig.json tsconfig.node.json vite.config.ts index.html .env.sample src
git commit -m "feat: vite + ts setup with app entry"
```

---

### Task 3: Vitest-инфраструктура + shared-хелперы (TDD)

**Files:**

- Create: `vitest.config.ts`, `vitest.setup.ts`, `src/shared/lib/cn.ts`, `src/shared/lib/guards.ts`, `src/shared/lib/__tests__/guards.test.ts`

**Interfaces:**

- Consumes: tsconfig (алиас `@/*`), vitest-зависимости (Task 1).
- Produces: работающий vitest (все последующие тестовые задачи); `cn(...classes)` из `@/shared/lib/cn` (Task 7); `isNonNullable(value): value is NonNullable<T>` из `@/shared/lib/guards` (Task 8 использует в sample-фильтрах при необходимости).

- [ ] **Step 1: Создать vitest.config.ts**

```ts
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
```

Примечание: babel-плагин effector здесь не нужен — тесты форкают по ссылкам на юниты, SID не используются.

- [ ] **Step 2: Создать vitest.setup.ts**

```ts
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}

class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

if (typeof window !== "undefined" && !window.ResizeObserver) {
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}

class IntersectionObserverMock {
  root = null;
  rootMargin = "";
  thresholds = [];
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn();
}

if (typeof window !== "undefined" && !window.IntersectionObserver) {
  window.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;
}
```

- [ ] **Step 3: Написать падающий тест guards**

`src/shared/lib/__tests__/guards.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { isNonNullable } from "../guards";

describe("isNonNullable", () => {
  it("passes for non-null values", () => {
    expect(isNonNullable(0)).toBe(true);
    expect(isNonNullable("")).toBe(true);
    expect(isNonNullable(false)).toBe(true);
  });

  it("fails for null and undefined", () => {
    expect(isNonNullable(null)).toBe(false);
    expect(isNonNullable(undefined)).toBe(false);
  });

  it("narrows the type", () => {
    const value: string | null = "text";
    if (isNonNullable(value)) {
      expect(value.length).toBe(4);
    }
  });
});
```

- [ ] **Step 4: Убедиться, что тест падает**

```bash
pnpm test:run
```

Ожидание: FAIL — `Failed to resolve import "../guards"` (файла ещё нет).

- [ ] **Step 5: Реализовать guards и cn**

`src/shared/lib/guards.ts`:

```ts
export const isNonNullable = <T>(value: T): value is NonNullable<T> => value !== null && value !== undefined;
```

`src/shared/lib/cn.ts` (re-export; прямой импорт clsx запрещён правилом из Task 4):

```ts
// eslint-disable-next-line no-restricted-imports
export { default as cn } from "clsx";
```

- [ ] **Step 6: Убедиться, что тест проходит**

```bash
pnpm test:run
```

Ожидание: PASS (3 tests), `Test Files 1 passed`.

- [ ] **Step 7: Commit**

```bash
git add vitest.config.ts vitest.setup.ts src/shared
git commit -m "feat: vitest setup with shared cn and guards helpers"
```

---

### Task 4: ESLint, Prettier, git-хуки

**Files:**

- Create: `eslint.config.ts`, `.prettierrc`, `.lintstagedrc`, `.commitlintrc.json`, `.husky/pre-commit`, `.husky/commit-msg`

**Interfaces:**

- Consumes: tsconfig (для projectService), package.json scripts (Task 1).
- Produces: `pnpm lint` / `pnpm format` работают на всех последующих задачах; pre-commit гоняет lint-staged + typecheck; commit-msg — commitlint.

- [ ] **Step 1: Создать eslint.config.ts (flat)**

У `eslint-plugin-effector@0.19` правила в конфигах уже с префиксом `effector/` — их можно раскладывать напрямую в flat config.

```ts
import eslintConfigPrettier from "eslint-config-prettier";
import effector from "eslint-plugin-effector";
import unicorn from "eslint-plugin-unicorn";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { effector, unicorn },
    rules: {
      ...effector.configs.recommended.rules,
      ...effector.configs.react.rules,
      ...effector.configs.scope.rules,
      ...effector.configs.future.rules,
      ...effector.configs.patronum.rules,
      "unicorn/filename-case": ["error", { case: "kebabCase" }],
      "unicorn/no-nested-ternary": "error",
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "clsx",
              message: "Please use cn from @/shared/lib/cn instead.",
            },
          ],
        },
      ],
    },
  },
  eslintConfigPrettier,
);
```

Примечание для исполнителя: если `effector.configs.recommended.rules` не существует (структура конфигов изменилась) — посмотреть фактические ключи через `node -e "console.log(Object.keys(require('eslint-plugin-effector').configs))"` и взять соответствующие пресеты. Если правило `effector/mandatory-scope-binding` из пресета `react` даёт ложные срабатывания (приложение CSR без Provider) — отключить его точечно с комментарием.

- [ ] **Step 2: Создать .prettierrc**

importOrder — машиночитаемая спецификация слоёв FSD (как в metrico).

```json
{
  "importOrderSortSpecifiers": true,
  "importOrderGroupNamespaceSpecifiers": true,
  "importOrderCaseInsensitive": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "useTabs": false,
  "arrowParens": "always",
  "printWidth": 120,
  "semi": true,
  "plugins": ["@trivago/prettier-plugin-sort-imports"],
  "importOrder": [
    "<THIRD_PARTY_MODULES>",
    "^@/app",
    "^@/pages",
    "^@/layouts",
    "^@/widgets",
    "^@/features",
    "^@/entities",
    "^@/shared",
    "^[./]"
  ],
  "importOrderSeparation": true,
  "endOfLine": "auto"
}
```

- [ ] **Step 3: Создать конфиги хуков**

`.lintstagedrc`:

```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,css}": ["prettier --write"]
}
```

`.commitlintrc.json`:

```json
{
  "extends": ["@commitlint/config-conventional"]
}
```

- [ ] **Step 4: Инициализировать husky**

```bash
pnpm exec husky init
```

`.husky/pre-commit` — заменить содержимое на:

```sh
pnpm lint-staged
pnpm typecheck
```

Создать `.husky/commit-msg`:

```sh
pnpm exec commitlint --edit "$1"
```

Убедиться, что оба файла исполняемые: `chmod +x .husky/pre-commit .husky/commit-msg`.

- [ ] **Step 5: Проверить линтеры на текущем коде**

```bash
pnpm lint && pnpm format && pnpm typecheck
```

Ожидание: без ошибок. При замечаниях — исправить (не отключать правила без причины).

- [ ] **Step 6: Проверить хуки реальным коммитом**

```bash
git add -A
git commit -m "bad message"
```

Ожидание: коммит ОТКЛОНЁН commitlint (не соответствует conventional). Затем:

```bash
git commit -m "chore: eslint, prettier and git hooks setup"
```

Ожидание: коммит проходит (хуки зелёные).

- [ ] **Step 7: Commit**

Коммит из Step 6 уже создан — дополнительный не нужен.

---

### Task 5: appStarted, url-билдеры, zodContract (TDD)

**Files:**

- Create: `src/shared/config/init/index.ts`, `src/shared/api/url.ts`, `src/shared/api/index.ts`, `src/shared/lib/contracts/zod.ts`, `src/shared/lib/contracts/index.ts`, `src/shared/lib/__tests__/zod-contract.test.ts`, `src/shared/lib/index.ts`

**Interfaces:**

- Consumes: vitest (Task 3).
- Produces:
  - `appStarted: EventCallable<void>` из `@/shared/config/init` (Task 6 — точка старта роутера);
  - `buildUrl(url: string): string` из `@/shared/api`;
  - `zodContract<Data>(schema: z.ZodType<Data>): Contract<unknown, Data>` из `@/shared/lib/contracts` (Task 8 — контракты farfetched).

- [ ] **Step 1: Написать падающий тест zodContract**

`src/shared/lib/__tests__/zod-contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";

import { zodContract } from "../contracts/zod";

describe("zodContract", () => {
  const contract = zodContract(z.object({ id: z.number(), title: z.string() }));

  it("isData returns true for valid data", () => {
    expect(contract.isData({ id: 1, title: "text" })).toBe(true);
  });

  it("isData returns false for invalid data", () => {
    expect(contract.isData({ id: "1", title: "text" })).toBe(false);
    expect(contract.isData(null)).toBe(false);
    expect(contract.isData({})).toBe(false);
  });

  it("getErrorMessages reports field issues", () => {
    const messages = contract.getErrorMessages?.({ id: "1" }) ?? [];
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.some((message) => message.includes("id"))).toBe(true);
  });
});
```

- [ ] **Step 2: Убедиться, что тест падает**

```bash
pnpm test:run src/shared/lib/__tests__/zod-contract.test.ts
```

Ожидание: FAIL — модуль `../contracts/zod` не найден.

- [ ] **Step 3: Реализовать**

`src/shared/lib/contracts/zod.ts`:

```ts
import type { Contract } from "@farfetched/core";
import type { z } from "zod";

export const zodContract = <Data>(schema: z.ZodType<Data>): Contract<unknown, Data> => ({
  isData: (raw): raw is Data => schema.safeParse(raw).success,
  getErrorMessages: (raw) => {
    const result = schema.safeParse(raw);

    return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  },
});
```

`src/shared/lib/contracts/index.ts`:

```ts
export { zodContract } from "./zod";
```

`src/shared/config/init/index.ts`:

```ts
import { createEvent } from "effector";

export const appStarted = createEvent<void>();
```

`src/shared/api/url.ts`:

```ts
const BASE_URL = import.meta.env.VITE_API_URL;

export const buildUrl = (url: string) => `${BASE_URL}${url}`;
```

`src/shared/api/index.ts`:

```ts
export { buildUrl } from "./url";
```

`src/shared/lib/index.ts`:

```ts
export { cn } from "./cn";
export { isNonNullable } from "./guards";
```

- [ ] **Step 4: Убедиться, что тесты проходят**

```bash
pnpm test:run
```

Ожидание: PASS (guards 3 + zodContract 3).

- [ ] **Step 5: Commit**

```bash
git add src/shared
git commit -m "feat: shared appStarted, url builders and zod contract"
```

---

### Task 6: Роутинг @effector/router, страницы, BaseLayout

**Files:**

- Create: `src/shared/routes/routes.ts`, `src/shared/routes/index.ts`, `src/layouts/base/ui/page.tsx`, `src/layouts/base/ui/index.ts`, `src/layouts/base/index.ts`, `src/pages/not-found/ui/page.tsx`, `src/pages/not-found/ui/index.ts`, `src/pages/not-found/index.ts`, `src/pages/about/ui/page.tsx`, `src/pages/about/ui/index.ts`, `src/pages/about/index.ts`, `src/pages/home/ui/page.tsx`, `src/pages/home/ui/index.ts`, `src/pages/home/index.ts`, `src/pages/routing.tsx`, `src/pages/index.ts`
- Modify: `src/app/application.tsx`, `src/app/main.tsx`

**Interfaces:**

- Consumes: `appStarted` (Task 5).
- Produces:
  - `routes: { home: Route<{}>; about: Route<{}>; notFound: PathlessRoute<{}> }` и `router` из `@/shared/routes` (Task 8 использует `routes.home` в модели);
  - `BaseLayout` из `@/layouts/base`;
  - `Routing` из `@/pages`;
  - `HomePage` из `@/pages/home` (Task 8 перепишет на данные из модели);
  - Приложение: `/` → главная, `/about` → о проекте, неизвестный путь → 404.

- [ ] **Step 1: Создать роуты**

`src/shared/routes/routes.ts` — история подключается по `appStarted` (как в metrico):

```ts
import { createRoute, createRouter, historyAdapter } from "@effector/router";
import { sample } from "effector";
import { createBrowserHistory } from "history";

import { appStarted } from "../config/init";

export const routes = {
  home: createRoute({ path: "/" }),
  about: createRoute({ path: "/about" }),
  notFound: createRoute(),
};

export const router = createRouter({
  routes: [routes.home, routes.about],
  notFound: routes.notFound,
});

sample({
  clock: appStarted,
  fn: () => historyAdapter(createBrowserHistory()),
  target: router.setHistory,
});
```

`src/shared/routes/index.ts`:

```ts
export { routes, router } from "./routes";
```

- [ ] **Step 2: Создать BaseLayout**

`src/layouts/base/ui/page.tsx`:

```tsx
import { Link } from "@effector/router-react";
import { type ReactNode } from "react";

import { routes } from "@/shared/routes";

export const BaseLayout = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-dvh bg-surface-page text-text-base">
      <header className="border-b border-border-base px-6 py-4">
        <nav className="flex gap-6">
          <Link to={routes.home} className="text-sm font-medium text-text-base hover:text-system-primary">
            Главная
          </Link>
          <Link to={routes.about} className="text-sm font-medium text-text-base hover:text-system-primary">
            О проекте
          </Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-4xl p-6">{children}</main>
    </div>
  );
};
```

`src/layouts/base/ui/index.ts`:

```ts
export { BaseLayout } from "./page";
```

`src/layouts/base/index.ts`:

```ts
export { BaseLayout } from "./ui";
```

- [ ] **Step 3: Создать страницы**

`src/pages/not-found/ui/page.tsx`:

```tsx
import { Link } from "@effector/router-react";

import { routes } from "@/shared/routes";

export const NotFoundPage = () => {
  return (
    <section className="flex flex-col items-center gap-4 py-16">
      <h1 className="text-3xl font-semibold">404</h1>
      <p className="text-text-caption">Страница не найдена</p>
      <Link to={routes.home} className="text-system-primary underline">
        На главную
      </Link>
    </section>
  );
};
```

`src/pages/not-found/ui/index.ts`:

```ts
export { NotFoundPage } from "./page";
```

`src/pages/not-found/index.ts`:

```ts
export { NotFoundPage } from "./ui";
```

`src/pages/about/ui/page.tsx`:

```tsx
export const AboutPage = () => {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">О проекте</h1>
      <p className="text-text-caption">
        Основа: React + Vite + Effector + @effector/router + React Aria Components + Vitest. Архитектура — FSD.
      </p>
    </section>
  );
};
```

`src/pages/about/ui/index.ts`:

```ts
export { AboutPage } from "./page";
```

`src/pages/about/index.ts`:

```ts
export { AboutPage } from "./ui";
```

`src/pages/home/ui/page.tsx` (временная статичная версия; Task 8 перепишет):

```tsx
export const HomePage = () => {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Главная</h1>
      <p className="text-text-caption">Здесь появится пример данных из API.</p>
    </section>
  );
};
```

`src/pages/home/ui/index.ts`:

```ts
export { HomePage } from "./page";
```

`src/pages/home/index.ts`:

```ts
export { HomePage } from "./ui";
```

- [ ] **Step 4: Собрать routing.tsx**

`withLayout` принимает layout с пропом `children`; `otherwise` срабатывает, когда ни один экран не активен (в Task 8 это состояние «чейн грузится» — покажем спиннер).

`src/pages/routing.tsx`:

```tsx
import { createRoutesView, createRouteView, withLayout } from "@effector/router-react";

import { BaseLayout } from "@/layouts/base";

import { routes } from "@/shared/routes";

import { AboutPage } from "./about";
import { HomePage } from "./home";
import { NotFoundPage } from "./not-found";

const PageLoader = () => {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <span className="size-8 animate-spin rounded-full border-2 border-border-base border-t-system-primary" />
    </div>
  );
};

export const Routing = createRoutesView({
  routes: withLayout(BaseLayout, [
    createRouteView({ route: routes.home, view: HomePage }),
    createRouteView({ route: routes.about, view: AboutPage }),
    createRouteView({ route: routes.notFound, view: NotFoundPage }),
  ]),
  otherwise: PageLoader,
});
```

`src/pages/index.ts`:

```ts
export { Routing } from "./routing";
```

- [ ] **Step 5: Обновить application.tsx и main.tsx**

`src/app/application.tsx` (полностью заменить):

```tsx
import { RouterProvider } from "@effector/router-react";
import { I18nProvider } from "@react-aria/i18n";

import { Routing } from "@/pages";

import { router } from "@/shared/routes";

import "./index.css";

export const App = () => {
  return (
    <I18nProvider locale="ru-RU">
      <RouterProvider router={router}>
        <Routing />
      </RouterProvider>
    </I18nProvider>
  );
};
```

`src/app/main.tsx` (полностью заменить):

```tsx
import { createRoot } from "react-dom/client";

import { appStarted } from "@/shared/config/init";

import { App } from "./application";

const container = document.querySelector("#root");
if (!container) {
  throw new Error("Root container #root not found");
}

appStarted();
createRoot(container).render(<App />);
```

- [ ] **Step 6: Smoke-проверка навигации**

```bash
pnpm build && pnpm exec vite preview --port 5198 > /tmp/vite-preview.log 2>&1 &
VITE_PID=$!
sleep 3
curl -sf http://localhost:5198/ | grep -q '<div id="root">' && echo "PREVIEW OK"
kill $VITE_PID
```

Ожидание: `PREVIEW OK`. Плюс ручная проверка в браузере (`pnpm start:dev`, открыть `http://localhost:5173`): переходы Главная ↔ О проекте, неизвестный путь (`/xyz`) → 404. Спиннер до первого открытия роута.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: effector router with base layout and pages"
```

---

### Task 7: Tailwind-токены, тема, кнопка на RAC (TDD)

**Files:**

- Modify: `src/app/index.css`, `src/pages/about/ui/page.tsx`
- Create: `src/shared/ui/button/ui.tsx`, `src/shared/ui/button/ui.test.tsx`, `src/shared/ui/button/index.ts`, `src/shared/ui/index.ts`, `src/shared/ui/test-utils.tsx`

**Interfaces:**

- Consumes: `cn` из `@/shared/lib/cn` (Task 3), vitest+RTL (Task 3).
- Produces:
  - CSS-токены Tailwind: утилиты `bg-surface-page`, `bg-surface-base`, `text-text-base`, `text-text-caption`, `border-border-base`, `bg-system-primary`, `bg-system-primary-hover` уже использованы в Task 6 — здесь они появляются; тема через `data-theme="dark"` на `<body>`;
  - `Button` из `@/shared/ui/button` с пропами RAC Button + `variant: "primary" | "secondary" | "ghost"` (Task 8 использует на странице ошибок);
  - `userEventSetup()` из `@/shared/ui/test-utils` (обёртка над `@testing-library/user-event`).

- [ ] **Step 1: Установить @testing-library/user-event**

```bash
pnpm add -D @testing-library/user-event
```

- [ ] **Step 2: Написать падающий тест кнопки**

`src/shared/ui/test-utils.tsx` (хелпер для user-event, используется тестами компонентов):

```tsx
import userEvent from "@testing-library/user-event";

export const userEventSetup = () => userEvent.setup();
```

`src/shared/ui/button/ui.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { userEventSetup } from "../test-utils";
import { Button } from "./ui";

describe("Button", () => {
  it("renders children as accessible button", () => {
    render(<Button>Нажми меня</Button>);

    expect(screen.getByRole("button", { name: "Нажми меня" })).toBeInTheDocument();
  });

  it("applies variant classes", () => {
    render(<Button variant="secondary">Вторичная</Button>);

    expect(screen.getByRole("button")).toHaveClass("border");
  });

  it("supports RAC isDisabled", () => {
    render(<Button isDisabled>Недоступна</Button>);

    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("handles onPress", async () => {
    const onPress = vi.fn();
    const user = userEventSetup();

    render(<Button onPress={onPress}>Клик</Button>);
    await user.click(screen.getByRole("button"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Убедиться, что тест падает**

```bash
pnpm test:run src/shared/ui/button/ui.test.tsx
```

Ожидание: FAIL — `./ui` не найден.

- [ ] **Step 4: Добавить токены в index.css**

`src/app/index.css` (полностью заменить):

```css
@import "tailwindcss";

:root {
  --surface-page: #f7f8fa;
  --surface-base: #ffffff;
  --text-base-color: #1a1d21;
  --text-caption-color: #667085;
  --border-base: #e4e7ec;
  --system-primary: #2563eb;
  --system-primary-hover: #1d4ed8;
}

[data-theme="dark"] {
  --surface-page: #101214;
  --surface-base: #191c20;
  --text-base-color: #f2f4f7;
  --text-caption-color: #98a2b3;
  --border-base: #2b3038;
  --system-primary: #3b82f6;
  --system-primary-hover: #60a5fa;
}

@theme inline {
  --color-surface-page: var(--surface-page);
  --color-surface-base: var(--surface-base);
  --color-text-base: var(--text-base-color);
  --color-text-caption: var(--text-caption-color);
  --color-border-base: var(--border-base);
  --color-system-primary: var(--system-primary);
  --color-system-primary-hover: var(--system-primary-hover);
}
```

`@theme inline` сохраняет ссылки `var(...)` в утилитах — тема переключается заменой CSS-переменных через `data-theme` без пересборки. Raw-переменные текста называются `--text-*-color`: префикс `--text-*` — это namespace font-size-токенов Tailwind 4, наивные `--text-base`/`--text-caption` в unlayered `:root` молча ломают утилиту `text-base`.

- [ ] **Step 5: Реализовать кнопку**

`src/shared/ui/button/ui.tsx`:

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { type ComponentProps } from "react";
import { Button as AriaButton } from "react-aria-components";

import { cn } from "@/shared/lib/cn";

const button = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-system-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-system-primary text-white hover:bg-system-primary-hover",
        secondary: "border border-border-base bg-surface-base text-text-base hover:bg-surface-page",
        ghost: "text-text-base hover:bg-surface-page",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

export type ButtonProps = ComponentProps<typeof AriaButton> & VariantProps<typeof button>;

export const Button = ({ className, variant, ...props }: ButtonProps) => {
  return <AriaButton className={cn(button({ variant }), className)} {...props} />;
};
```

`src/shared/ui/button/index.ts`:

```ts
export { Button, type ButtonProps } from "./ui";
```

`src/shared/ui/index.ts`:

```ts
export { Button, type ButtonProps } from "./button";
```

- [ ] **Step 6: Убедиться, что тест проходит**

```bash
pnpm test:run
```

Ожидание: PASS — все файлы (guards, zod-contract, button).

- [ ] **Step 7: Использовать кнопку на странице about**

`src/pages/about/ui/page.tsx` (полностью заменить):

```tsx
import { Button } from "@/shared/ui/button";

export const AboutPage = () => {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">О проекте</h1>
      <p className="text-text-caption">
        Основа: React + Vite + Effector + @effector/router + React Aria Components + Vitest. Архитектура — FSD.
      </p>
      <div>
        <Button
          variant="secondary"
          onPress={() => {
            document.body.dataset.theme = document.body.dataset.theme === "dark" ? "light" : "dark";
          }}
        >
          Переключить тему
        </Button>
      </div>
    </section>
  );
};
```

- [ ] **Step 8: Проверить сборку и линтер**

```bash
pnpm build && pnpm lint
```

Ожидание: без ошибок.

- [ ] **Step 9: Commit**

```bash
git add src pnpm-lock.yaml package.json
git commit -m "feat: tailwind tokens with dark theme and rac button"
```

---

### Task 8: Модель home: farfetched + zod + chainRoute (TDD)

**Files:**

- Create: `src/pages/home/api/schema.ts`, `src/pages/home/api/request.ts`, `src/pages/home/api/index.ts`, `src/pages/home/model/home.ts`, `src/pages/home/model/page.ts`, `src/pages/home/model/index.ts`, `src/pages/home/__tests__/model.test.ts`
- Modify: `src/pages/home/ui/page.tsx`, `src/pages/home/index.ts`, `src/pages/routing.tsx`

**Interfaces:**

- Consumes: `zodContract` (Task 5), `routes.home` (Task 6), `Button` (Task 7), `chainRoute` из `@effector/router`.
- Produces: эталон полной страницы FSD: `api` (zod-схемы + фабрика farfetched-запроса) + `model` (фабрика с контрактом `inputs/outputs`, `invoke()` на уровне модуля, `chainRoute`) + `ui`. Шаблон для всех будущих слайсов.

- [ ] **Step 1: Написать api-слой**

`src/pages/home/api/schema.ts`:

```ts
import { z } from "zod";

export const postSchema = z.object({
  userId: z.number(),
  id: z.number(),
  title: z.string(),
  body: z.string(),
});

export type Post = z.output<typeof postSchema>;
```

`src/pages/home/api/request.ts` (фабрика, как в chatlab; демо-API — jsonplaceholder, работает без бэкенда):

```ts
import { createJsonQuery } from "@farfetched/core";

import { zodContract } from "@/shared/lib/contracts";

import { postSchema } from "./schema";

const POST_URL = "https://jsonplaceholder.typicode.com/posts/1";

export const createPostQuery = () =>
  createJsonQuery({
    request: {
      method: "GET",
      url: POST_URL,
    },
    response: {
      contract: zodContract(postSchema),
    },
  });
```

`src/pages/home/api/index.ts`:

```ts
export { createPostQuery } from "./request";
export { postSchema, type Post } from "./schema";
```

- [ ] **Step 2: Написать падающий тест модели**

`route.open()` в `@effector/router` — это команда навигации, ей нужен роутер с историей. Поэтому каждый тест собирает локальный роутер с `createMemoryHistory()` в scope (роут закрывается переходом на другой роут — команды `close` у роута нет, есть событие `closed`):

`src/pages/home/__tests__/model.test.ts`:

```ts
import { createRoute, createRouter, historyAdapter } from "@effector/router";
import { invoke } from "@withease/factories";
import { allSettled, fork, type Scope } from "effector";
import { createMemoryHistory } from "history";
import { describe, expect, it, vi } from "vitest";

import { createHomePageFactory } from "../model/home";

const post = { userId: 1, id: 1, title: "Заголовок", body: "Текст" };

/** Мок executeFx: farfetched-запросы мокаются на уровне внутреннего эффекта. */
const executeQueryFx = (query: unknown) => (query as { __: { executeFx: never } }).__.executeFx;

const setup = async (handler: () => typeof post) => {
  const route = createRoute({ path: "/" });
  const otherRoute = createRoute({ path: "/other" });
  const router = createRouter({ routes: [route, otherRoute] });

  const $$home = invoke(createHomePageFactory, { route });

  const scope: Scope = fork({
    handlers: [[executeQueryFx($$home.__.postQuery), handler]],
  });

  await allSettled(router.setHistory, { scope, params: historyAdapter(createMemoryHistory()) });

  return { route, otherRoute, scope, $$home };
};

describe("home page model", () => {
  it("loads post and opens chained route on success", async () => {
    const { route, scope, $$home } = await setup(() => post);

    await allSettled(route.open, { scope });

    expect(scope.getState($$home.outputs.readyRoute.$isOpened)).toBe(true);
    expect(scope.getState($$home.outputs.$post)).toEqual(post);
    expect(scope.getState($$home.outputs.$error)).toBeNull();
  });

  it("opens chained route with error state on failure", async () => {
    const { route, scope, $$home } = await setup(() => {
      throw new Error("network");
    });

    await allSettled(route.open, { scope });

    expect(scope.getState($$home.outputs.readyRoute.$isOpened)).toBe(true);
    expect(scope.getState($$home.outputs.$error)).not.toBeNull();
  });

  it("refreshRequested restarts query", async () => {
    const handler = vi.fn(() => post);
    const { route, scope, $$home } = await setup(handler);

    await allSettled(route.open, { scope });
    await allSettled($$home.inputs.refreshRequested, { scope });

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("leaving the route resets query data", async () => {
    const { route, otherRoute, scope, $$home } = await setup(() => post);

    await allSettled(route.open, { scope });
    expect(scope.getState($$home.outputs.$post)).toEqual(post);

    await allSettled(otherRoute.open, { scope });

    expect(scope.getState($$home.outputs.$post)).toBeNull();
  });
});
```

- [ ] **Step 3: Убедиться, что тест падает**

```bash
pnpm test:run src/pages/home/__tests__/model.test.ts
```

Ожидание: FAIL — `../model/home` не найден.

- [ ] **Step 4: Реализовать модель**

`src/pages/home/model/home.ts` — фабрика; `chainRoute`: `beforeOpen` стартует запрос, `openOn` открывает роут по завершению (успех ИЛИ ошибка — страница сама показывает состояние ошибки):

```ts
import { chainRoute, type Route } from "@effector/router";
import { createFactory } from "@withease/factories";
import { createEvent, sample } from "effector";
import { readonly } from "patronum";

import { createPostQuery } from "../api/request";

export const createHomePageFactory = ({ route }: { route: Route }) => {
  const postQuery = createPostQuery();

  const pageLoadStarted = createEvent();
  const refreshRequested = createEvent();

  const readyRoute = chainRoute({
    route,
    beforeOpen: pageLoadStarted,
    openOn: postQuery.finished.finally,
  });

  sample({ clock: pageLoadStarted, target: postQuery.start });
  sample({ clock: refreshRequested, target: postQuery.start });
  sample({ clock: route.closed, target: postQuery.reset });

  return {
    __: { postQuery, readyRoute },
    inputs: { refreshRequested },
    outputs: {
      readyRoute,
      $post: readonly(postQuery.$data),
      $pending: readonly(postQuery.$pending),
      $error: readonly(postQuery.$error),
    },
  };
};
```

`src/pages/home/model/page.ts` — инстанцирование на уровне модуля (singleton, как в metrico):

```ts
import { invoke } from "@withease/factories";

import { routes } from "@/shared/routes";

import { createHomePageFactory } from "./home";

export const $$home = invoke(createHomePageFactory, { route: routes.home });
```

`src/pages/home/model/index.ts`:

```ts
export { $$home } from "./page";
export { createHomePageFactory } from "./home";
```

- [ ] **Step 5: Убедиться, что тесты проходят**

```bash
pnpm test:run src/pages/home/__tests__/model.test.ts
```

Ожидание: PASS (4 tests). Если мок `postQuery.__.executeFx` не срабатывает (farfetched мог изменить внутренний API) — проверить фактические internals: `node -e "import('@farfetched/core').then(m => console.log(Object.keys(m)))"` и способ мока из https://ff.effector.dev (раздел testing); скорректировать мок, не меняя семантику теста.

- [ ] **Step 6: Переписать UI страницы на данные модели**

`src/pages/home/ui/page.tsx` (полностью заменить):

```tsx
import { useUnit } from "effector-react";

import { Button } from "@/shared/ui/button";

import { $$home } from "../model";

export const HomePage = () => {
  const { post, error, refresh } = useUnit({
    post: $$home.outputs.$post,
    error: $$home.outputs.$error,
    refresh: $$home.inputs.refreshRequested,
  });

  if (error) {
    return (
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Не удалось загрузить данные</h1>
        <p className="text-text-caption">Проверьте подключение и попробуйте снова.</p>
        <div>
          <Button onPress={refresh}>Повторить</Button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{post?.title}</h1>
      <p className="whitespace-pre-line text-text-caption">{post?.body}</p>
    </section>
  );
};
```

- [ ] **Step 7: Переключить роутинг на chained-роут**

`src/pages/home/index.ts` (полностью заменить):

```ts
export { HomePage } from "./ui";
export { $$home } from "./model";
```

`src/pages/routing.tsx` — в `createRouteView` для главной использовать чейн-роут (экран активен только после готовности данных):

```tsx
import { createRoutesView, createRouteView, withLayout } from "@effector/router-react";

import { BaseLayout } from "@/layouts/base";

import { routes } from "@/shared/routes";

import { AboutPage } from "./about";
import { $$home } from "./home";
import { HomePage } from "./home";
import { NotFoundPage } from "./not-found";

const PageLoader = () => {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <span className="size-8 animate-spin rounded-full border-2 border-border-base border-t-system-primary" />
    </div>
  );
};

export const Routing = createRoutesView({
  routes: withLayout(BaseLayout, [
    createRouteView({ route: $$home.outputs.readyRoute, view: HomePage }),
    createRouteView({ route: routes.about, view: AboutPage }),
    createRouteView({ route: routes.notFound, view: NotFoundPage }),
  ]),
  otherwise: PageLoader,
});
```

- [ ] **Step 8: Полная проверка таска**

```bash
pnpm test:run && pnpm lint && pnpm typecheck && pnpm build
```

Ожидание: всё зелёное.

- [ ] **Step 9: Ручная smoke-проверка в браузере**

```bash
pnpm start:dev
```

Открыть `http://localhost:5173`: спиннер → данные поста из jsonplaceholder. Проверить: `/about` работает; в DevTools Network перевести в offline и нажать «Повторить» (нужен запуск с ошибкой — например, временно поменять URL на невалидный) — экран ошибки. Вернуть URL, остановить dev-сервер.

- [ ] **Step 10: Commit**

```bash
git add src
git commit -m "feat: home page model with farfetched query and chain route"
```

---

### Task 9: README слоёв и финальная верификация

**Files:**

- Create: `src/widgets/README.md`, `src/features/README.md`, `src/entities/README.md`

**Interfaces:**

- Consumes: всё приложение (Tasks 1–8).
- Produces: документация слоёв FSD для будущих задач; финальная проверка критериев успеха из спеки.

- [ ] **Step 1: Создать README слоёв**

Идентичное содержание для `src/widgets/README.md`, `src/features/README.md`, `src/entities/README.md` (заменить `<СЛОЙ>` на название слоя и указать его назначение из списка ниже):

```markdown
# <СЛОЙ>

## Назначение

- **widgets** — крупные составные блоки страницы (шапка, сайдбар, таблица с фильтрами).
- **features** — пользовательские сценарии (кнопка «Добавить в избранное», форма фильтра).
- **entities** — бизнес-сущности и их модели/интерфейсы (session, user, product).

## Анатомия слайса
```

<slice-name>/
├── api/ # farfetched-запросы: request.ts (фабрики), schema.ts (zod)
├── model/ # effector-модели: фабрики с контрактом { inputs, outputs }
├── ui/ # React-компоненты
├── **tests**/ # тесты моделей
└── index.ts # публичный API слайса — только через него

```

## Правила

- Импорты только вниз: `widgets → features/entities/shared`, `features → entities/shared`, `entities → shared`.
- Внутри слоя — относительные пути; между слоями — `@/`.
- Модели — фабрики `@withease/factories`, инстанцируются `invoke()` один раз на уровне модуля слайса.
- Пример полной страницы-эталона: `src/pages/home`.
```

- [ ] **Step 2: Финальная верификация критериев успеха из спеки**

```bash
pnpm install
pnpm test:run
pnpm lint
pnpm typecheck
pnpm build
```

Ожидание: все команды зелёные.

Ручная проверка (`pnpm start:dev`, открыть `http://localhost:5173`):

1. Главная загружает пост (jsonplaceholder) через farfetched с zod-валидацией; до готовности — спиннер.
2. Навигация `/` ↔ `/about` работает; `/xyz` → 404.
3. Переключение темы на `/about` меняет цвета.

- [ ] **Step 3: Проверить хуки на финальном коммите**

```bash
git add src/widgets/README.md src/features/README.md src/entities/README.md
git commit -m "docs: describe fsd layers anatomy"
```

Ожидание: pre-commit (lint-staged + typecheck) и commit-msg (commitlint) проходят.

---

## Self-Review

Выполнен после написания плана, с исправлениями:

1. **Spec coverage**: стек и версии (Tasks 1–2), тест-инфраструктура (Task 3), тулинг/хуки (Task 4), appStarted/url/zodContract (Task 5), роутинг+layout+страницы (Task 6), Tailwind-токены+тема+RAC-кнопка (Task 7), модель-фабрика+farfetched+chainRoute (Task 8), README слоёв+критерии успеха (Task 9). Все секции спеки покрыты. Пустые слои widgets/features/entities — README в Task 9.
2. **Placeholder scan**: placeholder-паттернов нет. Запасные пути (fallback для @rolldown/plugin-babel, мока executeFx, конфигов effector-plugin) — конкретные действия, а не «TBD».
3. **Type consistency**: `zodContract<Data>(schema): Contract<unknown, Data>` одинаков в Task 5 (реализация) и Task 8 (использование); `routes.home` создаётся в Task 6 с `path: "/"`; `$$home.outputs.readyRoute` из Task 8 используется в `routing.tsx`; `Button` из Task 7 используется в Task 8 (onPress — RAC-проп, не onClick); фабрика модели принимает `route: Route` (без дженерика) — совпадает с использованием `routes.home` и тестовым `createRoute({ path: "/" })`.
4. **Исправлено при self-review**:
   - Task 7: убран запутанный шаг с user-event (ошибочный вариант + правка) — теперь чистая последовательность install → test-utils → тест.
   - Task 8: тесты переведены на паттерн «локальный роутер + `createMemoryHistory()` в scope» — `route.open()` в `@effector/router` требует инициализированной истории; закрытие роута проверяется переходом на `otherRoute` (команды `close` у роута нет).
   - Task 8: тип параметра фабрики упрощён до `Route`.
