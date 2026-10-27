export const QUERY_MIN_LENGTH = 3;

export const QUERY_MAX_LENGTH = 250;

export type QueryErrorCode = "QUERY_EMPTY" | "QUERY_TOO_SHORT" | "QUERY_TOO_LONG" | "QUERY_NOT_ALLOWED";

export const queryErrorMessages: Record<QueryErrorCode, string> = {
  QUERY_EMPTY: "Опиши, что помнишь о фильме — минимум 3 символа",
  QUERY_TOO_SHORT: "Запрос слишком короткий — нужно минимум 3 символа",
  QUERY_TOO_LONG: "Запрос длиннее 250 символов — сократи описание",
  QUERY_NOT_ALLOWED: "Не получилось выполнить поиск по этому запросу. Измени формулировку и попробуй снова",
};

export const textSearchTexts = {
  label: "Опиши, что помнишь о фильме",
  placeholder: "Например: солдат в окопе, за кадром играет скрипка",
  hint: "Сюжет, сцена, персонажи, реплики, жанр или примерный год.",
  clear: "Очистить",
  resultsTitle: "Результаты по запросу",
  emptyTitle: "Не удалось узнать фильм",
  emptyText:
    "Попробуйте уточнить или переформулировать запрос, добавив сюжет, сцену, персонажей, жанр или примерный год выпуска",
  emptyTipsTitle: "Что может помочь",
  emptyTips: [
    "опиши конкретную сцену, а не весь фильм;",
    "добавь детали: где происходит действие, кто герои;",
    "укажи примерный год или страну.",
  ],
  editQuery: "Изменить запрос",
  searchAgain: "Искать снова",
  unavailableTitle: "Поиск временно недоступен",
  unavailableText: "Мы уже разбираемся. Попробуйте еще раз через несколько минут",
  retry: "Повторить",
};
