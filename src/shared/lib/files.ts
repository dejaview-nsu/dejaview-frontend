export type FileConstraints = {
  extensions: readonly string[];
  mimeTypes: readonly string[];
  maxBytes: number;
  kind: "image" | "video";
  maxDurationSeconds?: number;
};

export type ImageConstraints = FileConstraints & { kind: "image" };

export class FileValidationError extends Error {}

export const getFileExtension = (file: File) =>
  file.name.includes(".") ? (file.name.split(".").at(-1)?.toLowerCase() ?? "") : "";

export const validateFileSelection = (files: readonly File[], constraints: FileConstraints): File => {
  if (files.length === 0) throw new FileValidationError("Выберите файл перед началом поиска.");
  if (files.length !== 1) throw new FileValidationError("Для поиска можно загрузить только один файл.");
  const file = files[0];
  const extension = getFileExtension(file);
  if (!constraints.extensions.includes(extension) || (file.type && !constraints.mimeTypes.includes(file.type))) {
    throw new FileValidationError(`Поддерживаемые форматы: ${constraints.extensions.join(", ").toUpperCase()}.`);
  }
  if (file.size === 0) throw new FileValidationError("Файл пуст. Выберите другой файл.");
  if (file.size > constraints.maxBytes) {
    throw new FileValidationError(`Размер файла не должен превышать ${constraints.maxBytes / (1024 * 1024)} МБ.`);
  }
  return file;
};

export const validateMediaFile = async (files: readonly File[], constraints: ImageConstraints): Promise<void> => {
  const file = validateFileSelection(files, constraints);
  const url = URL.createObjectURL(file);
  const media = new Image();
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
      media.onload = () => {
        finish(media.naturalWidth > 0 ? undefined : new FileValidationError("Не удалось прочитать изображение."));
      };
      media.src = url;
    });
  } finally {
    media.onerror = null;
    media.onload = null;
    media.src = "";
    URL.revokeObjectURL(url);
  }
};

export const readVideoDuration = (file: File, timeoutMs = 10_000): Promise<number> =>
  new Promise<number>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");

    const finish = (result: { duration: number } | { error: Error }) => {
      clearTimeout(timer);
      video.onloadedmetadata = null;
      video.ondurationchange = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
      if ("error" in result) reject(result.error);
      else resolve(result.duration);
    };

    const timer = setTimeout(() => finish({ error: new Error("Video metadata timeout") }), timeoutMs);

    video.preload = "metadata";
    video.muted = true;
    video.onerror = () => finish({ error: new Error("Video cannot be decoded") });
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        finish({ duration: video.duration });
        return;
      }

      video.ondurationchange = () => {
        if (Number.isFinite(video.duration) && video.duration > 0) finish({ duration: video.duration });
      };
      video.currentTime = Number.MAX_SAFE_INTEGER;
    };
    video.src = url;
  });
