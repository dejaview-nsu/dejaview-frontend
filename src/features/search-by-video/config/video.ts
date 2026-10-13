import { type FileConstraints } from "@/shared/lib/files";

export const videoConstraints: FileConstraints = {
  kind: "video",
  extensions: ["mp4", "mov", "webm"],
  mimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
  maxBytes: 50 * 1024 * 1024,
  maxDurationSeconds: 30,
};

export type VideoCheckReason = "missing" | "multiple" | "tooLarge" | "format" | "tooLong" | "corrupted";

export const videoCheckTitle = "Не получилось начать поиск";

export const videoCheckMessages: Record<VideoCheckReason, string> = {
  missing: "Сначала добавьте видеофрагмент: нажмите «Выбрать файл».",
  multiple: "Можно искать только по одному видеофрагменту. Выберите один файл.",
  tooLarge: "Файл больше 50 МБ. Сожмите видео или выберите фрагмент покороче.",
  format: "Этот формат не подходит. Загрузите видео в формате MP4, MOV или WEBM.",
  tooLong: "Фрагмент длиннее 30 секунд. Обрежьте видео до самой узнаваемой сцены или выберите другой файл.",
  corrupted: "Не удалось открыть видео — возможно, файл поврежден. Попробуйте другой файл.",
};

export const videoCheckChips: Partial<Record<VideoCheckReason, string>> = {
  tooLarge: "Файл больше 50 МБ",
  format: "Формат не подходит",
  tooLong: "Фрагмент длиннее 30 секунд",
  corrupted: "Файл поврежден",
};

export const videoUploadTexts = {
  prompt: "Перетащите видеофрагмент сюда или выберите файл",
  promptMobile: "Выберите видеофрагмент",
  hint: "MP4, MOV или WEBM · до 30 секунд · до 50 МБ · один файл",
  hintMobile: ["MP4, MOV или WEBM", "до 50 МБ, до 30 секунд"],
  replaceHint: "Чтобы заменить видео, перетащите другое сюда или нажмите «Заменить»",
  replace: "Заменить",
  remove: "Удалить",
  fileFits: "Файл подходит — можно начинать поиск",
  fileFitsMobile: ["Файл подходит.", "Можно начинать поиск"],
  checking: "Проверяем файл…",
  uploading: "Загружаем видео…",
  processing: "Ищем фильм…",
};

export const videoSearchTexts = {
  uploadingTitle: "Загружаем видео…",
  processingTitle: "Ищем фильм по фрагменту…",
  uploadStage: "Этап 1: загрузка",
  uploadDone: "Видео загружено",
  cancelUpload: "Отменить загрузку",
  searchStage: "Этап 2: поиск фильма",
  searchWaiting: "Начнется сразу после загрузки",
  searchRunning: "Сравниваем фрагмент с фильмами каталога",
  cancelSearch: "Отменить поиск",
  fragment: "Ваш фрагмент",
  resultTitle: "Похоже, это",
  resultAccent: "этот фильм",
  resultHint:
    "Не тот фильм? Попробуйте другую сцену — лучше подходят фрагменты с лицами героев, без титров и наложенного текста",
  openMovie: "Открыть карточку фильма",
  emptyTitle: "Не удалось узнать фильм",
  emptyText:
    "Возможно, этого фильма пока нет в нашем каталоге или во фрагменте мало узнаваемых деталей. Попробуйте другую сцену.",
  emptyTipsTitle: "Что может помочь",
  emptyTips: [
    "сцена, где видны лица героев или узнаваемое место;",
    "фрагмент без титров и наложенного текста;",
    "фрагмент из самого фильма, а не из обзора или нарезки.",
  ],
  chooseAnotherVideo: "Выбрать другое видео",
  searchAgain: "Искать снова",
  chooseFile: "Выбрать файл",
  chooseAnotherFile: "Выбрать другой файл",
  unavailableTitle: "Поиск временно недоступен",
  unavailableText: "Мы уже разбираемся. Попробуйте еще раз через несколько минут — видеофрагмент сохранится",
  retry: "Повторить",
  rateLimited: (wait: string) => `Слишком много запросов. Подождите ${wait} и попробуйте снова.`,
};
