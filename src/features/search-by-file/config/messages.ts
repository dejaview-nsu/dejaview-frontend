import { type ApiError, isSearchUnavailableError } from "@/shared/api";
import { FileValidationError } from "@/shared/lib/files";

export const imageFileMessages = {
  FILE_REQUIRED: "Сначала добавь изображение: выбери файл или вставь его из буфера обмена.",
  TOO_MANY_FILES: "Можно искать только по одному изображению. Выбери один файл.",
  UNSUPPORTED_FORMAT: "Этот формат не подходит. Загрузи изображение в формате JPG, JPEG, PNG или WEBP.",
  FILE_TOO_LARGE: "Файл больше 10 МБ. Уменьши изображение или выбери другое.",
  FILE_CORRUPTED: "Не удалось открыть изображение — возможно, файл повреждён. Попробуй другой файл.",
} as const;

export type FileSearchNotice = {
  title: string;
  message: string;
  kind: "validation" | "unavailable" | "error";
};

export const imageSearchNotice = (error: Error | ApiError): FileSearchNotice => {
  const code = "code" in error ? String(error.code) : "";

  if (Object.hasOwn(imageFileMessages, code) || error instanceof FileValidationError) {
    return {
      title: "Не получилось начать поиск",
      message: imageFileMessages[code as keyof typeof imageFileMessages] ?? imageFileMessages.FILE_CORRUPTED,
      kind: "validation",
    };
  }

  if (isSearchUnavailableError(error) || ("status" in error && error.status === 503)) {
    return {
      title: "Поиск временно недоступен",
      message: "Мы уже разбираемся. Попробуй ещё раз через несколько минут - изображение сохранится",
      kind: "unavailable",
    };
  }

  return { title: "Не получилось выполнить поиск", message: error.message, kind: "error" };
};
