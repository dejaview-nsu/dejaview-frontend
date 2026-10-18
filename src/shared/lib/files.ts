export type FileConstraints = {
  extensions: readonly string[];
  mimeTypes: readonly string[];
  maxBytes: number;
  kind: "image" | "video";
  maxDurationSeconds?: number;
};

export type FileValidationCode =
  "FILE_REQUIRED" | "TOO_MANY_FILES" | "UNSUPPORTED_FORMAT" | "FILE_TOO_LARGE" | "FILE_CORRUPTED" | "VIDEO_TOO_LONG";

export class FileValidationError extends Error {
  constructor(
    message: string,
    readonly code: FileValidationCode = "FILE_CORRUPTED",
  ) {
    super(message);
  }
}

export const validateFileSelection = (files: readonly File[], constraints: FileConstraints): File => {
  if (files.length === 0) throw new FileValidationError("Выберите файл перед началом поиска.", "FILE_REQUIRED");
  if (files.length !== 1)
    throw new FileValidationError("Для поиска можно загрузить только один файл.", "TOO_MANY_FILES");
  const file = files[0];
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (!constraints.extensions.includes(extension) || (file.type && !constraints.mimeTypes.includes(file.type))) {
    throw new FileValidationError(
      `Поддерживаемые форматы: ${constraints.extensions.join(", ").toUpperCase()}.`,
      "UNSUPPORTED_FORMAT",
    );
  }
  if (file.size === 0) throw new FileValidationError("Файл пуст. Выберите другой файл.");
  if (file.size > constraints.maxBytes) {
    throw new FileValidationError(
      `Размер файла не должен превышать ${constraints.maxBytes / (1024 * 1024)} МБ.`,
      "FILE_TOO_LARGE",
    );
  }
  return file;
};

export const validateMediaFile = async (files: readonly File[], constraints: FileConstraints): Promise<void> => {
  const file = validateFileSelection(files, constraints);
  const url = URL.createObjectURL(file);
  const media = constraints.kind === "image" ? new Image() : document.createElement("video");
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new FileValidationError("Не удалось прочитать файл. Выберите другой файл."));
      }, 10_000);
      const finish = (error?: FileValidationError) => {
        clearTimeout(timer);
        if (error) reject(error);
        else resolve();
      };
      media.onerror = () => finish(new FileValidationError("Файл повреждён или не поддерживается браузером."));
      if (media instanceof HTMLVideoElement) {
        media.preload = "metadata";
        media.onloadedmetadata = () => {
          if (!Number.isFinite(media.duration) || media.duration <= 0) {
            finish(new FileValidationError("Не удалось определить длительность видео."));
          } else if (constraints.maxDurationSeconds && media.duration > constraints.maxDurationSeconds) {
            finish(
              new FileValidationError(
                `Длительность видео не должна превышать ${constraints.maxDurationSeconds} секунд.`,
                "VIDEO_TOO_LONG",
              ),
            );
          } else finish();
        };
      } else {
        media.onload = () => {
          finish(media.naturalWidth > 0 ? undefined : new FileValidationError("Не удалось прочитать изображение."));
        };
      }
      media.src = url;
    });
  } finally {
    media.onerror = null;
    if (media instanceof HTMLVideoElement) {
      media.onloadedmetadata = null;
      media.removeAttribute("src");
      media.load();
    } else {
      media.onload = null;
      media.src = "";
    }
    URL.revokeObjectURL(url);
  }
};
