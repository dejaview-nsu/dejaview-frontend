# widgets

## Назначение

- **widgets** — крупные составные блоки страницы (шапка, сайдбар, таблица с фильтрами).

## Анатомия слайса

```
<slice-name>/
├── api/            # farfetched-запросы: request.ts (фабрики), schema.ts (zod)
├── model/          # effector-модели: фабрики с контрактом { inputs, outputs }
├── ui/             # React-компоненты
└── index.ts        # публичный API слайса — только через него
```

## Правила

- Импорты только вниз: `widgets → features/entities/shared`, `features → entities/shared`, `entities → shared`.
- Внутри слоя — относительные пути; между слоями — `@/`.
- Модели — фабрики `@withease/factories`, инстанцируются `invoke()` один раз на уровне модуля слайса.
- Тесты — в корневом каталоге `tests/`, зеркально структуре `src` (пример: `tests/pages/home/model.test.ts`).
- Пример полной страницы-эталона: `src/pages/home`.
