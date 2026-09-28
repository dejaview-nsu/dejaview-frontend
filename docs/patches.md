# Разработка

Основа SPA: React + Vite + Effector + @effector/router + React Aria Components + Vitest, архитектура Feature-Sliced Design.

## Команды

| Скрипт       | Назначение                                 |
| ------------ | ------------------------------------------ |
| `start:dev`  | dev-сервер Vite на `http://localhost:5173` |
| `build`      | `tsc --noEmit` + production-сборка Vite    |
| `lint`       | ESLint по `src`                            |
| `typecheck`  | TypeScript без эмиссии                     |
| `test:run`   | Vitest в run-режиме (CI)                   |
| `format:fix` | Prettier с записью изменений               |

# Известные патчи

- `effector@23.4.4` — babel-плагин несовместим с Babel 8 (`@rolldown/plugin-babel`): template-плейсхолдеры `SID`/`NAME`/`METHOD` подставлялись через `JSON.stringify`, что в Babel 8 ломает трансформацию. Патч `patches/effector@23.4.4.patch` заменяет эти подстановки на `t.stringLiteral`; вывод побайтово эквивалентен Babel 7. При апгрейде effector патч снять и проверить сборку (`pnpm build`).
